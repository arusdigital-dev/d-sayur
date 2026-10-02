from odoo import fields, models


class LoyaltyProgram(models.Model):
    _inherit = "loyalty.program"

    dsayur_minimum_tier = fields.Selection(
        [("bronze", "Bronze"), ("silver", "Silver"), ("gold", "Gold")],
        string="Minimum D-Sayur member tier",
        default="bronze",
        required=True,
        help="Use Silver or Gold for early-access member promotions.",
    )
