import base64
import binascii
import hmac
import html
import logging
import math
import re
import secrets

import requests

from odoo import fields, http
from odoo.fields import Command
from odoo.fields import Domain
from odoo.http import request
from odoo.release import version as odoo_version
from odoo.tools import html2plaintext
from odoo.tools.binary import BinaryBytes

_logger = logging.getLogger(__name__)


class DSayurHeadless(http.Controller):
    """Private BFF-to-Odoo contract; browser requests never carry the shared API key."""

    def _reply(self, data, status=200):
        return request.make_json_response({"success": True, "data": data}, status=status)

    def _fail(self, code, message, status):
        return request.make_json_response(
            {"success": False, "error": {"code": code, "message": message}},
            status=status,
        )

    def _authorized(self):
        expected = request.env["ir.config_parameter"].sudo().get_str("dsayur_headless.api_key", "") or ""
        provided = request.httprequest.headers.get("X-DSayur-API-Key", "")
        return bool(expected) and hmac.compare_digest(expected.encode(), provided.encode())

    def _payload(self):
        limit = 1_500_000 if request.httprequest.path.endswith("/auth/profile") else 32768
        if request.httprequest.content_length and request.httprequest.content_length > limit:
            raise ValueError("BODY_TOO_LARGE")
        payload = request.httprequest.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            raise ValueError("INVALID_JSON")
        return payload

    def _money(self, amount, currency=None):
        currency = currency or request.env.website.currency_id
        return {
            "amount": amount,
            "currency": currency.name,
            "symbol": currency.symbol,
            "position": "before" if currency.position == "before" else "after",
        }

    def _customer_profile_payload(self, partner):
        image_value = partner.image_256
        image_bytes = image_value.content if image_value else b""
        image_type = None
        if image_bytes.startswith(b"\xff\xd8\xff"):
            image_type = "image/jpeg"
        elif image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            image_type = "image/png"
        elif image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP":
            image_type = "image/webp"
        return {
            "id": partner.id,
            "name": partner.name or "",
            "email": partner.email or "",
            "phone": partner.phone or "",
            "avatar_data_url": f"data:{image_type};base64,{base64.b64encode(image_bytes).decode('ascii')}" if image_type and image_bytes else None,
            "joined_at": partner.create_date.isoformat() if partner.create_date else None,
        }

    def _branch_payload(self, branch):
        return {"id": branch.id, "name": branch.name, "address": branch.address, "latitude": branch.latitude, "longitude": branch.longitude}

    def _home_delivery_payload(self, commercial, address, branch, branches):
        eta = None
        if address and address.partner_latitude and address.partner_longitude and branch:
            carrier = request.env["delivery.carrier"].sudo().search([("delivery_type", "=", "dsayur_routes"), ("is_published", "=", True)], order="sequence, id", limit=1)
            if carrier:
                eta = carrier.dsayur_area_estimate(address.partner_latitude, address.partner_longitude, branch)
        return {
            "address": ({"id": address.id, "name": address.name or commercial.name, "label": address.dsayur_address_label or "", "street": address.street or "", "street2": address.street2 or "", "city": address.city or "", "zip": address.zip or "", "phone": address.phone or commercial.phone or "", "latitude": address.partner_latitude or None, "longitude": address.partner_longitude or None} if address else None),
            "branch": self._branch_payload(branch) if branch else None,
            "branches": [self._branch_payload(item) for item in branches],
            "eta": ({"min_minutes": eta["eta_min"], "max_minutes": eta["eta_max"], "distance_km": eta["distance_km"], "deliverable": eta["deliverable"]} if eta else None),
        }

    def _public_product(self, product):
        template = product.product_tmpl_id
        website = request.env.website
        pricelist = request.pricelist
        amount = pricelist._get_product_price(product, 1.0) if pricelist else product.list_price
        image = f"{request.httprequest.host_url.rstrip('/')}/web/image/product.template/{template.id}/image_512"
        images = [{"url": image, "alt": template.name}]
        main_image = template.image_1920
        seen_image_data = {main_image.content} if main_image else set()
        for gallery_image in template.product_template_image_ids:
            gallery_data = gallery_image.image_1920
            if not gallery_data or gallery_data.content in seen_image_data:
                continue
            seen_image_data.add(gallery_data.content)
            images.append({
                "url": f"{request.httprequest.host_url.rstrip('/')}/web/image/product.image/{gallery_image.id}/image_512",
                "alt": gallery_image.name or template.name,
            })
        categories = template.public_categ_ids.filtered(lambda item: item.is_published and (not item.website_id or item.website_id == website))
        category = categories[:1]
        return {
            "id": product.id,
            "slug": template.website_url.rsplit("/", 1)[-1] or str(template.id),
            "name": template.name,
            "description": template.description_sale or template.website_description or "",
            "price": self._money(amount, pricelist.currency_id if pricelist else website.currency_id),
            "images": images,
            "category": {"id": category.id, "slug": str(category.id), "name": category.name} if category else None,
            "variants": [{
                "id": variant.id,
                "name": variant.display_name,
                "attributes": [{"name": line.attribute_id.name, "value": line.name} for line in variant.product_template_attribute_value_ids],
                # Use the variant's public list price directly. The website pricelist
                # endpoint currently collapses attribute extras for this API context.
                "price": self._money(variant.lst_price, pricelist.currency_id if pricelist else website.currency_id),
                "available": (not template.is_storable) or template.allow_out_of_stock_order or variant.free_qty > 0,
                "stock_on_hand": variant.qty_available if variant.is_storable else 0,
            } for variant in template.product_variant_ids if variant.active],
            "available": any((not variant.is_storable) or template.allow_out_of_stock_order or variant.free_qty > 0 for variant in template.product_variant_ids),
            "stock_on_hand": sum(template.product_variant_ids.filtered(lambda variant: variant.active and variant.is_storable).mapped("qty_available")),
            "badge": {"code": template.dsayur_badge, "label": dict(template._fields["dsayur_badge"].selection).get(template.dsayur_badge)} if template.dsayur_badge else None,
            "unit_label": template.dsayur_sale_unit_label or "",
            "price_per_kg": self._money(template.dsayur_price_per_kg, pricelist.currency_id if pricelist else website.currency_id) if template.dsayur_price_per_kg else None,
            "weighed": bool(template.dsayur_weighed),
            "umkm": {"name": template.dsayur_umkm_name or "", "origin": template.dsayur_umkm_origin or "", "story": template.dsayur_umkm_story or ""} if (template.dsayur_umkm_name or template.dsayur_umkm_origin or template.dsayur_umkm_story) else None,
        }

    def _cart_snapshot(self, order):
        currency = order.currency_id
        lines = []
        for line in order.order_line.filtered(lambda item: not item.is_delivery and not item.display_type and not item.is_reward_line):
            product = line.product_id
            template = product.product_tmpl_id
            # Reward and retired products can remain on older carts even when
            # their public image is no longer available. Don't emit a broken URL.
            image = (
                f"/api/odoo-image/product.template/{template.id}/image_512"
                if template.is_published and template.sale_ok and template.image_512
                else None
            )
            lines.append({
                "id": line.id,
                "product": {"id": product.id, "name": product.product_tmpl_id.name, "slug": product.product_tmpl_id.website_url.rsplit("/", 1)[-1], "image": image},
                "variant_name": product.display_name,
                "quantity": line.product_uom_qty,
                "note": line.dsayur_note or "",
                "unit_price": self._money(line.price_unit, currency),
                "subtotal": self._money(line.price_subtotal, currency),
                "tax": self._money(line.price_tax, currency),
                "total": self._money(line.price_total, currency),
            })
        return {
            "id": order.id,
            "lines": lines,
            "quantity": sum(line["quantity"] for line in lines),
            "totals": {
                "subtotal": self._money(order.amount_untaxed, currency),
                "tax": self._money(order.amount_tax, currency),
                "shipping": self._money(order.amount_delivery, currency),
                "total": self._money(order.amount_total, currency),
            },
        }

    def _cart_order(self, create=False):
        # Odoo 20 keeps the session cart on `request.cart` (lazy); `_create_cart` replaces sale_get_order(force_create).
        order = request.cart
        user = request.env.user
        partner = user.partner_id if user and not user._is_public() else request.env["res.partner"]
        if order and order.state == "draft" and not order._is_paid():
            if partner:
                if order.partner_id == partner:
                    if order.order_line.filtered(lambda line: not line.display_type and not line.is_delivery):
                        return order
                    # Respect an explicitly emptied cart in this account session;
                    # do not resurrect products from an older abandoned draft.
                    return order
                elif order._is_anonymous_cart():
                    order.sudo().partner_id = partner
                    if order.order_line.filtered(lambda line: not line.display_type and not line.is_delivery):
                        return order
                else:
                    # Never expose another signed-in account's session cart.
                    request.env.website.sale_reset()
                    order = False
            elif order._is_anonymous_cart():
                return order
            else:
                # A signed-out visitor must not inherit the last account's cart.
                request.env.website.sale_reset()
                order = False

        if partner:
            saved_orders = request.env["sale.order"].sudo().search([
                ("partner_id", "=", partner.id),
                ("website_id", "=", request.env.website.id),
                ("state", "=", "draft"),
            ], order="write_date desc, id desc", limit=30)
            saved_order = next((candidate for candidate in saved_orders
                                if not candidate._is_paid()
                                and candidate.order_line.filtered(lambda line: not line.display_type and not line.is_delivery)), False)
            if saved_order:
                request.session["sale_order_id"] = saved_order.id
                request.session["website_sale_cart_quantity"] = saved_order.cart_quantity
                request.cart = saved_order
                return saved_order

        if order and order.state == "draft" and not order._is_paid():
            return order
        # A paid/confirmed order can remain in the browser session after a
        # redirect payment (Xendit). Do not let it block a fresh cart.
        if not create:
            return False
        order = request.env.website._create_cart()
        if partner and order._is_anonymous_cart():
            order.sudo().partner_id = partner
        return order

    def _order_progress(self, order):
        if order.state == "cancel":
            return "cancelled"
        transaction = order.get_portal_last_transaction()
        cash_on_delivery = bool(
            transaction
            and transaction.provider_id.code == "custom"
            and transaction.provider_id.custom_mode == "cash_on_delivery"
        )
        # COD stays pending until the courier collects payment. That must not
        # block fulfillment tracking once the sale order is confirmed.
        if (not transaction or transaction.state != "done") and not cash_on_delivery:
            return "pending_payment"
        if order.dsayur_completed_at:
            return "completed"
        outgoing = order.picking_ids.filtered(lambda picking: picking.picking_type_code == "outgoing")
        if outgoing and all(picking.state == "done" for picking in outgoing):
            return "ready_pickup" if order.carrier_id.dsayur_is_pickup else "delivered"
        if order.dsayur_packing_started_at:
            return "packing"
        return "paid"

    def _checkout_stock_issues(self, order):
        issues = []
        for line in order.order_line.filtered(lambda row: not row.is_delivery and not row.display_type):
            product = line.product_id
            if not product.is_storable or product.free_qty >= line.product_uom_qty:
                continue
            categories = product.product_tmpl_id.public_categ_ids
            templates = request.env["product.template"].sudo().search([
                ("id", "!=", product.product_tmpl_id.id),
                ("sale_ok", "=", True),
                ("is_published", "=", True),
                ("public_categ_ids", "in", categories.ids),
                ("website_id", "in", [False, request.env.website.id]),
            ], limit=20, order="website_sequence, name") if categories else request.env["product.template"]
            alternatives = []
            for template in templates:
                variant = template.product_variant_id
                if variant and (not variant.is_storable or variant.free_qty >= line.product_uom_qty):
                    amount = order.pricelist_id._get_product_price(variant, 1.0)
                    alternatives.append({"id": variant.id, "name": variant.display_name, "price": self._money(amount, order.currency_id)})
            issues.append({"line_id": line.id, "product_id": product.id, "name": product.display_name, "quantity": line.product_uom_qty, "alternatives": alternatives})
        return issues

    def _attach_cart_to_customer(self, partner):
        order = self._cart_order()
        if order and order._is_anonymous_cart():
            order.partner_id = partner

    def _start_customer_session(self, user):
        """Start an Odoo commerce session after D-Sayur credential verification.

        The customer password is checked against dsayur.customer.account, never
        against res.users. Odoo's user only provides portal ACLs and native cart
        ownership; its own password remains separate and undisclosed.
        """
        session = request.session
        session.should_rotate = True
        session.update({
            "db": request.db,
            "login": user.login,
            "uid": user.id,
            "context": dict(user.context_get()),
            "session_token": user._compute_session_token(session.sid),
        })
        user._after_session_login()
        request.update_env(user=user.id)

    def _checkout_incomplete(self, order, partner):
        if not order or not order.order_line.filtered(lambda row: not row.is_delivery and not row.display_type):
            return self._fail("CART_EMPTY", "Keranjang tidak tersedia.", 400)
        if order.partner_id.commercial_partner_id != partner.commercial_partner_id:
            return self._fail("FORBIDDEN", "Keranjang ini bukan milik akun Anda.", 403)
        if not order.partner_shipping_id or not order.carrier_id:
            return self._fail("CHECKOUT_INCOMPLETE", "Pilih alamat dan metode pengiriman dahulu.", 400)
        if order._has_deliverable_products() and not order.order_line.filtered("is_delivery"):
            return self._fail("SHIPPING_UNAVAILABLE", "Tarif pengiriman belum tersedia untuk pesanan ini.", 409)
        if order.carrier_id.delivery_type == "dsayur_routes" and not order.dsayur_delivery_slot_id:
            return self._fail("DELIVERY_SLOT_REQUIRED", "Pilih slot pengiriman dahulu.", 400)
        if self._checkout_stock_issues(order):
            return self._fail("STOCK_ISSUES", "Ada item yang stoknya kurang. Selesaikan dahulu di langkah pengganti.", 409)
        return None

    def _payment_providers(self, order):
        partner_id, currency_id = order.partner_invoice_id.id, order.currency_id.id
        providers = request.env["payment.provider"].sudo()._find_available_providers(
            order.company_id.id, partner_id, order.amount_total, currency_id=currency_id, sale_order_id=order.id,
        )
        result = []
        for provider in providers:
            methods = provider._find_available_payment_methods(partner_id, currency_id=currency_id)
            if methods:
                result.append({
                    "id": provider.id,
                    "name": provider.name,
                    "code": provider.code,
                    "custom_mode": provider.custom_mode or None,
                    "flow": "direct" if provider.code == "custom" else "redirect",
                    "methods": [{"id": method.id, "name": method.name} for method in methods],
                })
        # Xendit (or any real gateway) first; the manual-transfer demo provider is only a fallback.
        result.sort(key=lambda item: item["code"] == "custom")
        return result

    def _dispatch(self, path):
        method = request.httprequest.method
        parts = [part for part in path.split("/") if part]
        key = "/".join(parts)
        if method == "GET" and key == "health":
            return self._reply({"ok": True, "odoo_version": odoo_version})

        if method == "GET" and key == "products":
            domain = request.env.website.sale_product_domain()
            search = request.httprequest.args.get("search", "").strip()
            category_slug = request.httprequest.args.get("categorySlug")
            if search:
                domain += ["|", ("name", "ilike", search), ("description_sale", "ilike", search)]
            if category_slug:
                category = request.env["product.public.category"].sudo().browse(int(category_slug)).exists() if category_slug.isdigit() else False
                if not category:
                    return self._reply({"items": [], "page": 1, "limit": 24, "total": 0})
                domain += [("public_categ_ids", "child_of", category.id)]
            page = max(1, int(request.httprequest.args.get("page", 1)))
            limit = min(48, max(1, int(request.httprequest.args.get("limit", 24))))
            sort = request.httprequest.args.get("sort", "")
            product_filter = request.httprequest.args.get("filter", "")
            Template = request.env["product.template"].sudo()
            if product_filter == "offers":
                domain += [("dsayur_badge", "!=", False)]
            if product_filter == "discount":
                candidates = Template.search(domain, limit=1000, order="website_sequence, name")
                discounted = candidates.filtered(lambda template: bool(
                    template.product_variant_id
                    and request.pricelist
                    and request.pricelist._get_product_price(template.product_variant_id, 1.0) < template.product_variant_id.lst_price
                ))
                if sort == "popular":
                    discounted = discounted.sorted(lambda template: -template.sales_count)
                elif sort == "price_desc":
                    discounted = discounted.sorted(lambda template: -request.pricelist._get_product_price(template.product_variant_id, 1.0))
                else:
                    discounted = discounted.sorted(lambda template: request.pricelist._get_product_price(template.product_variant_id, 1.0))
                total = len(discounted)
                templates = discounted[(page - 1) * limit:page * limit]
            elif sort == "popular":
                # sales_count is computed (not stored), so rank the matching set in Python.
                ranked = Template.search(domain, limit=500, order="website_sequence, name").sorted(lambda item: -item.sales_count)
                templates = ranked[(page - 1) * limit:page * limit]
                total = Template.search_count(domain)
            else:
                order_by = {"price_asc": "list_price asc, name", "price_desc": "list_price desc, name"}.get(sort, "website_sequence, name")
                templates = Template.search(domain, limit=limit, offset=(page - 1) * limit, order=order_by)
                total = Template.search_count(domain)
            return self._reply({"items": [self._public_product(template.product_variant_id) for template in templates if template.product_variant_id], "page": page, "limit": limit, "total": total})

        if method == "GET" and key == "branches":
            branches = request.env["dsayur.store.branch"].sudo().search([("active", "=", True)], order="sequence, id")
            return self._reply([self._branch_payload(branch) for branch in branches])

        if method == "GET" and key == "area-check":
            try:
                latitude, longitude = float(request.httprequest.args.get("lat")), float(request.httprequest.args.get("lng"))
                if not math.isfinite(latitude) or not math.isfinite(longitude) or not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                    raise ValueError
            except (TypeError, ValueError):
                return self._fail("AREA_INVALID", "Koordinat lokasi tidak valid.", 400)
            branches = request.env["dsayur.store.branch"].sudo().search([("active", "=", True)], order="sequence, id")
            try:
                branch_id = int(request.httprequest.args.get("branch_id", 0))
            except (TypeError, ValueError):
                branch_id = 0
            branch = branches.filtered(lambda item: item.id == branch_id)[:1] if branch_id else branches[:1]
            carrier = request.env.ref("dsayur_headless.dsayur_delivery_routes", raise_if_not_found=False)
            estimate = carrier.sudo().dsayur_area_estimate(latitude, longitude, branch) if carrier and branch else None
            if estimate is None:
                return self._fail("AREA_UNAVAILABLE", "Jarak belum dapat dihitung. Coba lagi nanti atau pilih ambil sendiri.", 503)
            return self._reply({**estimate, "branch": self._branch_payload(branch), "pickup_available": True})

        if method == "GET" and key == "reverse-geocode":
            try:
                latitude = float(request.httprequest.args.get("lat"))
                longitude = float(request.httprequest.args.get("lng"))
                if not math.isfinite(latitude) or not math.isfinite(longitude) or not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                    raise ValueError
            except (TypeError, ValueError):
                return self._fail("LOCATION_INVALID", "Koordinat lokasi tidak valid.", 400)

            api_key = request.env["ir.config_parameter"].sudo().get_str("dsayur_headless.ors_api_key", "") or ""
            if not api_key:
                return self._fail("GEOCODER_UNAVAILABLE", "Pencarian alamat belum dikonfigurasi.", 503)
            try:
                response = requests.get(
                    "https://api.heigit.org/pelias/v1/reverse",
                    params={"point.lat": latitude, "point.lon": longitude, "size": 1},
                    headers={"Authorization": api_key, "Accept": "application/json"},
                    timeout=8,
                )
                response.raise_for_status()
                features = response.json().get("features") or []
            except (requests.RequestException, ValueError, AttributeError):
                _logger.exception("ORS reverse geocoding failed")
                return self._fail("GEOCODER_UNAVAILABLE", "Alamat belum dapat ditemukan. Coba lagi sebentar.", 503)
            if not features:
                return self._fail("ADDRESS_NOT_FOUND", "Alamat di lokasi ini tidak ditemukan.", 404)

            properties = features[0].get("properties") or {}
            street_name = properties.get("street") or properties.get("name") or ""
            house_number = properties.get("housenumber") or ""
            street = " ".join(part for part in (street_name, house_number) if part).strip()
            city = properties.get("locality") or properties.get("localadmin") or properties.get("county") or properties.get("region") or ""
            return self._reply({
                "label": properties.get("label") or street,
                "street": street or properties.get("label") or "",
                "street2": properties.get("neighbourhood") or properties.get("borough") or "",
                "city": city,
                "region": properties.get("region") or "",
                "zip": properties.get("postalcode") or "",
                "latitude": latitude,
                "longitude": longitude,
            })

        if method == "GET" and len(parts) == 2 and parts[0] == "products":
            # website_url is computed (not searchable) in Odoo 20; the slug ends with the template id ("name-77").
            slug_id = parts[1].rsplit("-", 1)[-1]
            template = request.env["product.template"].sudo().search(request.env.website.sale_product_domain() + [("id", "=", int(slug_id) if slug_id.isdigit() else 0)], limit=1)
            if not template:
                return self._fail("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.", 404)
            result = self._public_product(template.product_variant_id)
            return self._reply(result)

        if method == "GET" and key == "categories":
            category_domain = Domain([("has_published_products", "=", True), ("website_id", "in", [False, request.env.website.id])])
            categories = request.env["product.public.category"].sudo().search(category_domain, order="sequence, name")
            return self._reply([{"id": item.id, "name": item.name, "slug": str(item.id), "image": f"{request.httprequest.host_url.rstrip('/')}/web/image/product.public.category/{item.id}/image_512"} for item in categories])

        if method == "GET" and len(parts) == 2 and parts[0] == "categories":
            category = request.env["product.public.category"].sudo().browse(int(parts[1])).exists() if parts[1].isdigit() else False
            if category and (not category.has_published_products or (category.website_id and category.website_id != request.env.website)):
                category = False
            if not category:
                return self._fail("CATEGORY_NOT_FOUND", "Kategori tidak ditemukan.", 404)
            templates = request.env["product.template"].sudo().search(request.env.website.sale_product_domain() + [("public_categ_ids", "child_of", category.id)], limit=48, order="website_sequence, name")
            children = [{"id": child.id, "slug": str(child.id), "name": child.name} for child in category.child_id if child.has_published_products]
            return self._reply({"id": category.id, "slug": str(category.id), "name": category.name, "children": children, "products": [self._public_product(item.product_variant_id) for item in templates if item.product_variant_id]})

        if key.startswith("admin/"):
            return self._admin_dispatch(key, method)

        if key == "stock-alerts" and method == "POST":
            payload = self._payload()
            try:
                product_id = int(payload.get("product_id", 0))
            except (TypeError, ValueError):
                product_id = 0
            email = (payload.get("email") or "").strip().lower()
            product = request.env["product.product"].sudo().browse(product_id).exists()
            if not product or not product.sale_ok or not product.product_tmpl_id.is_published:
                return self._fail("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.", 404)
            if len(email) > 254 or "@" not in email or "." not in email.rsplit("@", 1)[-1]:
                return self._fail("EMAIL_INVALID", "Masukkan alamat email yang valid.", 400)
            if product.is_storable and product.free_qty > 0:
                return self._reply({"subscribed": False, "already_available": True})
            Alert = request.env["dsayur.stock.alert"].sudo()
            existing = Alert.search([("product_id", "=", product.id), ("email", "=", email), ("state", "=", "waiting")], limit=1)
            if not existing:
                Alert.create({"product_id": product.id, "email": email})
            return self._reply({"subscribed": True}, status=201)

        if key.startswith("auth/") or key in ("cart", "cart/lines", "favorites", "loyalty", "member", "addresses", "home-address", "home-branch", "reorder-suggestions") or key.startswith("cart/lines/") or key.startswith("favorites/") or key.startswith("addresses/") or key.startswith("checkout") or key == "orders" or key.startswith("orders/"):
            return self._customer_dispatch(key, method)

        return self._fail("NOT_FOUND", "Route tidak ditemukan.", 404)

    def _admin_dispatch(self, key, method):
        if request.env.user._is_public() or not request.env.user.has_group("sales_team.group_sale_manager"):
            return self._fail("FORBIDDEN", "Fitur ini hanya untuk pengelola katalog.", 403)
        Product = request.env["product.template"].sudo().with_context(website_id=request.env.website.id)
        Category = request.env["product.public.category"].sudo()

        def product_payload(template):
            product = template.product_variant_id
            categories = template.public_categ_ids
            return {
                "id": template.id,
                "name": template.name,
                "price": template.list_price,
                "description": template.description_sale or "",
                "published": template.is_published,
                "category_ids": categories.ids,
                "categories": categories.mapped("name"),
                "image": f"/api/odoo-image/product.template/{template.id}/image_512",
                "sku": product.default_code or "",
                "stock_quantity": sum(template.product_variant_ids.mapped("free_qty")),
            }

        if key == "admin/categories" and method == "GET":
            groups = Category.search([], order="sequence, name")
            return self._reply([{"id": row.id, "name": row.name} for row in groups])

        if key == "admin/categories" and method == "POST":
            name = (self._payload().get("name") or "").strip()
            if not name or len(name) > 100:
                return self._fail("CATEGORY_INVALID", "Nama kategori wajib diisi (maksimal 100 karakter).", 400)
            group = Category.create({"name": name, "website_id": request.env.website.id})
            return self._reply({"id": group.id, "name": group.name, "slug": str(group.id)}, status=201)

        if key == "admin/products" and method == "GET":
            search = request.httprequest.args.get("search", "").strip()
            domain = [("sale_ok", "=", True)]
            if search:
                domain += [("name", "ilike", search)]
            records = Product.search(domain, order="write_date desc, name", limit=200)
            return self._reply([product_payload(row) for row in records])

        if key == "admin/products" and method == "POST":
            payload = self._payload()
            values = self._product_values(payload)
            template = Product.create(values)
            sku = (payload.get("sku") or "").strip()[:80]
            if sku:
                template.product_variant_id.default_code = sku
            return self._reply(product_payload(template), status=201)

        if key == "admin/orders" and method == "GET":
            Order = request.env["sale.order"].sudo()
            orders = Order.search([("website_id", "=", request.env.website.id), "|", ("state", "!=", "draft"), ("dsayur_cancel_requested_at", "!=", False)], order="date_order desc", limit=200)
            result = []
            for order in orders:
                transaction = order.get_portal_last_transaction()
                result.append({
                    "id": order.id,
                    "order_number": order.name,
                    "status": order.state,
                    "progress_status": self._order_progress(order),
                    "payment_status": transaction.state if transaction else "no_transaction",
                    "payment_method": transaction.provider_id.name if transaction else "Odoo",
                    "payment_provider_code": transaction.provider_id.code if transaction else "",
                    "total": order.amount_total,
                    "created_at": order.date_order.isoformat(),
                    "customer_name": order.partner_id.name,
                    "cancellation_requested_at": order.dsayur_cancel_requested_at.isoformat() if order.dsayur_cancel_requested_at else None,
                    "cancellation_reason": order.dsayur_cancel_reason or "",
                })
            return self._reply(result)

        if key.startswith("admin/orders/") and key.endswith("/start-packing") and method == "POST":
            try:
                order_id = int(key.split("/")[2])
            except (IndexError, ValueError):
                order_id = 0
            order = request.env["sale.order"].sudo().search([("id", "=", order_id), ("website_id", "=", request.env.website.id)], limit=1)
            if not order or not order.action_dsayur_start_packing():
                return self._fail("PACKING_NOT_READY", "Packing hanya dapat dimulai setelah pesanan dibayar.", 409)
            return self._reply({"progress_status": self._order_progress(order)})

        if key.startswith("admin/orders/") and key.endswith("/confirm-payment") and method == "POST":
            try:
                order_id = int(key.split("/")[2])
            except (IndexError, ValueError):
                order_id = 0
            order = request.env["sale.order"].sudo().search([("id", "=", order_id), ("website_id", "=", request.env.website.id)], limit=1)
            transaction = order.get_portal_last_transaction() if order else False
            if not transaction or transaction.provider_code != "custom" or transaction.state != "pending":
                return self._fail("PAYMENT_NOT_PENDING", "Hanya transfer manual yang menunggu dapat dikonfirmasi.", 409)
            transaction.action_confirm()  # also post-processes: confirms the order and refreshes the tier
            return self._reply({"progress_status": self._order_progress(order), "payment_status": transaction.state})

        if key == "admin/tiers/review" and method == "POST":
            request.env["res.partner"].sudo()._cron_review_tiers(force=True)
            return self._reply({"reviewed": True})

        if key.startswith("admin/orders/") and key.endswith("/pickup-complete") and method == "POST":
            try:
                order_id = int(key.split("/")[2])
            except (IndexError, ValueError):
                order_id = 0
            order = request.env["sale.order"].sudo().search([("id", "=", order_id), ("website_id", "=", request.env.website.id)], limit=1)
            outgoing = order.picking_ids.filtered(lambda picking: picking.picking_type_code == "outgoing") if order else request.env["stock.picking"]
            if not order or not order.carrier_id.dsayur_is_pickup or not outgoing or any(picking.state != "done" for picking in outgoing):
                return self._fail("PICKUP_NOT_READY", "Pickup hanya dapat diselesaikan setelah seluruh picking divalidasi di Inventory.", 409)
            order.write({"dsayur_completed_at": fields.Datetime.now()})
            return self._reply({"progress_status": "completed"})

        if key.startswith("admin/products/") and method == "PATCH":
            try:
                product_id = int(key.rsplit("/", 1)[-1])
            except ValueError:
                product_id = 0
            template = Product.browse(product_id).exists()
            if not template:
                return self._fail("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.", 404)
            payload = self._payload()
            template.write(self._product_values(payload))
            if "sku" in payload:
                template.product_variant_id.default_code = (payload.get("sku") or "").strip()[:80] or False
            return self._reply(product_payload(template))

        return self._fail("NOT_FOUND", "Route tidak ditemukan.", 404)

    def _product_values(self, payload):
        name = (payload.get("name") or "").strip()
        try:
            price = float(payload.get("price", -1))
            raw_categories = payload.get("category_ids", [])
            if not isinstance(raw_categories, list):
                raise ValueError("category_ids")
            category_ids = sorted({int(value) for value in raw_categories})
        except (TypeError, ValueError):
            raise ValueError("INVALID_PRODUCT")
        if not name or len(name) > 200 or not math.isfinite(price) or price < 0:
            raise ValueError("INVALID_PRODUCT")
        allowed_categories = request.env["product.public.category"].search_count([("id", "in", category_ids)])
        if len(category_ids) != allowed_categories:
            raise ValueError("INVALID_PRODUCT")
        return {
            "name": name,
            "description_sale": (payload.get("description") or "")[:5000],
            "list_price": price,
            "sale_ok": True,
            "is_published": bool(payload.get("published")),
            "public_categ_ids": [(6, 0, category_ids)],
        }

    def _customer_dispatch(self, key, method):
        payload = self._payload() if method in ("POST", "PATCH", "PUT") else {}
        partner = request.env.user.partner_id if request.env.user and not request.env.user._is_public() else request.env["res.partner"]

        if key == "favorites" and method == "GET":
            if not partner:
                return self._reply([])
            return self._reply(partner.sudo().dsayur_favorite_product_ids.ids)

        if key.startswith("favorites/") and method in ("POST", "DELETE"):
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk menyimpan produk favorit.", 401)
            try:
                product_id = int(key.rsplit("/", 1)[-1])
            except ValueError:
                product_id = 0
            product = request.env["product.product"].sudo().browse(product_id).exists()
            if not product or not product.sale_ok or not product.product_tmpl_id.is_published:
                return self._fail("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.", 404)
            command = Command.link(product.id) if method == "POST" else Command.unlink(product.id)
            partner.sudo().write({"dsayur_favorite_product_ids": [command]})
            return self._reply(partner.sudo().dsayur_favorite_product_ids.ids)

        if key == "addresses" and method == "GET":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk melihat alamat.", 401)
            records = partner.commercial_partner_id.child_ids.filtered(lambda item: item.active and item.type in ("delivery", "other"))
            return self._reply([{"id": row.id, "name": row.name, "label": row.dsayur_address_label or "", "street": row.street or "", "street2": row.street2 or "", "city": row.city or "", "zip": row.zip or "", "phone": row.phone or "", "latitude": row.partner_latitude, "longitude": row.partner_longitude} for row in records])

        if key == "home-address" and method == "GET":
            if not partner:
                return self._reply({"address": None, "branch": None, "branches": [], "eta": None})
            commercial = partner.commercial_partner_id
            branches = request.env["dsayur.store.branch"].sudo().search([("active", "=", True)], order="sequence, id")
            branch = commercial.dsayur_default_branch_id
            if branch not in branches:
                branch = branches[:1]
                if branch:
                    commercial.sudo().write({"dsayur_default_branch_id": branch.id})
            addresses = commercial.child_ids.filtered(lambda item: item.active and item.type in ("delivery", "other"))
            if commercial.contact_address:
                addresses |= commercial
            addresses = addresses.sorted("id")
            address = commercial.dsayur_default_delivery_address_id
            if address not in addresses:
                order = self._cart_order()
                address = order.partner_shipping_id if order and order.partner_shipping_id in addresses else addresses[:1]
            if address and commercial.dsayur_default_delivery_address_id != address:
                commercial.sudo().write({"dsayur_default_delivery_address_id": address.id})
            order = self._cart_order()
            if order and branch and order.dsayur_branch_id != branch:
                order.sudo().write({"dsayur_branch_id": branch.id})
            return self._reply(self._home_delivery_payload(commercial, address, branch, branches))

        if key == "home-branch" and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk memilih cabang.", 401)
            try:
                branch_id = int(payload.get("branch_id", 0))
            except (TypeError, ValueError):
                branch_id = 0
            branches = request.env["dsayur.store.branch"].sudo().search([("active", "=", True)], order="sequence, id")
            branch = branches.filtered(lambda item: item.id == branch_id)[:1]
            if not branch:
                return self._fail("BRANCH_NOT_FOUND", "Cabang tidak ditemukan atau sedang tidak tersedia.", 404)
            commercial = partner.commercial_partner_id
            commercial.sudo().write({"dsayur_default_branch_id": branch.id})
            order = self._cart_order()
            if order:
                order.sudo().write({"dsayur_branch_id": branch.id})
                if order.dsayur_delivery_slot_id:
                    order.sudo().write({"dsayur_delivery_slot_id": False, "dsayur_delivery_slot_reserved_at": False})
                if order.carrier_id:
                    rate = order.carrier_id.rate_shipment(order)
                    if rate.get("success"):
                        order._set_delivery_method(order.carrier_id)
                    else:
                        order.order_line.filtered("is_delivery").sudo().unlink()
                        order.sudo().write({"carrier_id": False})
            address = commercial.dsayur_default_delivery_address_id
            valid_addresses = commercial.child_ids.filtered(lambda item: item.active and item.type in ("delivery", "other"))
            if address not in valid_addresses and commercial.contact_address:
                address = commercial
            if address not in valid_addresses and not commercial.contact_address:
                address = valid_addresses.sorted("id")[:1]
            return self._reply(self._home_delivery_payload(commercial, address, branch, branches))

        if key == "addresses" and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk menyimpan alamat.", 401)
            name, street, city, zip_code = [(payload.get(field) or "").strip() for field in ("name", "street", "city", "zip")]
            if not name or not street or not city or not zip_code:
                return self._fail("ADDRESS_INVALID", "Nama, alamat, kota, dan kode pos wajib diisi.", 400)
            try:
                latitude, longitude = float(payload.get("latitude")), float(payload.get("longitude"))
                if not math.isfinite(latitude) or not math.isfinite(longitude) or not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                    raise ValueError
            except (TypeError, ValueError):
                return self._fail("ADDRESS_PIN_REQUIRED", "Tandai pin lokasi alamat yang valid.", 400)
            country = request.env["res.country"].sudo().search([("code", "=", "ID")], limit=1)
            address = request.env["res.partner"].sudo().create({"parent_id": partner.commercial_partner_id.id, "type": "delivery", "name": name[:120], "dsayur_address_label": (payload.get("label") or "").strip()[:80], "street": street[:250], "street2": (payload.get("street2") or "").strip()[:250], "city": city[:120], "zip": zip_code[:24], "phone": (payload.get("phone") or "").strip()[:40], "country_id": country.id, "partner_latitude": latitude, "partner_longitude": longitude})
            partner.commercial_partner_id.sudo().write({"dsayur_default_delivery_address_id": address.id})
            return self._reply({"id": address.id, "name": address.name, "label": address.dsayur_address_label or "", "street": address.street, "street2": address.street2 or "", "city": address.city, "zip": address.zip, "phone": address.phone or "", "latitude": latitude, "longitude": longitude}, status=201)

        if key.startswith("addresses/"):
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk mengubah alamat.", 401)
            try:
                address_id = int(key.split("/")[1])
            except (IndexError, ValueError):
                address_id = 0
            allowed_ids = (partner.commercial_partner_id | partner.commercial_partner_id.child_ids).ids
            address = request.env["res.partner"].sudo().search([("id", "=", address_id), ("id", "in", allowed_ids), ("type", "in", ["delivery", "other"]), ("active", "=", True)], limit=1)
            if not address:
                return self._fail("ADDRESS_NOT_FOUND", "Alamat tidak ditemukan.", 404)
            if key.endswith("/default") and method == "POST":
                partner.commercial_partner_id.sudo().write({"dsayur_default_delivery_address_id": address.id})
                return self._reply({"id": address.id, "name": address.name, "street": address.street or "", "street2": address.street2 or "", "city": address.city or "", "zip": address.zip or "", "phone": address.phone or ""})
            if method == "DELETE":
                address.active = False
                commercial = partner.commercial_partner_id
                if commercial.dsayur_default_delivery_address_id == address:
                    replacement = commercial.child_ids.filtered(lambda item: item.active and item.id != address.id and item.type in ("delivery", "other"))[:1]
                    commercial.sudo().write({"dsayur_default_delivery_address_id": replacement.id or False})
                return self._reply({"deleted": True})
            if method == "PATCH":
                values = {}
                for key_name, field_name, limit in (("name", "name", 120), ("label", "dsayur_address_label", 80), ("street", "street", 250), ("street2", "street2", 250), ("city", "city", 120), ("zip", "zip", 24), ("phone", "phone", 40)):
                    if key_name in payload:
                        value = payload[key_name]
                        if not isinstance(value, str) or (key_name in ("name", "street", "city", "zip") and not value.strip()):
                            return self._fail("ADDRESS_INVALID", "Periksa kembali data alamat.", 400)
                        values[field_name] = value.strip()[:limit]
                if "latitude" in payload or "longitude" in payload:
                    try:
                        latitude = float(payload.get("latitude", address.partner_latitude))
                        longitude = float(payload.get("longitude", address.partner_longitude))
                        if not math.isfinite(latitude) or not math.isfinite(longitude) or not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                            raise ValueError
                    except (TypeError, ValueError):
                        return self._fail("ADDRESS_PIN_REQUIRED", "Koordinat pin tidak valid.", 400)
                    values.update({"partner_latitude": latitude, "partner_longitude": longitude})
                address.write(values)
                return self._reply({"id": address.id, "name": address.name, "label": address.dsayur_address_label or "", "street": address.street, "street2": address.street2 or "", "city": address.city, "zip": address.zip, "phone": address.phone or "", "latitude": address.partner_latitude, "longitude": address.partner_longitude})
            return self._fail("METHOD_NOT_ALLOWED", "Metode alamat tidak didukung.", 405)

        if key == "auth/me" and method == "GET":
            if not partner:
                return self._reply({"logged_in": False, "customer": None})
            return self._reply({"logged_in": True, "customer": {"id": partner.id, "name": partner.name, "email": partner.email or "", "phone": partner.phone or "", "is_admin": request.env.user.has_group("sales_team.group_sale_manager")}})

        if key == "auth/profile" and method == "GET":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk melihat profil.", 401)
            return self._reply(self._customer_profile_payload(partner))

        if key == "auth/profile" and method == "PATCH":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk mengubah profil.", 401)
            values = {}
            if "name" in payload:
                name = payload.get("name")
                if not isinstance(name, str) or not 2 <= len(name.strip()) <= 120:
                    return self._fail("PROFILE_INVALID", "Nama harus 2–120 karakter.", 400)
                values["name"] = name.strip()
            if "phone" in payload:
                phone = payload.get("phone")
                if not isinstance(phone, str) or len(phone.strip()) > 40:
                    return self._fail("PROFILE_INVALID", "Nomor telepon maksimal 40 karakter.", 400)
                values["phone"] = phone.strip()
            if "image_data_url" in payload:
                image_data_url = payload.get("image_data_url")
                match = re.fullmatch(r"data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})", image_data_url or "") if isinstance(image_data_url, str) else None
                if not match or len(match.group(2)) > 1_400_000:
                    return self._fail("PROFILE_IMAGE_INVALID", "Foto profil harus berupa JPG, PNG, atau WebP dan berukuran maksimal 1 MB.", 400)
                try:
                    image_bytes = base64.b64decode(match.group(2), validate=True)
                except (binascii.Error, ValueError):
                    return self._fail("PROFILE_IMAGE_INVALID", "File foto profil tidak valid.", 400)
                image_type = match.group(1)
                valid_signature = (
                    image_type == "jpeg" and image_bytes.startswith(b"\xff\xd8\xff")
                    or image_type == "png" and image_bytes.startswith(b"\x89PNG\r\n\x1a\n")
                    or image_type == "webp" and image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP"
                )
                if not valid_signature or len(image_bytes) > 1_000_000:
                    return self._fail("PROFILE_IMAGE_INVALID", "File foto profil tidak valid atau terlalu besar.", 400)
                values["image_1920"] = BinaryBytes(image_bytes)
            if not values:
                return self._fail("PROFILE_INVALID", "Tidak ada perubahan profil untuk disimpan.", 400)
            partner.sudo().write(values)
            return self._reply(self._customer_profile_payload(partner))

        if key in ("loyalty", "member") and method == "GET":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk melihat keanggotaan.", 401)
            member = partner.commercial_partner_id
            today = fields.Date.context_today(member.with_context(tz="Asia/Jakarta"))
            spend = member._dsayur_month_spend(today.replace(day=1))
            tier = member.dsayur_tier or "bronze"
            thresholds = {"bronze": 750_000, "silver": 2_500_000, "gold": None}
            next_threshold = thresholds[tier]
            Program = request.env.ref("dsayur_headless.dsayur_loyalty_program", raise_if_not_found=False)
            cards = request.env["loyalty.card"].sudo().search([("program_id", "=", Program.id), ("partner_id", "in", (member | member.child_ids).ids), ("active", "=", True)]) if Program else request.env["loyalty.card"]
            voucher_programs = request.env["loyalty.program"].browse([
                request.env.ref("dsayur_headless.dsayur_silver_voucher_program", raise_if_not_found=False).id if request.env.ref("dsayur_headless.dsayur_silver_voucher_program", raise_if_not_found=False) else 0,
                request.env.ref("dsayur_headless.dsayur_gold_voucher_program", raise_if_not_found=False).id if request.env.ref("dsayur_headless.dsayur_gold_voucher_program", raise_if_not_found=False) else 0,
            ])
            vouchers = request.env["loyalty.card"].sudo().search([("program_id", "in", voucher_programs.ids), ("partner_id", "in", (member | member.child_ids).ids), ("active", "=", True), ("points", ">", 0.99), "|", ("expiration_date", "=", False), ("expiration_date", ">=", today)])
            tier_rank = {"bronze": 0, "silver": 1, "gold": 2}.get(tier, 0)
            early_programs = request.env["loyalty.program"].sudo().search([
                ("active", "=", True),
                ("sale_ok", "=", True),
                ("program_type", "in", ["promotion", "promo_code"]),
                ("dsayur_minimum_tier", "in", [name for name, rank in {"silver": 1, "gold": 2}.items() if rank <= tier_rank]),
                "|", ("date_to", "=", False), ("date_to", ">=", today),
            ], order="date_from, name")
            early_access = [{
                "name": program.name,
                "minimum_tier": program.dsayur_minimum_tier,
                "starts_at": fields.Date.to_string(program.date_from) if program.date_from else None,
                "ends_at": fields.Date.to_string(program.date_to) if program.date_to else None,
                "codes": program.rule_ids.filtered(lambda rule: rule.mode == "with_code").mapped("code"),
            } for program in early_programs]
            return self._reply({
                "tier": tier,
                "tier_valid_until": fields.Date.to_string(member.dsayur_tier_valid_until) if member.dsayur_tier_valid_until else None,
                "month_spend": spend,
                "next_tier_spend": next_threshold,
                "spend_to_next_tier": max(0.0, next_threshold - spend) if next_threshold else 0.0,
                "points_multiplier": {"bronze": 1.0, "silver": 1.5, "gold": 2.0}[tier],
                "free_shipping_minimum": {"bronze": 150000, "silver": 100000, "gold": 50000}[tier],
                "gold_discount_percent": 2 if tier == "gold" else 0,
                "cards": [{"id": card.id, "code": card.code, "points": card.points, "point_value": card.points * 10} for card in cards],
                "vouchers": [{"id": card.id, "code": card.code, "name": card.program_id.name, "value": card.program_id.reward_ids[:1].discount, "expiration_date": fields.Date.to_string(card.expiration_date) if card.expiration_date else None} for card in vouchers],
                "early_access_promos": early_access,
                "tiers": [
                    {"tier": "bronze", "min_spend": 0, "points_multiplier": 1.0, "free_shipping_minimum": 150000, "discount_percent": 0, "perks": "Promo umum"},
                    {"tier": "silver", "min_spend": 750000, "points_multiplier": 1.5, "free_shipping_minimum": 100000, "discount_percent": 0, "perks": "Voucher naik tier Rp20.000 · flash sale 1 jam lebih awal"},
                    {"tier": "gold", "min_spend": 2500000, "points_multiplier": 2.0, "free_shipping_minimum": 50000, "discount_percent": 2, "perks": "Voucher naik tier Rp50.000 · flash sale lebih awal · slot kirim pagi prioritas"},
                ],
                "history": [{
                    "description": line.description,
                    "points": line.issued - line.used,
                    "date": fields.Datetime.to_string(line.points_changed_date or line.create_date),
                } for line in request.env["loyalty.history"].sudo().search([("card_id", "in", cards.ids)], order="id desc", limit=15)],
            })

        if key == "auth/login" and method == "POST":
            login = (payload.get("login") or "").strip()
            password = payload.get("password") or ""
            if not login or not password or len(password) > 256:
                return self._fail("INVALID_CREDENTIALS", "Username/email dan kata sandi wajib diisi.", 400)
            user = request.env["dsayur.customer.account"].authenticate_dsayur(login, password)
            if not user:
                return self._fail("AUTHENTICATION_FAILED", "Email atau kata sandi akun D-Sayur salah.", 401)
            self._start_customer_session(user)
            user = request.env.user
            customer = user.partner_id
            self._attach_cart_to_customer(customer)
            return self._reply({"id": customer.id, "name": customer.name, "email": customer.email or "", "phone": customer.phone or "", "is_admin": user.has_group("sales_team.group_sale_manager")})

        if key == "auth/register" and method == "POST":
            name = (payload.get("name") or "").strip()
            email = (payload.get("email") or "").strip().lower()
            password = payload.get("password") or ""
            phone = (payload.get("phone") or "").strip()
            if len(name) < 2 or len(name) > 120 or "@" not in email or len(password) < 8 or len(password) > 256:
                return self._fail("REGISTRATION_INVALID", "Isi nama, email valid, dan kata sandi minimal 8 karakter.", 400)
            Accounts = request.env["dsayur.customer.account"].sudo()
            if Accounts.search_count([("email", "=", email)]):
                return self._fail("EMAIL_IN_USE", "Email sudah memiliki akun D-Sayur. Silakan masuk atau gunakan pemulihan akun.", 409)
            try:
                Partner = request.env["res.partner"].sudo()
                customer = Partner.search([("email", "=ilike", email)], limit=1)
                if customer:
                    user = customer.user_ids.filtered(lambda candidate: candidate.share)[:1]
                    if customer.user_ids and not user:
                        return self._fail("EMAIL_IN_USE", "Email ini digunakan akun internal toko. Gunakan email pelanggan yang berbeda.", 409)
                    if user:
                        customer.write({"name": name, "phone": phone})
                else:
                    customer = Partner.create({"name": name, "email": email, "phone": phone, "customer_rank": 1})
                    user = request.env["res.users"]
                if not user:
                    portal = request.env.ref("base.group_portal")
                    user = request.env["res.users"].sudo().with_context(no_reset_password=True).create({
                        "name": name,
                        "login": f"dsayur-{secrets.token_hex(24)}@accounts.invalid",
                        "password": secrets.token_urlsafe(48),
                        "partner_id": customer.id,
                        "group_ids": [Command.set(portal.ids)],
                    })
                Accounts.create({
                    "email": email,
                    "password_hash": Accounts._hash_password(password),
                    "partner_id": customer.id,
                    "user_id": user.id,
                })
                self._start_customer_session(user)
            except Exception:
                request.env.cr.rollback()
                _logger.info("D-Sayur customer registration failed", exc_info=True)
                return self._fail("REGISTRATION_FAILED", "Akun D-Sayur belum dapat dibuat. Periksa kembali email atau coba lagi.", 400)
            customer = request.env.user.partner_id
            self._attach_cart_to_customer(customer)
            return self._reply({"id": customer.id, "name": customer.name, "email": customer.email or "", "phone": customer.phone or ""}, status=201)

        if key == "auth/logout" and method == "POST":
            request.session.logout(keep_db=True)
            return self._reply({"logged_in": False})

        if key == "cart" and method == "GET":
            order = self._cart_order(create=True)
            return self._reply(self._cart_snapshot(order))

        if key == "orders" and method == "GET":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk ke akun.", 401)
            partner_ids = partner.commercial_partner_id | partner.commercial_partner_id.child_ids
            # A successful Xendit callback can mark the transaction done just before
            # Odoo's payment post-processing confirms the quotation. Include that
            # short-lived state so a paid order never disappears from order history.
            orders = request.env["sale.order"].sudo().search([
                ("partner_id", "in", partner_ids.ids),
                ("website_id", "=", request.env.website.id),
                "|", ("state", "!=", "draft"), ("transaction_ids.state", "=", "done"),
            ], order="date_order desc, id desc", limit=100)
            summaries = []
            for order in orders:
                transaction = order.get_portal_last_transaction()
                status = "Dibayar · menunggu diproses" if order.state == "draft" and transaction and transaction.state == "done" else order.state
                summaries.append({"id": order.id, "name": order.name, "date": order.date_order.isoformat(), "status": status, "progress_status": self._order_progress(order), "total": self._money(order.amount_total, order.currency_id)})
            return self._reply(summaries)

        if key.startswith("orders/") and key.endswith("/cancel") and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk ke akun.", 401)
            try:
                order_id = int(key.split("/")[1])
            except (IndexError, ValueError):
                order_id = 0
            allowed_partners = partner.commercial_partner_id | partner.commercial_partner_id.child_ids
            order = request.env["sale.order"].sudo().search([("id", "=", order_id), ("partner_id", "in", allowed_partners.ids), ("website_id", "=", request.env.website.id)], limit=1)
            if not order:
                return self._fail("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404)
            progress = self._order_progress(order)
            if progress not in ("pending_payment", "paid"):
                return self._fail("CANCELLATION_CLOSED", "Permintaan pembatalan hanya tersedia sebelum pesanan mulai disiapkan.", 409)
            if order.dsayur_cancel_requested_at:
                return self._fail("CANCELLATION_ALREADY_REQUESTED", "Permintaan pembatalan pesanan ini sudah tercatat.", 409)
            reason = self._payload().get("reason") or ""
            if not isinstance(reason, str):
                return self._fail("CANCELLATION_INVALID", "Alasan pembatalan tidak valid.", 400)
            reason = reason.strip()[:500]
            order.sudo().write({"dsayur_cancel_requested_at": fields.Datetime.now(), "dsayur_cancel_reason": reason})
            order.sudo().message_post(body="Permintaan pembatalan dari pelanggan.<br/>Alasan: %s" % html.escape(reason or "Tidak dicantumkan"))
            return self._reply({"cancellation_requested": True, "cancellation_requested_at": order.dsayur_cancel_requested_at.isoformat()})

        if key.startswith("orders/") and key.endswith("/received") and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk ke akun.", 401)
            try:
                order_id = int(key.split("/")[1])
            except (IndexError, ValueError):
                order_id = 0
            allowed_partners = partner.commercial_partner_id | partner.commercial_partner_id.child_ids
            order = request.env["sale.order"].sudo().search([("id", "=", order_id), ("partner_id", "in", allowed_partners.ids), ("website_id", "=", request.env.website.id)], limit=1)
            if not order:
                return self._fail("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404)
            if not order.dsayur_mark_received():
                return self._fail("ORDER_NOT_DELIVERED", "Pesanan belum berstatus terkirim atau masih menunggu validasi.", 409)
            return self._reply({"progress_status": "completed"})

        if key.startswith("orders/") and method == "GET":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk ke akun.", 401)
            try:
                order_id = int(key.rsplit("/", 1)[-1])
            except ValueError:
                order_id = 0
            allowed_partners = partner.commercial_partner_id | partner.commercial_partner_id.child_ids
            order = request.env["sale.order"].sudo().search([("id", "=", order_id), ("partner_id", "in", allowed_partners.ids), ("website_id", "=", request.env.website.id)], limit=1)
            if not order:
                return self._fail("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404)
            transaction = order.get_portal_last_transaction()
            pickings = order.picking_ids.filtered(lambda picking: picking.picking_type_code == "outgoing")
            cancellation_status = False
            if order.dsayur_cancel_requested_at:
                refund_due = bool(transaction and transaction.state == "done") and (
                    order.state == "cancel" or bool(pickings and all(picking.state == "cancel" for picking in pickings))
                )
                if refund_due:
                    cancellation_status = {
                        "succeeded": "refunded",
                        "manual_done": "manual_refunded",
                        "failed": "refund_failed",
                        "unknown": "refund_review",
                    }.get(order.dsayur_refund_status, "refund_pending")
                else:
                    cancellation_status = "cancelled" if order.state == "cancel" else "review"
            return self._reply({
                "id": order.id,
                "name": order.name,
                "date": order.date_order.isoformat(),
                "status": order.state,
                "progress_status": self._order_progress(order),
                "cancellation_requested": bool(order.dsayur_cancel_requested_at),
                "cancellation_reason": order.dsayur_cancel_reason or "",
                "cancellation_status": cancellation_status,
                "can_request_cancellation": self._order_progress(order) in ("pending_payment", "paid") and not order.dsayur_cancel_requested_at,
                "can_confirm_received": self._order_progress(order) == "delivered",
                "payment_status": transaction.state if transaction else "no_transaction",
                "payment_method": transaction.provider_id.name if transaction else "",
                "payment_instructions": html2plaintext(transaction.provider_id.pending_msg or "").strip() if transaction and transaction.state == "pending" else "",
                "shipping_address": {
                    "name": order.partner_shipping_id.name or "",
                    "phone": order.partner_shipping_id.phone or order.partner_shipping_id.mobile or "",
                    "street": order.partner_shipping_id.street or "",
                    "street2": order.partner_shipping_id.street2 or "",
                    "city": order.partner_shipping_id.city or "",
                    "zip": order.partner_shipping_id.zip or "",
                    "latitude": order.partner_shipping_id.partner_latitude or None,
                    "longitude": order.partner_shipping_id.partner_longitude or None,
                },
                "fulfillment": [{
                    "reference": picking.name,
                    "status": picking.state,
                    "scheduled_date": picking.scheduled_date.isoformat() if picking.scheduled_date else None,
                    "completed_date": picking.date_done.isoformat() if picking.date_done else None,
                } for picking in pickings],
                "cart": self._cart_snapshot(order),
            })

        if key == "reorder-suggestions" and method == "GET":
            if not partner:
                return self._reply({"items": []})
            partner_ids = partner.commercial_partner_id | partner.commercial_partner_id.child_ids
            orders = request.env["sale.order"].sudo().search([("partner_id", "in", partner_ids.ids), ("website_id", "=", request.env.website.id), ("state", "in", ["sale", "done"])], order="date_order desc", limit=5)
            templates = request.env["product.template"]
            for order in orders:
                templates |= order.order_line.filtered(lambda line: not line.is_delivery and not line.display_type and not line.is_reward_line).mapped("product_id.product_tmpl_id")
            allowed = templates.filtered(lambda item: item.sale_ok and item.is_published and item.product_variant_id)[:8]
            return self._reply({"items": [self._public_product(item.product_variant_id) for item in allowed]})

        if key.startswith("orders/") and key.endswith("/reorder") and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk ke akun.", 401)
            try:
                order_id = int(key.split("/")[1])
            except (IndexError, ValueError):
                order_id = 0
            allowed_partners = partner.commercial_partner_id | partner.commercial_partner_id.child_ids
            previous = request.env["sale.order"].sudo().search([("id", "=", order_id), ("partner_id", "in", allowed_partners.ids), ("website_id", "=", request.env.website.id)], limit=1)
            if not previous:
                return self._fail("ORDER_NOT_FOUND", "Pesanan tidak ditemukan.", 404)
            cart = self._cart_order(create=True)
            added, skipped = 0, []
            for line in previous.order_line.filtered(lambda row: not row.is_delivery and not row.display_type and not row.is_reward_line):
                try:
                    with request.env.cr.savepoint():
                        cart._cart_add(line.product_id.id, line.product_uom_qty)
                    added += 1
                except Exception:
                    skipped.append(line.product_id.display_name)
            if not added:
                return self._fail("REORDER_UNAVAILABLE", "Produk dari pesanan ini sedang tidak tersedia.", 409)
            return self._reply({"cart": self._cart_snapshot(cart), "added": added, "skipped": skipped})

        if key == "checkout/payment" and method == "GET":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk ke akun.", 401)
            order = self._cart_order()
            problem = self._checkout_incomplete(order, partner)
            if problem:
                return problem
            providers = self._payment_providers(order)
            if not providers:
                return self._fail("PAYMENT_NOT_CONFIGURED", "Metode pembayaran belum diaktifkan di Odoo.", 503)
            return self._reply({"providers": providers})

        if key == "checkout/transaction" and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk ke akun.", 401)
            order = self._cart_order()
            problem = self._checkout_incomplete(order, partner)
            if problem:
                return problem
            try:
                provider_id, method_id = int(payload.get("provider_id", 0)), int(payload.get("payment_method_id", 0))
            except (TypeError, ValueError):
                provider_id = method_id = 0
            chosen = next((item for item in self._payment_providers(order) if item["id"] == provider_id and method_id in [row["id"] for row in item["methods"]]), None)
            if not chosen:
                return self._fail("PAYMENT_METHOD_INVALID", "Metode pembayaran tidak tersedia untuk pesanan ini.", 400)
            currency = order.currency_id
            amount = currency.round(max(0.0, order.amount_total - order.amount_paid))
            if amount <= 0 or order._is_paid():
                return self._fail("ORDER_ALREADY_PAID", "Pesanan ini sudah dibayar.", 409)
            provider = request.env["payment.provider"].sudo().browse(provider_id)
            Transaction = request.env["payment.transaction"].sudo()
            flow = "direct" if provider.code == "custom" else "redirect"
            try:
                with request.env.cr.savepoint():
                    transaction = Transaction.create({
                        "provider_id": provider.id,
                        "payment_method_id": method_id,
                        "reference": Transaction._compute_reference(provider.code, sale_order_ids=[Command.set([order.id])]),
                        "amount": amount,
                        "currency_id": currency.id,
                        "partner_id": order.partner_invoice_id.id,
                        "operation": f"online_{flow}",
                        "landing_route": f"/dsayur/return?order_id={order.id}",
                        "sale_order_ids": [Command.set([order.id])],
                    })
                    transaction._log_sent_message()
                    if provider.code == "custom" and provider.custom_mode == "cash_on_delivery":
                        # Odoo 20 protects transaction state changes; route this through
                        # the provider's normal notification processing instead.
                        transaction._record({"reference": transaction.reference})
                        order.action_confirm()
                        redirect_url = None
                    elif provider.code == "custom":
                        transaction._record({"reference": transaction.reference})
                        redirect_url = None
                    else:
                        form = transaction._get_processing_values().get("redirect_form_html") or ""
                        action = re.search(r'action="([^"]+)"', str(form))
                        if not action or "<input" in str(form):
                            # Providers such as Xendit record the API error on the transaction and return an empty form.
                            raise ValueError(transaction.state_message or "provider requires a posted form")
                        redirect_url = action.group(1).replace("&amp;", "&")
            except Exception as error:
                _logger.info("Odoo payment transaction rejected order=%s provider=%s", order.id, provider_id, exc_info=True)
                detail = str(error)
                if "HTTPS" in detail or "INVALID_URL" in detail:
                    return self._fail("PAYMENT_NEEDS_HTTPS", "Xendit hanya menerima alamat HTTPS publik. Atur System Parameter web.base.url Odoo ke URL HTTPS (misalnya lewat tunnel) agar pembayaran Xendit bisa dimulai.", 409)
                if (
                    "INVALID_PAYMENT_CHANNEL" in detail
                    or "no available channels" in detail.lower()
                    or "are not available" in detail.lower()
                ):
                    return self._fail("PAYMENT_CHANNEL_UNAVAILABLE", "Kanal pembayaran belum aktif pada akun pembayaran toko. Silakan coba lagi atau hubungi pengelola toko.", 409)
                return self._fail("PAYMENT_START_FAILED", "Pembayaran belum dapat dimulai. Coba kanal lain atau ulangi sebentar lagi.", 409)
            if provider.code == "custom":
                request.env.website.sale_reset()
            return self._reply({"completed": redirect_url is None, "redirect_url": redirect_url, "order_id": order.id, "order_number": order.name}, status=201)

        if key == "cart/lines" and method == "POST":
            try:
                product_id, quantity = int(payload.get("product_id", 0)), float(payload.get("quantity", 1))
            except (TypeError, ValueError):
                return self._fail("INVALID_REQUEST", "Varian atau jumlah produk tidak valid.", 400)
            if product_id <= 0 or quantity <= 0 or quantity > 100:
                return self._fail("INVALID_REQUEST", "Varian atau jumlah produk tidak valid.", 400)
            order = self._cart_order(create=True)
            try:
                order._cart_add(product_id, quantity)
            except Exception:
                _logger.info("Odoo native cart add rejected product=%s", product_id, exc_info=True)
                return self._fail("PRODUCT_NOT_AVAILABLE", "Produk atau stok tidak tersedia.", 409)
            return self._reply(self._cart_snapshot(order))

        if len(key.split("/")) == 3 and key.startswith("cart/lines/") and method in ("PATCH", "DELETE"):
            line_id = int(key.rsplit("/", 1)[-1])
            order = self._cart_order()
            line = order.order_line.filtered(lambda row: row.id == line_id and not row.is_delivery) if order else False
            if not line:
                return self._fail("CART_LINE_NOT_FOUND", "Item keranjang tidak ditemukan.", 404)
            if method == "PATCH" and "note" in payload:
                note = payload.get("note")
                if not isinstance(note, str) or len(note.strip()) > 200:
                    return self._fail("NOTE_INVALID", "Catatan maksimal 200 karakter.", 400)
                line.sudo().dsayur_set_note(note.strip())
                if "quantity" not in payload:
                    return self._reply(self._cart_snapshot(order))
            quantity = 0 if method == "DELETE" else float(payload.get("quantity", -1))
            if quantity < 0 or quantity > 100:
                return self._fail("INVALID_REQUEST", "Jumlah tidak valid.", 400)
            try:
                order._cart_update_line_quantity(line.id, quantity)
            except Exception:
                return self._fail("OUT_OF_STOCK", "Stok tidak mencukupi.", 409)
            return self._reply(self._cart_snapshot(order))

        if key == "checkout" and method == "GET":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk melanjutkan checkout.", 401)
            order = self._cart_order(create=True)
            commercial = partner.commercial_partner_id
            branches = request.env["dsayur.store.branch"].sudo().search([("active", "=", True)], order="sequence, id")
            branch = commercial.dsayur_default_branch_id
            if branch not in branches:
                branch = branches[:1]
                if branch:
                    commercial.sudo().write({"dsayur_default_branch_id": branch.id})
            if branch and order.dsayur_branch_id != branch:
                order.sudo().write({"dsayur_branch_id": branch.id})
            addresses = commercial.child_ids.filtered(lambda row: row.type in ("delivery", "other"))
            if commercial.contact_address:
                addresses |= commercial
            addresses = addresses.sorted("id")
            default_address = commercial.dsayur_default_delivery_address_id
            if default_address not in addresses:
                default_address = addresses[:1]
            if not order.dsayur_is_gift and default_address and commercial.dsayur_default_delivery_address_id != default_address:
                commercial.sudo().write({"dsayur_default_delivery_address_id": default_address.id})
            if not order.dsayur_is_gift and default_address and order.partner_shipping_id != default_address:
                order._update_address(default_address.id, ["partner_shipping_id"])
            selected_address = order.partner_shipping_id if order.dsayur_is_gift and order.partner_shipping_id in addresses else default_address
            countries = request.env["res.country"].sudo().search_read([("code", "=", "ID")], ["id", "name", "code"], limit=1)
            loyalty_program = request.env.ref("dsayur_headless.dsayur_loyalty_program", raise_if_not_found=False)
            loyalty_cards = request.env["loyalty.card"].sudo().search([("program_id", "=", loyalty_program.id), ("partner_id", "in", (partner.commercial_partner_id | partner.commercial_partner_id.child_ids).ids), ("active", "=", True)]) if loyalty_program else request.env["loyalty.card"]
            silver_program = request.env.ref("dsayur_headless.dsayur_silver_voucher_program", raise_if_not_found=False)
            gold_program = request.env.ref("dsayur_headless.dsayur_gold_voucher_program", raise_if_not_found=False)
            voucher_program_ids = (silver_program | gold_program).ids
            vouchers = request.env["loyalty.card"].sudo().search([("program_id", "in", voucher_program_ids), ("partner_id", "in", (partner.commercial_partner_id | partner.commercial_partner_id.child_ids).ids), ("active", "=", True), ("points", ">", 0.99)]) if voucher_program_ids else request.env["loyalty.card"]
            carriers = order._get_delivery_methods()
            delivery_methods = []
            for carrier in carriers:
                rate = carrier.rate_shipment(order)
                if not rate.get("success"):
                    continue
                delivery_methods.append({
                    "id": carrier.id,
                    "name": carrier.name,
                    "price": self._money(rate.get("price", carrier.fixed_price), order.currency_id),
                    "requires_slot": carrier.delivery_type == "dsayur_routes",
                })
            member_tier = partner.commercial_partner_id.dsayur_tier or "bronze"
            slots = request.env["dsayur.delivery.slot"].sudo().search([("active", "=", True), ("start_at", ">", fields.Datetime.now()), "|", ("branch_id", "=", False), ("branch_id", "=", branch.id if branch else 0)], order="start_at", limit=80)
            slots = slots.filtered(lambda slot: slot.priority_tier == "all" or member_tier == "gold")
            route_carrier = request.env["delivery.carrier"].sudo().search([("delivery_type", "=", "dsayur_routes")], limit=1)
            branch_eta = route_carrier.dsayur_area_estimate(order.partner_shipping_id.partner_latitude, order.partner_shipping_id.partner_longitude, branch) if route_carrier and branch and order.partner_shipping_id.partner_latitude and order.partner_shipping_id.partner_longitude else None
            return self._reply({
                "cart": self._cart_snapshot(order),
                "default_address_id": selected_address.id or None,
                "substitution_policy": order.dsayur_substitution_policy or "contact_first",
                "substitution_note": order.dsayur_substitution_note or "",
                "is_gift": order.dsayur_is_gift,
                "stock_issues": self._checkout_stock_issues(order),
                "loyalty_cards": [{"id": card.id, "points": card.points} for card in loyalty_cards if card.points >= 1],
                "redeemed_points_card_id": next((line.coupon_id.id for line in order.order_line if line.coupon_id and line.coupon_id.program_id == loyalty_program and line.reward_id and line.reward_id.discount_mode == "per_point"), None),
                "redeemed_points_discount": (self._money(sum(abs(line.price_total) for line in order.order_line if line.coupon_id and line.coupon_id.program_id == loyalty_program and line.reward_id and line.reward_id.discount_mode == "per_point"), order.currency_id) if any(line.coupon_id and line.coupon_id.program_id == loyalty_program and line.reward_id and line.reward_id.discount_mode == "per_point" for line in order.order_line) else None),
                "vouchers": [{"id": card.id, "name": card.program_id.name, "value": card.program_id.reward_ids[:1].discount} for card in vouchers if not card.expiration_date or card.expiration_date >= fields.Date.context_today(request.env.user.with_context(tz="Asia/Jakarta"))],
                "addresses": [{"id": row.id, "name": row.name or partner.name, "label": row.dsayur_address_label or "", "street": row.street or "", "street2": row.street2 or "", "city": row.city or "", "zip": row.zip or "", "phone": row.phone or partner.phone or "", "country_id": row.country_id.id, "country": row.country_id.name, "state_id": row.state_id.id or False, "latitude": row.partner_latitude, "longitude": row.partner_longitude} for row in addresses],
                "delivery_methods": delivery_methods,
                "branch": self._branch_payload(branch) if branch else None,
                "branches": [self._branch_payload(item) for item in branches],
                "eta": ({"min_minutes": branch_eta["eta_min"], "max_minutes": branch_eta["eta_max"], "distance_km": branch_eta["distance_km"]} if branch_eta else None),
                "delivery_slots": [{"id": slot.id, "name": slot.name, "start_at": fields.Datetime.to_string(slot.start_at), "end_at": fields.Datetime.to_string(slot.end_at), "remaining": max(0, slot.capacity - request.env["sale.order"].sudo().search_count(slot._active_order_domain(order.id))), "priority_tier": slot.priority_tier, "branch_id": slot.branch_id.id or None} for slot in slots if request.env["sale.order"].sudo().search_count(slot._active_order_domain(order.id)) < slot.capacity],
                "countries": countries,
            })

        if key == "checkout/gift" and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk mengatur pesanan hadiah.", 401)
            order = self._cart_order()
            if not order or order.partner_id.commercial_partner_id != partner.commercial_partner_id:
                return self._fail("CART_NOT_FOUND", "Keranjang aktif tidak ditemukan.", 404)
            is_gift = payload.get("is_gift")
            if not isinstance(is_gift, bool):
                return self._fail("GIFT_OPTION_INVALID", "Pilihan hadiah tidak valid.", 400)
            order.sudo().write({"dsayur_is_gift": is_gift})
            return self._reply({"is_gift": order.dsayur_is_gift})

        if key == "checkout/preferences" and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk ke akun.", 401)
            order = self._cart_order()
            if not order or not order.order_line.filtered(lambda line: not line.is_delivery and not line.display_type):
                return self._fail("CART_EMPTY", "Keranjang tidak tersedia.", 400)
            if order.partner_id.commercial_partner_id != partner.commercial_partner_id:
                return self._fail("FORBIDDEN", "Keranjang ini bukan milik akun Anda.", 403)
            policy = payload.get("substitution_policy")
            note = payload.get("substitution_note", "")
            is_gift = payload.get("is_gift", order.dsayur_is_gift)
            allowed = {"contact_first", "similar_ok", "no_substitute"}
            if policy not in allowed or not isinstance(note, str) or len(note) > 500 or not isinstance(is_gift, bool):
                return self._fail("PREFERENCES_INVALID", "Pilih kebijakan pengganti yang tersedia; catatan maksimal 500 karakter.", 400)
            order.sudo().write({
                "dsayur_substitution_policy": policy,
                "dsayur_substitution_note": note.strip(),
                "dsayur_is_gift": is_gift,
            })
            if policy in ("similar_ok", "no_substitute"):
                issues = {issue["line_id"]: issue for issue in self._checkout_stock_issues(order)}
                lines = {line.id: line for line in order.order_line if line.id in issues}
                try:
                    for line_id, issue in issues.items():
                        line = lines[line_id]
                        alternative = False
                        if policy == "similar_ok" and issue["alternatives"]:
                            alternative_data = min(issue["alternatives"], key=lambda item: abs(item["price"]["amount"] - line.price_unit))
                            alternative = request.env["product.product"].sudo().browse(alternative_data["id"])
                            order._cart_add(alternative.id, line.product_uom_qty)
                        elif policy == "similar_ok":
                            continue
                        order._cart_update_line_quantity(line.id, 0)
                    if order.carrier_id:
                        rate = order.carrier_id.rate_shipment(order)
                        if not rate.get("success"):
                            raise ValueError("delivery rate invalid")
                        order._set_delivery_method(order.carrier_id)
                except Exception:
                    request.env.cr.rollback()
                    _logger.info("Odoo automatic substitution failed order=%s", order.id, exc_info=True)
                    return self._fail("SUBSTITUTION_STOCK_CHANGED", "Stok berubah. Muat ulang checkout untuk memilih ulang item.", 409)
            return self._reply({"substitution_policy": policy, "substitution_note": note.strip(), "is_gift": is_gift, "cart": self._cart_snapshot(order), "stock_issues": self._checkout_stock_issues(order)})

        if key == "checkout/redeem-points" and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk menukar poin.", 401)
            order = self._cart_order()
            if not order or order.partner_id.commercial_partner_id != partner.commercial_partner_id:
                return self._fail("CART_NOT_FOUND", "Keranjang aktif tidak ditemukan.", 404)
            action = payload.get("action", "apply")
            if action not in ("apply", "remove"):
                return self._fail("LOYALTY_ACTION_INVALID", "Tindakan poin tidak valid.", 400)
            try:
                card_id = int(payload.get("card_id", 0))
            except (TypeError, ValueError):
                card_id = 0
            member = partner.commercial_partner_id
            program = request.env.ref("dsayur_headless.dsayur_loyalty_program", raise_if_not_found=False)
            card = request.env["loyalty.card"].sudo().search([("id", "=", card_id), ("program_id", "=", program.id if program else 0), ("partner_id", "in", (member | member.child_ids).ids), ("active", "=", True)], limit=1)
            if not card or (action == "apply" and card.points < 1):
                return self._fail("LOYALTY_CARD_INVALID", "Kartu poin tidak tersedia atau saldonya belum cukup.", 400)
            if action == "remove":
                reward_lines = order.order_line.filtered(lambda line: line.coupon_id == card and line.reward_id and line.reward_id.discount_mode == "per_point")
                if not reward_lines:
                    return self._fail("LOYALTY_NOT_APPLIED", "Penukaran poin tidak ditemukan pada pesanan ini.", 409)
                reward_lines.unlink()
                if card in order.applied_coupon_ids:
                    order.applied_coupon_ids -= card
                order._update_programs_and_rewards()
                return self._reply({"cart": self._cart_snapshot(order), "redeemed_points_card_id": None})
            if order.order_line.filtered(lambda line: line.coupon_id == card):
                return self._fail("LOYALTY_ALREADY_APPLIED", "Kartu poin sudah diterapkan pada pesanan ini.", 409)
            reward = card.program_id.reward_ids.filtered(lambda item: item.reward_type == "discount" and item.discount_mode == "per_point")[:1]
            if not reward:
                return self._fail("LOYALTY_NOT_CONFIGURED", "Hadiah penukaran poin belum dikonfigurasi di Odoo.", 503)
            try:
                order.applied_coupon_ids |= card
                result = order._apply_program_reward(reward, card)
                if result.get("error"):
                    request.env.cr.rollback()
                    return self._fail("LOYALTY_REDEMPTION_FAILED", "Poin tidak dapat ditukar untuk keranjang ini.", 409)
                order._update_programs_and_rewards()
            except Exception:
                request.env.cr.rollback()
                _logger.info("Odoo native loyalty redemption failed order=%s", order.id, exc_info=True)
                return self._fail("LOYALTY_REDEMPTION_FAILED", "Poin tidak dapat ditukar untuk keranjang ini.", 409)
            return self._reply(self._cart_snapshot(order))

        if key == "checkout/redeem-voucher" and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk memakai voucher.", 401)
            order = self._cart_order()
            if not order or order.partner_id.commercial_partner_id != partner.commercial_partner_id:
                return self._fail("CART_NOT_FOUND", "Keranjang aktif tidak ditemukan.", 404)
            try:
                voucher_id = int(payload.get("voucher_id", 0))
            except (TypeError, ValueError):
                voucher_id = 0
            silver = request.env.ref("dsayur_headless.dsayur_silver_voucher_program", raise_if_not_found=False)
            gold = request.env.ref("dsayur_headless.dsayur_gold_voucher_program", raise_if_not_found=False)
            program_ids = (silver | gold).ids
            owner_ids = (partner.commercial_partner_id | partner.commercial_partner_id.child_ids).ids
            voucher = request.env["loyalty.card"].sudo().search([("id", "=", voucher_id), ("program_id", "in", program_ids), ("partner_id", "in", owner_ids), ("active", "=", True), ("points", ">", 0.99)], limit=1)
            today = fields.Date.context_today(partner.with_context(tz="Asia/Jakarta"))
            if not voucher or (voucher.expiration_date and voucher.expiration_date < today):
                return self._fail("VOUCHER_INVALID", "Voucher tidak aktif, kedaluwarsa, atau bukan milik akun Anda.", 400)
            if order.order_line.filtered(lambda line: line.coupon_id == voucher):
                return self._fail("VOUCHER_ALREADY_APPLIED", "Voucher sudah diterapkan pada pesanan ini.", 409)
            reward = voucher.program_id.reward_ids[:1]
            try:
                order.applied_coupon_ids |= voucher
                result = order._apply_program_reward(reward, voucher)
                if result.get("error"):
                    request.env.cr.rollback()
                    return self._fail("VOUCHER_NOT_APPLICABLE", "Voucher tidak dapat diterapkan ke nilai keranjang ini.", 409)
                order._update_programs_and_rewards()
            except Exception:
                request.env.cr.rollback()
                _logger.info("Odoo native tier voucher failed order=%s", order.id, exc_info=True)
                return self._fail("VOUCHER_NOT_APPLICABLE", "Voucher tidak dapat diterapkan ke nilai keranjang ini.", 409)
            return self._reply(self._cart_snapshot(order))

        if key == "checkout/promo-code" and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk untuk memakai kode promo.", 401)
            order = self._cart_order()
            if not order or order.partner_id.commercial_partner_id != partner.commercial_partner_id:
                return self._fail("CART_NOT_FOUND", "Keranjang aktif tidak ditemukan.", 404)
            code = payload.get("code")
            if not isinstance(code, str) or not code.strip() or len(code.strip()) > 64:
                return self._fail("PROMO_CODE_INVALID", "Masukkan kode promo yang valid.", 400)
            try:
                status = order._try_apply_code(code.strip())
                if not status or status.get("error"):
                    loyalty_card = request.env["loyalty.card"].sudo().search([("code", "=", code.strip())], limit=1)
                    request.env.cr.rollback()
                    if loyalty_card and loyalty_card.program_id.program_type == "loyalty":
                        return self._reply({"applied": False, "message": "Kode ini adalah kartu D-Sayur Member Rewards untuk mengumpulkan poin, bukan kupon diskon. Untuk menukar poin, gunakan tombol Pakai poin."})
                    return self._reply({"applied": False, "message": "Kode promo tidak berlaku untuk akun atau keranjang ini. Periksa kode dan syarat minimum belanja."})
                coupons = request.env["loyalty.card"]
                rewards = request.env["loyalty.reward"]
                for coupon, available_rewards in status.items():
                    coupons |= coupon
                    rewards |= available_rewards
                if len(coupons) != 1 or len(rewards) != 1:
                    request.env.cr.rollback()
                    return self._reply({"applied": False, "message": "Promo ini memiliki beberapa hadiah dan belum bisa dipilih otomatis. Gunakan kode promo lain."})
                result = order._apply_program_reward(rewards, coupons)
                if result.get("error"):
                    request.env.cr.rollback()
                    return self._reply({"applied": False, "message": "Kode promo belum memenuhi syarat minimum pesanan."})
                order._update_programs_and_rewards()
            except Exception:
                request.env.cr.rollback()
                _logger.info("Odoo native promo code failed order=%s", order.id, exc_info=True)
                return self._reply({"applied": False, "message": "Kode promo tidak dapat diterapkan saat ini. Silakan coba lagi."})
            return self._reply({"applied": True, "message": "Kode promo berhasil diterapkan. Total pesanan sudah diperbarui.", "cart": self._cart_snapshot(order)})

        if key == "checkout/substitutions" and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk ke akun.", 401)
            order = self._cart_order()
            if not order or order.partner_id.commercial_partner_id != partner.commercial_partner_id:
                return self._fail("CART_NOT_FOUND", "Keranjang aktif tidak ditemukan.", 404)
            actions = payload.get("actions")
            if not isinstance(actions, list) or not actions or len(actions) > 30:
                return self._fail("SUBSTITUTION_INVALID", "Pilih tindakan untuk item yang stoknya kurang.", 400)
            issues = {issue["line_id"]: issue for issue in self._checkout_stock_issues(order)}
            resolved = []
            seen = set()
            for action in actions:
                try:
                    line_id = int(action.get("line_id", 0))
                    product_id = int(action.get("product_id", 0)) if action.get("product_id") else 0
                except (AttributeError, TypeError, ValueError):
                    return self._fail("SUBSTITUTION_INVALID", "Pilihan produk pengganti tidak valid.", 400)
                line = order.order_line.filtered(lambda row: row.id == line_id and not row.is_delivery and not row.display_type)
                if line_id in seen or line_id not in issues or not line:
                    return self._fail("SUBSTITUTION_INVALID", "Item sudah berubah atau tidak lagi memerlukan pengganti.", 409)
                seen.add(line_id)
                alternative = request.env["product.product"].sudo().browse(product_id).exists() if product_id else False
                if product_id and product_id not in {candidate["id"] for candidate in issues[line_id]["alternatives"]}:
                    return self._fail("SUBSTITUTION_INVALID", "Produk alternatif harus sejenis, tayang, dan stoknya cukup.", 409)
                resolved.append((line, alternative))
            if seen != set(issues):
                return self._fail("SUBSTITUTION_INCOMPLETE", "Tentukan pengganti atau hapus semua item yang stoknya kurang.", 400)
            try:
                for line, alternative in resolved:
                    quantity = line.product_uom_qty
                    if alternative:
                        order._cart_add(alternative.id, quantity)
                    order._cart_update_line_quantity(line.id, 0)
                if order.carrier_id:
                    rate = order.carrier_id.rate_shipment(order)
                    if not rate.get("success"):
                        raise ValueError("delivery rate invalid")
                    order._set_delivery_method(order.carrier_id)
            except Exception:
                request.env.cr.rollback()
                _logger.info("Odoo cart substitution failed order=%s", order.id, exc_info=True)
                return self._fail("SUBSTITUTION_STOCK_CHANGED", "Stok berubah saat mengganti item. Muat ulang checkout dan pilih kembali.", 409)
            return self._reply({"cart": self._cart_snapshot(order), "stock_issues": self._checkout_stock_issues(order)})

        if key == "checkout/address" and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk ke akun.", 401)
            name = (payload.get("name") or "").strip()
            street = (payload.get("street") or "").strip()
            city = (payload.get("city") or "").strip()
            zip_code = (payload.get("zip") or "").strip()
            if not name or not street or not city or not zip_code:
                return self._fail("ADDRESS_INVALID", "Nama, alamat, kota, dan kode pos wajib diisi.", 400)
            commercial = partner.commercial_partner_id
            Address = request.env["res.partner"].sudo()
            address_id = payload.get("address_id")
            address = False
            if address_id:
                try:
                    address = Address.browse(int(address_id)).exists()
                except (TypeError, ValueError):
                    address = False
                if not address or address.commercial_partner_id != commercial or not address.active or address.type not in ("delivery", "other"):
                    return self._fail("ADDRESS_NOT_FOUND", "Alamat tidak ditemukan.", 404)
            try:
                latitude = float(payload.get("latitude")) if payload.get("latitude") not in (None, "") else None
                longitude = float(payload.get("longitude")) if payload.get("longitude") not in (None, "") else None
                if latitude is None or longitude is None:
                    raise ValueError
                if not math.isfinite(latitude) or not math.isfinite(longitude) or not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                    raise ValueError
            except (TypeError, ValueError):
                if not address_id:
                    return self._fail("ADDRESS_PIN_REQUIRED", "Tandai pin lokasi alamat yang valid sebelum menyimpan.", 400)
                latitude = longitude = None
            if address_id:
                values = {"name": name, "dsayur_address_label": (payload.get("label") or "").strip()[:80], "street": street, "street2": (payload.get("street2") or "").strip(), "city": city, "zip": zip_code, "phone": (payload.get("phone") or "").strip()}
                if latitude is not None and longitude is not None:
                    values.update({"partner_latitude": latitude, "partner_longitude": longitude})
                address.write(values)
            else:
                country = request.env["res.country"].sudo().search([("code", "=", "ID")], limit=1)
                if not country:
                    return self._fail("ADDRESS_INVALID", "Pilih negara yang valid.", 400)
                address = Address.create({
                    "parent_id": commercial.id,
                    "type": "delivery",
                    "name": name,
                    "dsayur_address_label": (payload.get("label") or "").strip()[:80],
                    "street": street,
                    "street2": (payload.get("street2") or "").strip(),
                    "city": city,
                    "zip": zip_code,
                    "phone": (payload.get("phone") or "").strip(),
                    "country_id": country.id,
                    "partner_latitude": latitude,
                    "partner_longitude": longitude,
                })
            if not commercial.country_id:
                # Payment providers (e.g. Xendit) read the billing country from the customer record.
                commercial.sudo().country_id = address.country_id
            order = self._cart_order()
            if not order:
                return self._fail("CART_EMPTY", "Keranjang tidak tersedia.", 400)
            order._update_address(address.id, ["partner_shipping_id"])
            if not order.dsayur_is_gift:
                commercial.sudo().write({"dsayur_default_delivery_address_id": address.id})
            return self._reply({"address_id": address.id})

        if key == "checkout/delivery" and method == "POST":
            if not partner:
                return self._fail("AUTHENTICATION_REQUIRED", "Silakan masuk ke akun.", 401)
            try:
                carrier_id = int(payload.get("carrier_id", 0))
                slot_id = int(payload.get("slot_id", 0))
            except (TypeError, ValueError):
                carrier_id = 0
            order = self._cart_order()
            if not order or not order.partner_shipping_id:
                return self._fail("CHECKOUT_INCOMPLETE", "Simpan alamat pengiriman dahulu.", 400)
            carrier = order._get_delivery_methods().filtered(lambda item: item.id == carrier_id)
            if not carrier:
                return self._fail("SHIPPING_UNAVAILABLE", "Metode pengiriman tidak tersedia untuk alamat ini.", 400)
            slot = request.env["dsayur.delivery.slot"]
            if carrier.delivery_type == "dsayur_routes":
                slot = slot.sudo().browse(slot_id).exists()
                if not slot or (slot.branch_id and slot.branch_id != order.dsayur_branch_id) or not slot.reserve_for_order(order, partner.commercial_partner_id.dsayur_tier or "bronze"):
                    return self._fail("DELIVERY_SLOT_UNAVAILABLE", "Slot tersebut sudah penuh atau tidak tersedia. Pilih slot lain.", 409)
            elif order.dsayur_delivery_slot_id:
                order.sudo().write({"dsayur_delivery_slot_id": False, "dsayur_delivery_slot_reserved_at": False})
            order._set_delivery_method(carrier)
            if order._has_deliverable_products() and not order.order_line.filtered("is_delivery"):
                if carrier.delivery_type == "dsayur_routes":
                    order.sudo().write({"dsayur_delivery_slot_id": False, "dsayur_delivery_slot_reserved_at": False})
                return self._fail("SHIPPING_UNAVAILABLE", "Odoo belum dapat menghitung tarif pengiriman untuk alamat ini.", 409)
            return self._reply(self._cart_snapshot(order))

        # Checkout, account signup, admin and orders are intentionally not simulated here.
        # They are added only through native Odoo flows/configuration, never a shadow Next DB.
        return self._fail("ODOO_FLOW_NOT_CONFIGURED", "Alur ini belum dikonfigurasi di Odoo Community 20.", 501)

    @http.route("/dsayur/api/<path:path>", type="http", auth="public", website=True, methods=["GET", "POST", "PATCH", "DELETE"], csrf=False, save_session=True)
    def api(self, path, **kwargs):
        if not self._authorized():
            return self._fail("FORBIDDEN", "API key tidak valid.", 403)
        expected_db = request.httprequest.headers.get("X-DSayur-Database", "")
        if expected_db and expected_db != request.db:
            return self._fail("DATABASE_MISMATCH", "Database Odoo pada request tidak sesuai konfigurasi storefront.", 421)
        try:
            return self._dispatch(path)
        except ValueError as error:
            code = str(error)
            if code == "INVALID_PRODUCT":
                return self._fail("PRODUCT_INVALID", "Periksa nama, harga, dan kategori produk.", 400)
            if code == "BODY_TOO_LARGE":
                return self._fail("REQUEST_TOO_LARGE", "Request terlalu besar.", 413)
            return self._fail("INVALID_REQUEST", "Format request tidak valid.", 400)
        except Exception:
            _logger.exception("D-Sayur headless request failed: %s %s", request.httprequest.method, path)
            return self._fail("INTERNAL_ERROR", "Permintaan belum dapat diproses.", 500)

    @http.route("/dsayur/return", type="http", auth="public", website=True, methods=["GET"], csrf=False, save_session=False)
    def payment_return(self, order_id=None, **kwargs):
        """Landing route for redirect payment providers (e.g. Xendit): send the buyer back to the Next.js storefront."""
        base = (request.env["ir.config_parameter"].sudo().get_str("dsayur_headless.storefront_url", "http://localhost:3000") or "").rstrip("/")
        if not base.startswith(("http://", "https://")):
            return request.not_found()
        suffix = f"?order_id={int(order_id)}" if order_id and str(order_id).isdigit() else ""
        return request.redirect(f"{base}/order-confirmation{suffix}", local=False)

    @http.route("/dsayur/api/image/<string:model>/<int:record_id>/<string:field>", type="http", auth="public", website=True, methods=["GET"], csrf=False, save_session=False)
    def public_image(self, model, record_id, field, **kwargs):
        if not self._authorized():
            return self._fail("FORBIDDEN", "API key tidak valid.", 403)
        if model not in ("product.template", "product.image", "product.public.category") or field != "image_512":
            return request.not_found()
        record = request.env[model].sudo().browse(record_id).exists()
        if not record:
            return request.not_found()
        if model == "product.template" and (not record.is_published or not record.sale_ok):
            return request.not_found()
        if model == "product.image" and (not record.product_tmpl_id.is_published or not record.product_tmpl_id.sale_ok):
            return request.not_found()
        if model == "product.public.category" and (not record.has_published_products or (record.website_id and record.website_id != request.env.website)):
            return request.not_found()
        value = record[field]
        # Odoo 20 binary fields yield a BinaryValue (raw bytes in `.content`), not a base64 string.
        content = value.content if value else b""
        if not content:
            return request.not_found()
        if content.startswith(b"\x89PNG\r\n\x1a\n"):
            content_type = "image/png"
        elif content.startswith(b"\xff\xd8\xff"):
            content_type = "image/jpeg"
        elif content.startswith((b"GIF87a", b"GIF89a")):
            content_type = "image/gif"
        elif content.startswith(b"RIFF") and content[8:12] == b"WEBP":
            content_type = "image/webp"
        else:
            return request.not_found()
        return request.make_response(content, headers=[("Content-Type", content_type), ("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400"), ("X-Content-Type-Options", "nosniff")])
