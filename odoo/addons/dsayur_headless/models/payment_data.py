from datetime import timedelta

from odoo import api, fields, models


class PaymentData(models.Model):
    _inherit = "payment.data"

    @api.model
    def _cron_process(self):
        """Immediately retry one transient Xendit serialization failure."""
        result = super()._cron_process()
        if self.env.context.get("dsayur_skip_immediate_xendit_retry"):
            return result
        self._cron_retry_xendit_serialization_failures(min_age_seconds=0)
        return result

    @api.model
    def _cron_retry_xendit_serialization_failures(self, min_age_seconds=60):
        """Retry Xendit callbacks that failed only because PostgreSQL was concurrently writing."""
        cutoff = fields.Datetime.now() - timedelta(seconds=min_age_seconds)
        failed_callbacks = self.sudo().search([
            ("errored", "=", True),
            ("transaction_id.provider_id.code", "=", "xendit"),
            ("error_traceback", "ilike", "%could not serialize access due to concurrent update%"),
            ("create_date", "<=", cutoff),
        ], order="create_date, id", limit=100)
        if not failed_callbacks:
            return

        failed_callbacks.write({"errored": False, "error_traceback": False})
        self.with_context(dsayur_skip_immediate_xendit_retry=True)._cron_process()
