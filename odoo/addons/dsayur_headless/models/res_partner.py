from datetime import datetime, timedelta

from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = "res.partner"

    dsayur_default_delivery_address_id = fields.Many2one(
        "res.partner",
        string="Alamat utama D-Sayur",
        copy=False,
        ondelete="set null",
    )
    dsayur_route_distance_m = fields.Integer(copy=False, readonly=True)
    dsayur_route_checked_at = fields.Datetime(copy=False, readonly=True)
    dsayur_route_fingerprint = fields.Char(copy=False, readonly=True)
    dsayur_tier = fields.Selection(
        [("bronze", "Bronze"), ("silver", "Silver"), ("gold", "Gold")],
        default="bronze",
        required=True,
        copy=False,
        index=True,
    )
    dsayur_tier_month = fields.Char(copy=False, readonly=True, index=True)
    dsayur_tier_reviewed_on = fields.Date(copy=False, readonly=True)
    dsayur_tier_valid_until = fields.Date(copy=False, readonly=True)

    _DSAYUR_TIER_RANK = {"bronze": 0, "silver": 1, "gold": 2}
    _DSAYUR_TIER_THRESHOLDS = {"silver": 750_000, "gold": 2_500_000}

    def _dsayur_month_spend(self, month_start):
        self.ensure_one()
        month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        # Business calendar is Asia/Jakarta (UTC+7); Odoo stores datetimes in UTC.
        start_utc = datetime.combine(month_start, datetime.min.time()) - timedelta(hours=7)
        end_utc = datetime.combine(month_end, datetime.min.time()) - timedelta(hours=7)
        partners = self.commercial_partner_id | self.commercial_partner_id.child_ids
        orders = self.env["sale.order"].sudo().search([
            ("partner_id", "in", partners.ids),
            ("state", "in", ["sale", "done"]),
            ("date_order", ">=", fields.Datetime.to_string(start_utc)),
            ("date_order", "<", fields.Datetime.to_string(end_utc)),
        ])
        total = 0.0
        for order in orders:
            transaction = order.get_portal_last_transaction()
            if transaction and transaction.state == "done":
                total += sum(order.order_line.filtered(lambda line: not line.is_delivery and not line.display_type).mapped("price_subtotal"))
        return max(0.0, total)

    def _dsayur_refresh_tier_after_paid_order(self):
        self.ensure_one()
        if self != self.commercial_partner_id:
            return
        today = fields.Date.context_today(self.with_context(tz="Asia/Jakarta"))
        spend = self._dsayur_month_spend(today.replace(day=1))
        target = "gold" if spend >= self._DSAYUR_TIER_THRESHOLDS["gold"] else "silver" if spend >= self._DSAYUR_TIER_THRESHOLDS["silver"] else "bronze"
        if self._DSAYUR_TIER_RANK[target] <= self._DSAYUR_TIER_RANK[self.dsayur_tier]:
            return
        next_month = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
        valid_until = (next_month.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        self.sudo().write({"dsayur_tier": target, "dsayur_tier_month": today.strftime("%Y-%m"), "dsayur_tier_valid_until": valid_until})
        self._dsayur_issue_tier_voucher(target, valid_until)

    def _dsayur_issue_tier_voucher(self, tier, valid_until):
        self.ensure_one()
        program_xmlid = {"silver": "dsayur_headless.dsayur_silver_voucher_program", "gold": "dsayur_headless.dsayur_gold_voucher_program"}.get(tier)
        program = self.env.ref(program_xmlid, raise_if_not_found=False) if program_xmlid else False
        if not program:
            return
        existing = self.env["loyalty.card"].sudo().search_count([("partner_id", "=", self.id), ("program_id", "=", program.id), ("expiration_date", ">=", fields.Date.context_today(self))])
        if existing:
            return
        card = self.env["loyalty.card"].sudo().create({"program_id": program.id, "partner_id": self.id, "expiration_date": valid_until})
        card._adjust_points(1, f"Voucher otomatis saat mencapai tier {tier.title()}")

    @api.model
    def _cron_review_tiers(self, force=False):
        today = fields.Date.context_today(self.with_context(tz="Asia/Jakarta"))
        month_key = today.strftime("%Y-%m")
        partners = self.sudo().search([("is_company", "=", False), ("dsayur_tier", "!=", "bronze")])
        if today.day == 1 or force:
            previous_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
            for partner in partners.filtered(lambda row: row.commercial_partner_id == row):
                if not force and partner.dsayur_tier_reviewed_on and partner.dsayur_tier_reviewed_on.strftime("%Y-%m") == month_key:
                    continue
                spend = partner._dsayur_month_spend(previous_month)
                current_rank = self._DSAYUR_TIER_RANK[partner.dsayur_tier]
                required = (750_000, 2_500_000)[current_rank - 1]
                if spend < required:
                    lowered = "silver" if partner.dsayur_tier == "gold" else "bronze"
                    following_month = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
                    valid_until = (following_month.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
                    partner.write({"dsayur_tier": lowered, "dsayur_tier_month": month_key, "dsayur_tier_valid_until": valid_until})
                partner.write({"dsayur_tier_reviewed_on": today})
