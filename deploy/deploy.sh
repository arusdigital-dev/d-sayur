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
"${compose[@]}" ps
