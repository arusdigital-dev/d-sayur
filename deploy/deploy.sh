#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
source deploy/.env.server
set +a
compose=(docker compose --env-file deploy/.env.server)

"${compose[@]}" pull db odoo proxy
"${compose[@]}" build storefront
"${compose[@]}" up -d db
# Avoid concurrent cron writes while the one-off Odoo process upgrades modules.
"${compose[@]}" stop odoo || true

# Idempotent: creates the database on first deployment and upgrades it later.
"${compose[@]}" --profile tools run --rm odoo-tools \
    -d "${ODOO_DATABASE:-dsayur}" -i payment_xendit,dsayur_headless -u dsayur_headless \
    --without-demo=all --stop-after-init --no-http

"${compose[@]}" --profile tools run --rm -T \
    -e DOMAIN="${DOMAIN:-dsayur.arusdigital.cloud}" \
    -e ODOO_DOMAIN="${ODOO_DOMAIN:-dsayur-odoo.arusdigital.cloud}" \
    -e STORE_LATITUDE="${STORE_LATITUDE:-0.9189193}" \
    -e STORE_LONGITUDE="${STORE_LONGITUDE:-104.505651}" \
    -e XENDIT_LIVE_MODE="${XENDIT_LIVE_MODE:-0}" \
    odoo-tools shell -d "${ODOO_DATABASE:-dsayur}" --no-http --max-cron-threads=0 \
    < deploy/bootstrap_odoo.py

"${compose[@]}" up -d odoo storefront proxy
# The module upgrade runs in a one-off tools container. Restart the long-lived
# Odoo worker so its in-memory registry picks up updated models and overrides.
"${compose[@]}" restart odoo
"${compose[@]}" ps
