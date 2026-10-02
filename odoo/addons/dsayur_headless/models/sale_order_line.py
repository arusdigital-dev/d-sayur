from odoo import api, fields, models


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    dsayur_note = fields.Char(string="Catatan untuk petugas", size=200, copy=True)

    def dsayur_set_note(self, note):
        """Store the customer's handling note and mirror it into the line description so
        staff see it on the order and the delivery slip."""
        for line in self:
            base = (line.name or "").split("\nCatatan:")[0]
            line.write({"dsayur_note": note or False, "name": f"{base}\nCatatan: {note}" if note else base})

    @api.depends(
        "product_id",
        "product_uom_id",
        "product_uom_qty",
        "pricelist_item_id",
        "order_id.partner_id.dsayur_tier",
        "order_id.partner_id.dsayur_tier_valid_until",
        "order_id.state",
        "is_delivery",
        "is_reward_line",
    )
    def _compute_discount(self):
        super()._compute_discount()
        for line in self:
            partner = line.order_id.partner_id.commercial_partner_id
            if not line.product_id or line.display_type or line.is_delivery or line.is_reward_line:
                continue
            if line.order_id.state != "draft":
                continue
            if partner.dsayur_tier != "gold" or not partner.dsayur_tier_valid_until:
                continue
            today = line.order_id.date_order.date() if line.order_id.date_order else False
            if today and today <= partner.dsayur_tier_valid_until:
                line.discount = 100 - (100 - line.discount) * 0.98
