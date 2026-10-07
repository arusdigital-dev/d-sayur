"""Configure server-only D-Sayur and payment secrets inside Odoo."""

import os
from pathlib import Path


def secret(name):
    value = Path(f"/run/secrets/{name}").read_text(encoding="utf-8").strip()
    if not value:
        raise RuntimeError(f"Docker secret kosong: {name}")
    return value


params = env["ir.config_parameter"].sudo()
domain = os.environ.get("DOMAIN", "dsayur.arusdigital.cloud").strip()
odoo_domain = os.environ.get("ODOO_DOMAIN", "dsayur-odoo.arusdigital.cloud").strip()
storefront_url = f"https://{domain}"
odoo_url = f"https://{odoo_domain}"

params.set_str("dsayur_headless.api_key", secret("dsayur_api_key"))
params.set_str("dsayur_headless.ors_api_key", secret("ors_api_key"))
params.set_str("dsayur_headless.store_latitude", os.environ.get("STORE_LATITUDE", "0.9189193"))
params.set_str("dsayur_headless.store_longitude", os.environ.get("STORE_LONGITUDE", "104.505651"))
params.set_str("dsayur_headless.storefront_url", storefront_url)
params.set_str("web.base.url", odoo_url)
params.set_str("web.base.url.freeze", "True")

provider = env["payment.provider"].sudo().search([("code", "=", "xendit")], limit=1)
if not provider:
    raise RuntimeError("Provider Xendit tidak ditemukan; install payment_xendit terlebih dahulu.")

live_mode = os.environ.get("XENDIT_LIVE_MODE", "0").lower() in {"1", "true", "yes"}
provider.write({
    "xendit_secret_key": secret("xendit_secret_key"),
    "xendit_webhook_token": secret("xendit_webhook_token"),
    "is_live": live_mode,
    "is_published": True,
    "active": True,
})

invoice_provider = env.ref("payment.payment_provider_pay_on_invoice", raise_if_not_found=False)
if invoice_provider:
    invoice_provider.write({"name": "Pay on Invoice", "custom_mode": "pay_on_invoice", "active": True})

cash_provider = env.ref("delivery.payment_provider_cod", raise_if_not_found=False)
if cash_provider:
    cash_provider.write({"name": "Tunai saat pesanan diterima", "is_published": True, "active": True})
    cash_provider.payment_method_ids.filtered(lambda method: method.code == "cash_on_delivery").write({"active": True})

env["delivery.carrier"].sudo().search([
    ("delivery_type", "in", ["dsayur_routes", "fixed"]),
]).write({"allow_cash_on_delivery": True})

env.cr.commit()
print(f"Bootstrap selesai: storefront={domain}, odoo={odoo_domain}, xendit_live={live_mode}")
