from odoo import fields, models


class DSayurStoreBranch(models.Model):
    _name = "dsayur.store.branch"
    _description = "D-Sayur Store Branch"
    _order = "sequence, name"

    name = fields.Char(required=True, translate=True)
    code = fields.Char(required=True, index=True)
    address = fields.Char(required=True)
    latitude = fields.Float(required=True, digits=(10, 7))
    longitude = fields.Float(required=True, digits=(10, 7))
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("code_unique", "unique(code)", "Kode cabang harus unik."),
    ]
