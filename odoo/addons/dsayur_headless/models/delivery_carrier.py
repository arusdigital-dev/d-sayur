import hashlib
import json
import math
from datetime import timedelta

import requests

from odoo import api, fields, models


class DeliveryCarrier(models.Model):
    _inherit = "delivery.carrier"

    delivery_type = fields.Selection(
        selection_add=[("dsayur_routes", "D-Sayur OpenRouteService")],
        ondelete={"dsayur_routes": "set default"},
    )
    dsayur_is_pickup = fields.Boolean(string="D-Sayur: pickup", default=False)

    def dsayur_routes_rate_shipment(self, order):
        self.ensure_one()
        partner = order.partner_shipping_id
        params = self.env["ir.config_parameter"].sudo()
        api_key = params.get_str("dsayur_headless.ors_api_key", "") or ""
        try:
            branch = order.dsayur_branch_id
            origin = (float(branch.latitude), float(branch.longitude)) if branch else (
                float(params.get_str("dsayur_headless.store_latitude", "0.9189193")),
                float(params.get_str("dsayur_headless.store_longitude", "104.505651")),
            )
            destination = (partner.partner_latitude, partner.partner_longitude)
            if not api_key or any(value is None or not math.isfinite(float(value)) for value in (*origin, *destination)):
                raise ValueError
            if not (-90 <= origin[0] <= 90 and -90 <= destination[0] <= 90 and -180 <= origin[1] <= 180 and -180 <= destination[1] <= 180):
                raise ValueError
        except (TypeError, ValueError):
            return self._route_failure("Lokasi toko, pin alamat, atau ORS API key belum dikonfigurasi.")

        fingerprint = hashlib.sha256(json.dumps(["openrouteservice-v3", branch.id if branch else False, origin, destination]).encode()).hexdigest()
        checked = partner.dsayur_route_checked_at
        distance_m = partner.dsayur_route_distance_m
        duration_s = partner.dsayur_route_duration_s
        if (
            partner.dsayur_route_fingerprint != fingerprint
            or not checked
            or checked < fields.Datetime.now() - timedelta(days=30)
            or not distance_m
            or not duration_s
        ):
            try:
                distance_m, duration_s = self._dsayur_cached_route_summary(
                    round(origin[0], 4), round(origin[1], 4),
                    round(float(destination[0]), 4), round(float(destination[1]), 4),
                )
            except (requests.RequestException, KeyError, TypeError, ValueError):
                return self._route_failure("Rute ke alamat belum dapat dihitung. Coba lagi atau pilih ambil sendiri.")
            partner.sudo().write({
                "dsayur_route_distance_m": distance_m,
                "dsayur_route_duration_s": duration_s,
                "dsayur_route_checked_at": fields.Datetime.now(),
                "dsayur_route_fingerprint": fingerprint,
            })

        distance_km = distance_m / 1000
        if distance_km > 20:
            return self._route_failure("Alamat di luar jangkauan antar 20 km. Silakan pilih ambil sendiri.")
        tier = partner.commercial_partner_id.dsayur_tier or "bronze"
        thresholds = {"bronze": 150_000, "silver": 100_000, "gold": 50_000}
        goods_amount = sum(order.order_line.filtered(lambda line: not line.is_delivery and not line.display_type).mapped("price_subtotal"))
        if goods_amount >= thresholds[tier]:
            return {"success": True, "price": 0.0, "error_message": False, "warning_message": False}
        price = 7000 + max(0, math.ceil(distance_km - 3)) * 2000
        return {"success": True, "price": price, "error_message": False, "warning_message": False}

    @api.ormcache("origin_latitude", "origin_longitude", "latitude_key", "longitude_key")
    def _dsayur_cached_route_summary(self, origin_latitude, origin_longitude, latitude_key, longitude_key):
        """Driving distance and duration from a branch origin to a destination."""
        params = self.env["ir.config_parameter"].sudo()
        api_key = params.get_str("dsayur_headless.ors_api_key", "") or ""
        origin = (origin_latitude, origin_longitude)
        if not api_key:
            raise ValueError("ors key missing")
        response = requests.post(
            "https://api.heigit.org/openrouteservice/v2/directions/driving-car/json",
            headers={"Content-Type": "application/json", "Accept": "application/json", "Authorization": api_key},
            json={"coordinates": [[origin[1], origin[0]], [longitude_key, latitude_key]]},
            timeout=8,
        )
        response.raise_for_status()
        routes = response.json().get("routes", [])
        summary = routes[0]["summary"] if routes else {}
        distance_m = int(summary.get("distance", 0))
        duration_s = int(summary.get("duration", 0))
        if distance_m <= 0 or duration_s <= 0:
            raise ValueError("route summary missing")
        return distance_m, duration_s

    def _dsayur_route_origin(self, branch=None):
        params = self.env["ir.config_parameter"].sudo()
        branch = branch or self.env["dsayur.store.branch"].sudo().search([("active", "=", True)], order="sequence, id", limit=1)
        if branch:
            return float(branch.latitude), float(branch.longitude)
        return (
            float(params.get_str("dsayur_headless.store_latitude", "0.9189193")),
            float(params.get_str("dsayur_headless.store_longitude", "104.505651")),
        )

    def dsayur_area_estimate(self, latitude, longitude, branch=None):
        """Estimate driving distance/time from a selected branch to a customer pin."""
        try:
            origin = self._dsayur_route_origin(branch)
            distance_m, duration_s = self._dsayur_cached_route_summary(
                round(origin[0], 4), round(origin[1], 4), round(float(latitude), 4), round(float(longitude), 4)
            )
        except (requests.RequestException, KeyError, TypeError, ValueError):
            return None
        distance_km = distance_m / 1000
        drive_minutes = math.ceil(duration_s / 60)
        eta_min = max(8, drive_minutes + 8)
        eta_max = eta_min + 8
        if distance_km > 20:
            return {"deliverable": False, "distance_km": round(distance_km, 1), "duration_minutes": drive_minutes, "eta_min": eta_min, "eta_max": eta_max, "fee": None}
        return {"deliverable": True, "distance_km": round(distance_km, 1), "duration_minutes": drive_minutes, "eta_min": eta_min, "eta_max": eta_max, "fee": 7000 + max(0, math.ceil(distance_km - 3)) * 2000}

    # Odoo calls <delivery_type>_send_shipping when a delivery order is validated in Inventory; the
    # shipping fee was already charged on the sale order, so there is no external label to buy.
    def dsayur_routes_send_shipping(self, pickings):
        return [{"exact_price": picking.sale_id.amount_delivery if picking.sale_id else 0.0, "tracking_number": False} for picking in pickings]

    def dsayur_routes_get_tracking_link(self, picking):
        return False

    def dsayur_routes_cancel_shipment(self, pickings):
        raise NotImplementedError()

    def _route_failure(self, message):
        return {"success": False, "price": 0.0, "error_message": message, "warning_message": False}
