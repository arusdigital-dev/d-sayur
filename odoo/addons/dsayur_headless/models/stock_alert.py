from html import escape

from odoo import api, fields, models


class DSayurStockAlert(models.Model):
    _name = "dsayur.stock.alert"
    _description = "D-Sayur Back-in-stock Subscription"
    _order = "create_date desc"

    product_id = fields.Many2one("product.product", required=True, ondelete="cascade", index=True)
    partner_id = fields.Many2one("res.partner", ondelete="set null", index=True)
    email = fields.Char(required=True, index=True)
    state = fields.Selection(
        [("waiting", "Waiting"), ("sent", "Notification queued"), ("cancel", "Cancelled")],
        default="waiting",
        required=True,
        index=True,
    )
    mail_id = fields.Many2one("mail.mail", readonly=True, ondelete="set null")

    @api.model
    def _cron_notify_restock(self):
        waiting = self.sudo().search([("state", "=", "waiting")], limit=500)
        for subscription in waiting:
            product = subscription.product_id
            if not product.active or (product.is_storable and product.free_qty <= 0):
                continue
            mail = self.env["mail.mail"].sudo().create({
                "subject": f"{product.display_name} tersedia kembali di D-Sayur",
                "email_to": subscription.email,
                "body_html": (
                    "<p>Kabar baik, produk <strong>%s</strong> yang Anda pantau tersedia kembali.</p>"
                    "<p>Kunjungi katalog D-Sayur untuk melihat stok terbaru.</p>"
                ) % escape(product.display_name),
                "auto_delete": True,
            })
            subscription.write({"state": "sent", "mail_id": mail.id})
            # Leave delivery to Odoo's native outgoing-mail queue/cron.
