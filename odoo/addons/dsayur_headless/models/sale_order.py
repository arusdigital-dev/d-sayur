from datetime import timedelta
import math

from odoo import api, fields, models
from odoo.fields import Domain


class SaleOrder(models.Model):
    _inherit = "sale.order"

    dsayur_delivery_slot_id = fields.Many2one("dsayur.delivery.slot", copy=False, index=True)
    dsayur_delivery_slot_reserved_at = fields.Datetime(copy=False, index=True)
    dsayur_branch_id = fields.Many2one("dsayur.store.branch", string="Cabang pengiriman", copy=False, index=True)
    dsayur_completed_at = fields.Datetime(copy=False, readonly=True, index=True)
    dsayur_packing_started_at = fields.Datetime(string="Mulai packing", copy=False, readonly=True, index=True)
    dsayur_cancel_requested_at = fields.Datetime(string="Permintaan pembatalan", copy=False, readonly=True, index=True)
    dsayur_cancel_reason = fields.Char(string="Alasan pembatalan pelanggan", size=500, copy=False, readonly=True)
    dsayur_refund_status = fields.Selection(
        selection=[
            ("none", "Belum diproses"),
            ("pending", "Menunggu proses refund"),
            ("succeeded", "Refund berhasil"),
            ("manual_done", "Refund dicatat manual di Odoo"),
            ("failed", "Refund gagal"),
            ("unknown", "Perlu pemeriksaan manual"),
        ],
        string="Status refund D-Sayur",
        default="none",
        copy=False,
        readonly=True,
        index=True,
    )
    dsayur_refund_id = fields.Char(string="ID refund Xendit", copy=False, readonly=True)
    dsayur_refund_reference = fields.Char(string="Referensi refund", copy=False, readonly=True)
    dsayur_refund_amount = fields.Monetary(
        string="Jumlah refund",
        currency_field="currency_id",
        copy=False,
        readonly=True,
    )
    dsayur_refund_requested_at = fields.Datetime(string="Refund diminta pada", copy=False, readonly=True)
    dsayur_refund_note = fields.Char(string="Catatan refund", size=500, copy=False, readonly=True)

    def _dsayur_eligible_tiers(self):
        self.ensure_one()
        tier = self.partner_id.commercial_partner_id.dsayur_tier if self.partner_id else "bronze"
        ranks = {"bronze": 0, "silver": 1, "gold": 2}
        return [name for name, rank in ranks.items() if rank <= ranks.get(tier, 0)]

    def _get_program_domain(self):
        return Domain(super()._get_program_domain()) & Domain("dsayur_minimum_tier", "in", self._dsayur_eligible_tiers())

    def _get_trigger_domain(self):
        return Domain(super()._get_trigger_domain()) & Domain("program_id.dsayur_minimum_tier", "in", self._dsayur_eligible_tiers())

    def _get_no_effect_on_threshold_lines(self):
        return super()._get_no_effect_on_threshold_lines() | self.order_line.filtered("is_delivery")

    dsayur_substitution_policy = fields.Selection(
        selection=[
            ("contact_first", "Hubungi saya sebelum mengganti"),
            ("similar_ok", "Boleh diganti dengan produk sejenis"),
            ("no_substitute", "Jangan diganti; hapus item yang kosong"),
        ],
        string="Preferensi pengganti D-Sayur",
        default="contact_first",
        copy=False,
    )
    dsayur_substitution_note = fields.Char(
        string="Catatan pengganti D-Sayur",
        size=500,
        copy=False,
    )
    dsayur_is_gift = fields.Boolean(string="Kirim sebagai hadiah", default=False, copy=False)

    def _program_check_compute_points(self, programs):
        result = super()._program_check_compute_points(programs)
        program = self.env.ref("dsayur_headless.dsayur_loyalty_program", raise_if_not_found=False)
        if not program or program not in programs or not self.partner_id:
            return result
        partner = self.partner_id.commercial_partner_id
        tier = partner.dsayur_tier or "bronze"
        transaction = self.get_portal_last_transaction()
        if transaction and transaction.state == "done":
            today = fields.Date.context_today(partner.with_context(tz="Asia/Jakarta"))
            month_spend = partner._dsayur_month_spend(today.replace(day=1))
            current_goods = sum(self.order_line.filtered(lambda line: not line.is_delivery and not line.display_type).mapped("price_subtotal"))
            projected = month_spend + max(0.0, current_goods)
            if projected >= 2_500_000:
                tier = "gold"
            elif projected >= 750_000 and tier == "bronze":
                tier = "silver"
        multiplier = {"bronze": 1.0, "silver": 1.5, "gold": 2.0}.get(tier, 1.0)
        status = result.get(program, {})
        if "points" in status:
            status["points"] = [math.floor(points * multiplier * 100 + 1e-9) / 100 for points in status["points"]]
        return result

    def action_confirm(self):
        result = super().action_confirm()
        for order in self:
            transaction = order.get_portal_last_transaction()
            if transaction and transaction.state == "done":
                order.partner_id.commercial_partner_id._dsayur_refresh_tier_after_paid_order()
        return result

    def action_dsayur_start_packing(self):
        """Admin marks the paid order as being packed (status "Dipacking")."""
        for order in self:
            transaction = order.get_portal_last_transaction()
            if order.state not in ("sale", "done") or not transaction or transaction.state != "done":
                return False
            if not order.dsayur_packing_started_at:
                order.sudo().write({"dsayur_packing_started_at": fields.Datetime.now()})
        return True

    def dsayur_mark_received(self):
        self.ensure_one()
        if self.state not in ("sale", "done") or self.carrier_id.dsayur_is_pickup:
            return False
        if self.dsayur_completed_at:
            return True
        outgoing = self.picking_ids.filtered(lambda picking: picking.picking_type_code == "outgoing")
        transaction = self.get_portal_last_transaction()
        if not outgoing or any(picking.state != "done" for picking in outgoing) or not transaction:
            return False
        cash_on_delivery = (
            transaction.provider_id.code == "custom"
            and transaction.provider_id.custom_mode == "cash_on_delivery"
        )
        if cash_on_delivery and transaction.state == "pending":
            # Customer confirmation means the courier handed over the goods and
            # collected the COD amount. Odoo processes _record asynchronously,
            # so do not wait for the transaction state to change in this request.
            transaction._record({"reference": transaction.reference, "confirmed": True})
            self.sudo().write({"dsayur_completed_at": fields.Datetime.now()})
            return True
        elif transaction.state != "done":
            return False
        self.sudo().write({"dsayur_completed_at": fields.Datetime.now()})
        return True

    @api.model
    def _cron_complete_delivered_orders(self):
        cutoff = fields.Datetime.now() - timedelta(hours=24)
        orders = self.sudo().search([
            ("state", "in", ["sale", "done"]),
            ("dsayur_completed_at", "=", False),
            ("carrier_id.dsayur_is_pickup", "=", False),
            ("picking_ids.picking_type_code", "=", "outgoing"),
            ("picking_ids.state", "=", "done"),
            ("picking_ids.date_done", "<=", cutoff),
        ])
        for order in orders:
            outgoing = order.picking_ids.filtered(lambda picking: picking.picking_type_code == "outgoing")
            if outgoing and all(picking.state == "done" and picking.date_done and picking.date_done <= cutoff for picking in outgoing):
                order.write({"dsayur_completed_at": fields.Datetime.now()})
