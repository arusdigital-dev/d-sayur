import re
from urllib.parse import urljoin

from odoo import models
from odoo.addons.payment_xendit.controllers.main import XenditController


class PaymentTransaction(models.Model):
    _inherit = "payment.transaction"

    def _xendit_get_return_url(self):
        """Build Xendit's public callback from the configured HTTPS base URL."""
        if self.provider_code != "xendit":
            return super()._xendit_get_return_url()

        # Bypass provider/company website URL inference. The headless payment API
        # runs on Odoo's internal Docker hostname, which must never reach Xendit.
        self.env.cr.execute(
            "SELECT value FROM ir_config_parameter WHERE key = %s",
            ("web.base.url",),
        )
        row = self.env.cr.fetchone()
        base_url = (row[0] if row else "").rstrip("/")
        if base_url.startswith("https://"):
            return urljoin(f"{base_url}/", XenditController._return_url.lstrip("/"))
        return super()._xendit_get_return_url()

    def _xendit_prepare_invoice_request_payload(self):
        """Normalize optional customer fields to Xendit's accepted formats."""
        payload = super()._xendit_prepare_invoice_request_payload()
        customer = payload.get("customer") or {}
        detail = customer.get("individual_detail") or {}
        if not detail.get("surname"):
            detail.pop("surname", None)

        mobile_number = customer.get("mobile_number")
        if mobile_number:
            digits = re.sub(r"\D", "", mobile_number)
            if digits.startswith("00"):
                digits = digits[2:]
            elif not mobile_number.strip().startswith("+"):
                calling_code = {
                    "ID": "62",
                    "PH": "63",
                    "VN": "84",
                    "TH": "66",
                    "SG": "65",
                    "MY": "60",
                }.get(payload.get("country"))
                if calling_code:
                    if digits.startswith("0"):
                        digits = calling_code + digits[1:]
                    elif not digits.startswith(calling_code):
                        digits = calling_code + digits
                else:
                    digits = ""

            if 8 <= len(digits) <= 15:
                customer["mobile_number"] = f"+{digits}"
            else:
                customer.pop("mobile_number", None)

        payload["customer"] = customer
        return payload
