#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p deploy/secrets
chmod 700 deploy/secrets

create_random_secret() {
    local target=$1
    if [[ ! -s "$target" ]]; then
        openssl rand -base64 48 | tr -d '\n' >"$target"
    fi
}

prompt_secret() {
    local label=$1 target=$2
    if [[ -s "$target" ]]; then
        return
    fi
    read -r -s -p "$label: " value
    echo
    if [[ -z "$value" ]]; then
        echo "$label tidak boleh kosong." >&2
        exit 1
    fi
    printf '%s' "$value" >"$target"
}

create_random_secret deploy/secrets/postgres_password
create_random_secret deploy/secrets/odoo_admin_password
create_random_secret deploy/secrets/dsayur_api_key
prompt_secret 'ORS Basic Key' deploy/secrets/ors_api_key
prompt_secret 'Xendit Secret API Key' deploy/secrets/xendit_secret_key
prompt_secret 'Xendit Webhook Verification Token' deploy/secrets/xendit_webhook_token
chmod 600 deploy/secrets/*

if [[ ! -f deploy/.env.server ]]; then
    cp deploy/.env.server.example deploy/.env.server
fi

echo 'Secret dan deploy/.env.server siap.'

