from odoo import _, api, fields, models
from odoo.exceptions import UserError


class StockPicking(models.Model):
    _inherit = "stock.picking"

    dsayur_cancel_requested_at = fields.Datetime(
        string="Permintaan pembatalan pelanggan",
        related="sale_id.dsayur_cancel_requested_at",
        readonly=True,
    )
    dsayur_cancel_reason = fields.Char(
        string="Alasan pembatalan pelanggan",
        related="sale_id.dsayur_cancel_reason",
        readonly=True,
    )
    dsayur_refund_status = fields.Selection(related="sale_id.dsayur_refund_status", readonly=True)
    dsayur_refund_id = fields.Char(related="sale_id.dsayur_refund_id", readonly=True)
    dsayur_refund_reference = fields.Char(related="sale_id.dsayur_refund_reference", readonly=True)
    dsayur_refund_amount_display = fields.Char(
        string="Jumlah refund",
        compute="_compute_dsayur_refund_amount_display",
    )
    dsayur_refund_requested_at = fields.Datetime(related="sale_id.dsayur_refund_requested_at", readonly=True)
    dsayur_refund_note = fields.Char(related="sale_id.dsayur_refund_note", readonly=True)

    @api.depends("sale_id.dsayur_refund_amount", "sale_id.currency_id")
    def _compute_dsayur_refund_amount_display(self):
        for picking in self:
            amount = picking.sale_id.dsayur_refund_amount if picking.sale_id else 0
            currency = picking.sale_id.currency_id if picking.sale_id else False
            picking.dsayur_refund_amount_display = currency.format(amount) if currency and amount else False

    def _dsayur_check_refund_access(self):
        if not (self.env.user.has_group("stock.group_stock_manager") or self.env.user.has_group("sales_team.group_sale_manager")):
            raise UserError(_("Hanya manajer Inventory yang dapat memproses refund."))

    def action_dsayur_record_manual_refund(self):
        """Record a manually completed refund without calling a payment provider."""
        self.ensure_one()
        self._dsayur_check_refund_access()
        order = self.sale_id
        if not order or not order.dsayur_cancel_requested_at:
            raise UserError(_("Refund hanya dapat diproses setelah pelanggan mengajukan pembatalan."))
        if order.state != "cancel" and (self.picking_type_code != "outgoing" or self.state != "cancel"):
            raise UserError(_("Batalkan pengiriman di Inventory terlebih dahulu sebelum memproses refund."))
        transaction = order.get_portal_last_transaction()
        if not transaction or transaction.state != "done":
            raise UserError(_("Pesanan ini belum memiliki pembayaran berhasil yang dapat direfund."))
        if order.dsayur_refund_status in ("succeeded", "manual_done"):
            raise UserError(_("Refund pesanan ini sudah dicatat selesai."))

        # This records that a store operator has already returned the funds
        # outside Odoo. It deliberately makes no request to Xendit or any
        # other payment provider.
        reference = f"ODOO-MANUAL-{order.name}"
        order.sudo().write({
            "dsayur_refund_status": "manual_done",
            "dsayur_refund_reference": reference,
            "dsayur_refund_amount": transaction.amount,
            "dsayur_refund_requested_at": fields.Datetime.now(),
            "dsayur_refund_note": _("Refund manual dicatat di Odoo oleh %s. Dana harus sudah dikembalikan di luar sistem.", self.env.user.name),
        })
        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("Refund dicatat di Odoo"),
                "message": _("Tidak ada request yang dikirim ke Xendit. Pastikan dana sudah dikembalikan secara manual."),
                "type": "success",
                "sticky": True,
            },
        }
