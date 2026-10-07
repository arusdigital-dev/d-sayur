from datetime import timedelta

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
