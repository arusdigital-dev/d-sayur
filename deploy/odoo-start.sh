#!/bin/bash
set -euo pipefail

runtime_config=/tmp/dsayur-odoo.conf
cp /etc/odoo/odoo.conf.template "$runtime_config"
printf '\nadmin_passwd = %s\n' "$(tr -d '\r\n' </run/secrets/odoo_admin_password)" >>"$runtime_config"

exec /entrypoint.sh odoo --config="$runtime_config" "$@"

