#!/usr/bin/env bash
set -euo pipefail
[[ "${RETZEF_DEMO_ENVIRONMENT:-}" == true && "${RETZEF_DEMO_ID:-}" =~ ^retzef-demo-[a-z0-9-]{8,64}$ ]] || { echo 'Identified synthetic demo environment required' >&2; exit 1; }
# Refresh this small safety plugin even when WordPress itself is already on the persistent disk.
install -d -o www-data -g www-data /var/www/html/wp-content/mu-plugins
install -o www-data -g www-data -m 644 /opt/retzef/retzef-demo.php /var/www/html/wp-content/mu-plugins/retzef-demo.php
exec docker-entrypoint.sh "$@"
