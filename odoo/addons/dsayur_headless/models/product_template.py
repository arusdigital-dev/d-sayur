from odoo import api, fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    dsayur_badge = fields.Selection(
        [
            ("harvest_today", "Panen hari ini"),
            ("live_fish", "Ikan hidup"),
            ("ready_to_cook", "Siap masak"),
            ("umkm", "Produk UMKM"),
        ],
        string="Label D-Sayur",
    )
    dsayur_sale_unit_label = fields.Char(
        string="Satuan jual",
        help="Contoh: per 250 g, per ekor, per ikat. Ditampilkan di samping harga.",
    )
    dsayur_weighed = fields.Boolean(
        string="Ditimbang",
        help="Berat akhir dapat berbeda saat ditimbang; pembeli diberi catatan.",
    )
    dsayur_price_per_kg = fields.Float(
        string="Harga per kg",
        compute="_compute_dsayur_price_per_kg",
        help="Dihitung dari harga jual dan berat produk (kg) bila berat diisi.",
    )
    dsayur_umkm_name = fields.Char(string="Nama usaha UMKM")
    dsayur_umkm_origin = fields.Char(string="Asal UMKM")
    dsayur_umkm_story = fields.Text(string="Cerita UMKM")

    @api.depends("list_price", "weight")
    def _compute_dsayur_price_per_kg(self):
        for template in self:
            template.dsayur_price_per_kg = template.list_price / template.weight if template.weight and template.weight > 0 else 0.0
