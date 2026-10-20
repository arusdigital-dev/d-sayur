from odoo.tests import HttpCase, tagged
from odoo.fields import Command
from odoo.addons.dsayur_headless.controllers.main import DSayurHeadless
from odoo.addons.website_sale.tests.common import MockRequest


@tagged("post_install", "-at_install")
class TestDSayurHeadlessApi(HttpCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.api_key = "test-dsayur-headless-key"
        cls.env["ir.config_parameter"].sudo().set_str(
            "dsayur_headless.api_key", cls.api_key
        )
        cls.website = cls.env["website"].search([], limit=1)
        cls.assertTrue(cls.website, "Odoo should provide a default website for website_sale")
        cls.category = cls.env["product.public.category"].create({
            "name": "Headless test category",
            "website_id": cls.website.id,
        })
        cls.product = cls.env["product.template"].create({
            "name": "Headless test product",
            "list_price": 2500,
            "sale_ok": True,
            "is_published": True,
            "public_categ_ids": [(6, 0, cls.category.ids)],
        })

    def test_private_api_rejects_missing_key(self):
        response = self.url_open("/dsayur/api/products")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(response.json()["success"])

    def test_dsayur_password_is_independent_from_odoo_password(self):
        partner = self.env["res.partner"].create({"name": "Separate login test", "email": "separate-login@example.test"})
        portal = self.env.ref("base.group_portal")
        user = self.env["res.users"].with_context(no_reset_password=True).create({
            "name": partner.name,
            "login": "odoo-separate-login-test",
            "partner_id": partner.id,
            "password": "odoo-only-password",
            "group_ids": [(6, 0, portal.ids)],
        })
        accounts = self.env["dsayur.customer.account"].sudo()
        accounts.create({
            "email": partner.email,
            "password_hash": accounts._hash_password("dsayur-only-password"),
            "partner_id": partner.id,
            "user_id": user.id,
        })

        self.assertEqual(accounts.authenticate_dsayur(partner.email, "dsayur-only-password"), user)
        self.assertFalse(accounts.authenticate_dsayur(partner.email, "odoo-only-password"))

    def test_order_has_persisted_substitution_preference(self):
        field = self.env["sale.order"]._fields.get("dsayur_substitution_policy")
        self.assertTrue(field, "The substitution choice must be stored on Odoo sales orders")
        self.assertIn("contact_first", [value for value, _label in field.selection])

    def test_native_loyalty_program_uses_dsayur_exchange_value(self):
        program = self.env.ref("dsayur_headless.dsayur_loyalty_program")
        self.assertEqual(program.program_type, "loyalty")
        self.assertTrue(program.portal_visible)
        self.assertEqual(program.rule_ids.reward_point_mode, "money")
        self.assertEqual(program.rule_ids.reward_point_amount, 0.001)
        self.assertEqual(program.reward_ids.discount_mode, "per_point")
        self.assertEqual(program.reward_ids.discount, 10)

    def test_delivery_and_order_lifecycle_fields_exist(self):
        self.assertIn("dsayur_delivery_slot_id", self.env["sale.order"]._fields)
        self.assertIn("dsayur_completed_at", self.env["sale.order"]._fields)
        self.assertIn("dsayur_is_pickup", self.env["delivery.carrier"]._fields)
        self.assertIn("dsayur_tier_valid_until", self.env["res.partner"]._fields)
        self.assertIn("dsayur_minimum_tier", self.env["loyalty.program"]._fields)

    def test_native_loyalty_program_has_member_tier_gate(self):
        program = self.env.ref("dsayur_headless.dsayur_loyalty_program")
        self.assertEqual(program.dsayur_minimum_tier, "bronze")

    def test_product_listing_uses_published_odoo_catalog(self):
        response = self.url_open(
            "/dsayur/api/products?search=Headless+test+product",
            headers={
                "X-DSayur-API-Key": self.api_key,
                "X-DSayur-Database": self.env.cr.dbname,
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        item = next(item for item in data["items"] if item["name"] == self.product.name)
        self.assertIn("compare_at_price", item)
        self.assertIn("discount_percent", item)
        self.assertIsNone(item["compare_at_price"])
        self.assertEqual(item["discount_percent"], 0)
        self.assertIn("compare_at_price", item["variants"][0])

    def test_cart_read_does_not_create_an_order(self):
        response = self._get("cart")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.assertEqual(response.json()["data"], {
            "id": None,
            "lines": [],
            "quantity": 0,
            "totals": None,
        })

    def _get(self, path):
        return self.url_open(f"/dsayur/api/{path}", headers={
            "X-DSayur-API-Key": self.api_key,
            "X-DSayur-Database": self.env.cr.dbname,
        })

    def test_area_check_rejects_invalid_coordinates(self):
        response = self._get("area-check?lat=abc&lng=1")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "AREA_INVALID")

    def test_product_detail_exposes_fresh_goods_metadata(self):
        self.product.write({
            "dsayur_badge": "harvest_today",
            "dsayur_sale_unit_label": "per 250 g",
            "dsayur_weighed": True,
            "weight": 0.25,
            "dsayur_umkm_name": "UMKM Contoh",
        })
        slug = f"headless-test-product-{self.product.id}"
        response = self._get(f"products/{slug}")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["badge"]["code"], "harvest_today")
        self.assertEqual(data["unit_label"], "per 250 g")
        self.assertTrue(data["weighed"])
        self.assertEqual(data["stock_on_hand"], self.product.product_variant_id.qty_available)
        self.assertIn("stock_on_hand", data["variants"][0])
        self.assertEqual(data["price_per_kg"]["amount"], 10000)
        self.assertEqual(data["umkm"]["name"], "UMKM Contoh")

    def test_odoo_price_presentation_exposes_real_discount_and_regular_price(self):
        controller = DSayurHeadless()
        product = self.product.product_variant_id

        discounted = controller._price_presentation(product, 2000, self.website.currency_id)
        self.assertEqual(discounted["price"]["amount"], 2000)
        self.assertEqual(discounted["compare_at_price"]["amount"], product.lst_price)
        self.assertEqual(discounted["discount_percent"], 20)

        regular = controller._price_presentation(product, product.lst_price, self.website.currency_id)
        self.assertIsNone(regular["compare_at_price"])
        self.assertEqual(regular["discount_percent"], 0)

    def test_pricelist_discount_is_used_in_product_payload_and_cart_order(self):
        pricelist = self.env["product.pricelist"].create({
            "name": "D-Sayur headless test 20% discount",
            "currency_id": self.website.currency_id.id,
            "website_id": self.website.id,
            "item_ids": [Command.create({
                "applied_on": "1_product",
                "product_tmpl_id": self.product.id,
                "base": "list_price",
                "compute_price": "discount",
                "price_discount": 20,
            })],
        })
        variant = self.product.product_variant_id

        request_env = self.env(user=self.website.user_id, context=dict(self.env, website_id=self.website.id))
        request_website = self.website.with_env(request_env)
        with MockRequest(request_env, website=request_website) as mock_request:
            mock_request.pricelist = pricelist
            payload = DSayurHeadless()._public_product(variant)
        self.assertEqual(payload["price"]["amount"], 2000)
        self.assertEqual(payload["compare_at_price"]["amount"], 2500)
        self.assertEqual(payload["discount_percent"], 20)

        order = self.env["sale.order"].create({
            "partner_id": self.env.user.partner_id.id,
            "website_id": self.website.id,
            "pricelist_id": pricelist.id,
        })
        order._cart_add(variant.id, quantity=2)
        line = order.order_line.filtered(lambda item: item.product_id == variant)
        self.assertEqual(len(line), 1)
        self.assertEqual(line.price_unit, 2000)
        self.assertEqual(line.product_uom_qty, 2)
        self.assertEqual(line.price_subtotal, 4000)

    def test_packing_requires_paid_order(self):
        partner = self.env["res.partner"].create({"name": "Packing test"})
        order = self.env["sale.order"].create({"partner_id": partner.id, "order_line": [(0, 0, {"product_id": self.product.product_variant_id.id, "product_uom_qty": 1})]})
        self.assertFalse(order.action_dsayur_start_packing(), "A draft/unpaid order cannot enter packing")
        self.assertFalse(order.dsayur_packing_started_at)
