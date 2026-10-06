from datetime import timedelta

from odoo import api, fields, models


class PaymentData(models.Model):
    _inherit = "payment.data"

    @api.model
    def _cron_retry_xendit_serialization_failures(self):
        """Retry Xendit callbacks that failed only because PostgreSQL was concurrently writing."""
        cutoff = fields.Datetime.now() - timedelta(minutes=1)
        failed_callbacks = self.sudo().search([
            ("errored", "=", True),
            ("transaction_id.provider_id.code", "=", "xendit"),
            ("error_traceback", "ilike", "%could not serialize access due to concurrent update%"),
            ("create_date", "<=", cutoff),
        ], order="create_date, id", limit=100)
        if not failed_callbacks:
            return

        failed_callbacks.write({"errored": False, "error_traceback": False})
        self._cron_process()
