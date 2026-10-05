from werkzeug.security import check_password_hash, generate_password_hash

from odoo import api, fields, models


class DSayurCustomerAccount(models.Model):
    _name = "dsayur.customer.account"
    _description = "D-Sayur storefront credentials"
    _rec_name = "email"

    email = fields.Char(required=True, index=True)
    password_hash = fields.Char(required=True, copy=False)
    partner_id = fields.Many2one("res.partner", required=True, ondelete="cascade", index=True)
    user_id = fields.Many2one("res.users", required=True, ondelete="cascade", index=True)
    active = fields.Boolean(default=True, index=True)

    _email_unique = models.Constraint("UNIQUE (email)", "This D-Sayur email is already registered.")
    _partner_unique = models.Constraint("UNIQUE (partner_id)", "This customer already has a D-Sayur account.")

    @api.model_create_multi
    def create(self, vals_list):
        for values in vals_list:
            values["email"] = (values.get("email") or "").strip().lower()
        return super().create(vals_list)

    @api.model
    def _hash_password(self, password):
        return generate_password_hash(password)

    @api.model
    def authenticate_dsayur(self, email, password):
        account = self.sudo().search([("email", "=", (email or "").strip().lower()), ("active", "=", True)], limit=1)
        if not account or not account.user_id.active or not account.partner_id.active:
            return self.env["res.users"]
        try:
            valid = check_password_hash(account.password_hash, password or "")
        except (TypeError, ValueError):
            valid = False
        return account.user_id if valid else self.env["res.users"]
