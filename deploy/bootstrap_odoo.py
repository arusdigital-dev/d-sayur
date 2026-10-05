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

params.set_param("dsayur_headless.api_key", secret("dsayur_api_key"))
params.set_param("dsayur_headless.ors_api_key", secret("ors_api_key"))
params.set_param("dsayur_headless.store_latitude", os.environ.get("STORE_LATITUDE", "0.9189193"))
params.set_param("dsayur_headless.store_longitude", os.environ.get("STORE_LONGITUDE", "104.505651"))
params.set_param("dsayur_headless.storefront_url", storefront_url)
params.set_param("web.base.url", odoo_url)
params.set_param("web.base.url.freeze", "True")

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

env.cr.commit()
print(f"Bootstrap selesai: storefront={domain}, odoo={odoo_domain}, xendit_live={live_mode}")
