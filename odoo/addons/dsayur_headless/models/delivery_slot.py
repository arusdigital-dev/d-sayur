from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from odoo import api, fields, models
from odoo.exceptions import ValidationError


class DSayurDeliverySlot(models.Model):
    _name = "dsayur.delivery.slot"
    _description = "D-Sayur Delivery Slot"
    _order = "start_at, id"

    name = fields.Char(required=True, translate=True)
    start_at = fields.Datetime(required=True, index=True)
    end_at = fields.Datetime(required=True, index=True)
    capacity = fields.Integer(required=True, default=1)
    priority_tier = fields.Selection([("all", "Semua member"), ("gold", "Prioritas Gold")], required=True, default="all")
    branch_id = fields.Many2one("dsayur.store.branch", string="Cabang", index=True, ondelete="set null")
    active = fields.Boolean(default=True)

    @api.model
    def _cron_generate_upcoming_slots(self):
        """Keep a two-week rolling delivery schedule available to checkout."""
        jakarta = ZoneInfo("Asia/Jakarta")
        now_utc = datetime.now(timezone.utc)
        today = now_utc.astimezone(jakarta).date()
        schedule = (
            ("Pagi prioritas Gold", time(5), time(6), 4, "gold"),
            ("Pagi", time(6), time(9), 12, "all"),
            ("Siang", time(11), time(14), 12, "all"),
            ("Sore", time(16), time(19), 12, "all"),
        )
        new_slots = []
        for day_offset in range(14):
            day = today + timedelta(days=day_offset)
            for label, start_time, end_time, capacity, tier in schedule:
                start_local = datetime.combine(day, start_time, tzinfo=jakarta)
                end_local = datetime.combine(day, end_time, tzinfo=jakarta)
                if start_local.astimezone(timezone.utc) <= now_utc:
                    continue
                start_at = start_local.astimezone(timezone.utc).replace(tzinfo=None)
                end_at = end_local.astimezone(timezone.utc).replace(tzinfo=None)
                if self.search_count([("start_at", "=", start_at), ("branch_id", "=", False)]):
                    continue
                new_slots.append({
                    "name": f"{label} · {start_local.strftime('%a %d/%m %H.%M')}–{end_local.strftime('%H.%M')}",
                    "start_at": start_at,
                    "end_at": end_at,
                    "capacity": capacity,
                    "priority_tier": tier,
                    "active": True,
                })
        if new_slots:
            self.create(new_slots)

    @api.constrains("start_at", "end_at", "capacity")
    def _check_slot(self):
        for slot in self:
            if slot.end_at <= slot.start_at or slot.capacity < 1:
                raise ValidationError("Slot harus memiliki rentang waktu valid dan kapasitas minimal 1.")

    def _active_order_domain(self, exclude_order_id=False):
        cutoff = fields.Datetime.now() - timedelta(minutes=30)
        domain = [
            ("dsayur_delivery_slot_id", "=", self.id),
            ("state", "!=", "cancel"),
            ("id", "!=", exclude_order_id or 0),
            "|",
            ("state", "in", ["sale", "done"]),
            "&",
            ("state", "=", "draft"),
            ("dsayur_delivery_slot_reserved_at", ">=", cutoff),
        ]
        return domain

    def reserve_for_order(self, order, tier="bronze"):
        self.ensure_one()
        self.env.cr.execute("SELECT id FROM dsayur_delivery_slot WHERE id = %s FOR UPDATE", [self.id])
        self.invalidate_recordset()
        if not self.active or self.start_at <= fields.Datetime.now() or (self.priority_tier == "gold" and tier != "gold"):
            return False
        count = self.env["sale.order"].sudo().search_count(self._active_order_domain(order.id))
        if count >= self.capacity:
            return False
        order.sudo().write({
            "dsayur_delivery_slot_id": self.id,
            "dsayur_delivery_slot_reserved_at": fields.Datetime.now(),
        })
        return True
