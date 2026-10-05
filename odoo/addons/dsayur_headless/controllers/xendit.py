from odoo import http
from odoo.http import request

from odoo.addons.payment import utils as payment_utils
from odoo.addons.payment_xendit.controllers.main import XenditController


class DSayurXenditController(XenditController):
    """Return customers to the headless order page after Xendit synchronizes the payment."""

    @http.route()
    def xendit_return(self, tx_ref=None, success=False, access_token=None, **data):
        response = super().xendit_return(
            tx_ref=tx_ref,
            success=success,
            access_token=access_token,
            **data,
        )
        if not tx_ref or not access_token:
            return response

        transaction = (
            request.env["payment.transaction"]
            .sudo()
            .search([("provider_code", "=", "xendit"), ("reference", "=", tx_ref)], limit=1)
        )
        if not transaction or not payment_utils.check_access_token(
            access_token, tx_ref, transaction.amount
        ):
            return response

        order = transaction.sale_order_ids[:1]
        if not order:
            return response
        return request.redirect(f"/dsayur/return?order_id={order.id}", local=True)

