#!/usr/bin/env bash
# Run in the identified demo WordPress service, with web and worker stopped.
set -euo pipefail
umask 077
operation="${1:-}"
archive="${2:-}"
fail() { echo "Demo snapshot refused: $1" >&2; exit 1; }
[[ "$operation" == backup || "$operation" == restore ]] || fail 'choose backup or restore'
[[ "$archive" == /* && "$archive" != /var/www/html* ]] || fail 'use an absolute private archive directory outside WordPress'
[[ "${RETZEF_DEMO_ENVIRONMENT:-}" == true && "${RETZEF_DEMO_ID:-}" =~ ^retzef-demo-[a-z0-9-]{8,64}$ ]] || fail 'explicit demo environment ID required'
[[ "${PGDATABASE:-}" == retzef_demo && "${MYSQL_DATABASE:-}" == retzef_woo_demo ]] || fail 'demo database names required'
[[ -n "${DEMO_EXPECTED_PG_HOST:-}" && "${PGHOST:-}" == "$DEMO_EXPECTED_PG_HOST" ]] || fail 'PostgreSQL host mismatch'
[[ -n "${DEMO_EXPECTED_MYSQL_HOST:-}" && "${MYSQL_HOST:-}" == "$DEMO_EXPECTED_MYSQL_HOST" ]] || fail 'MySQL host mismatch'
[[ "${DEMO_MAINTENANCE:-}" == true && "${RETZEF_RELEASE_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || fail 'maintenance and release SHA required'
[[ "${WORDPRESS_DB_NAME:-}" == "$MYSQL_DATABASE" && "${WORDPRESS_DB_HOST:-}" == "$MYSQL_HOST"* ]] || fail 'WordPress database mismatch'
for command in wp psql pg_dump pg_restore mysqldump mysql tar sha256sum; do command -v "$command" >/dev/null || fail "missing $command"; done
wp_cli() { wp --allow-root --path=/var/www/html "$@"; }
[[ "$(wp_cli option get retzef_demo_id)" == "$RETZEF_DEMO_ID" ]] || fail 'WordPress marker mismatch'
[[ "$(wp_cli option get home)" == "${RETZEF_DEMO_STORE_URL:-}" ]] || fail 'WordPress URL mismatch'
[[ "$(psql -X -At -v ON_ERROR_STOP=1 -c 'SELECT id FROM retzef_demo_environment WHERE singleton=true')" == "$RETZEF_DEMO_ID" ]] || fail 'PostgreSQL marker mismatch'
[[ "$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND usename='retzef_runtime'")" == 0 ]] || fail 'stop web and worker before snapshot/reset'
export MYSQL_PWD="${MYSQL_PASSWORD:?MYSQL_PASSWORD required}"
mysql_args=(--host="$MYSQL_HOST" --user="${MYSQL_USER:?MYSQL_USER required}" --port="${MYSQL_PORT:-3306}")
if [[ "$operation" == backup ]]; then
  mkdir "$archive"
  printf '%s\n' "$RETZEF_DEMO_ID" "$RETZEF_RELEASE_SHA" > "$archive/identity"
  wp_cli option update retzef_demo_maintenance 1 >/dev/null
  pg_dump --format=custom --no-owner --no-acl > "$archive/postgres.dump"
  mysqldump "${mysql_args[@]}" --single-transaction --routines --events --triggers "$MYSQL_DATABASE" > "$archive/mysql.sql"
  tar -C /var/www/html -czf "$archive/wordpress.tgz" .
  (cd "$archive" && sha256sum identity postgres.dump mysql.sql wordpress.tgz > SHA256SUMS)
else
  [[ "${DEMO_CONFIRM_RESET:-}" == "$RETZEF_DEMO_ID" ]] || fail 'explicit reset confirmation must match the demo ID'
  [[ -f "$archive/SHA256SUMS" ]] || fail 'archive manifest missing'
  (cd "$archive" && sha256sum -c SHA256SUMS >/dev/null) || fail 'archive integrity mismatch'
  [[ "$(sed -n '1p' "$archive/identity")" == "$RETZEF_DEMO_ID" && "$(sed -n '2p' "$archive/identity")" == "$RETZEF_RELEASE_SHA" ]] || fail 'archive environment or release mismatch'
  wp_cli option update retzef_demo_maintenance 1 >/dev/null
  pg_restore --single-transaction --clean --if-exists --exit-on-error --no-owner --no-acl --dbname="$PGDATABASE" "$archive/postgres.dump"
  mysql "${mysql_args[@]}" "$MYSQL_DATABASE" < "$archive/mysql.sql"
  find /var/www/html -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  tar -C /var/www/html -xzf "$archive/wordpress.tgz"
  psql -X -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
GRANT USAGE ON SCHEMA public TO retzef_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO retzef_runtime;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO retzef_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO retzef_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO retzef_runtime;
SQL
fi
# On any failure maintenance remains enabled and the operator must investigate.
wp_cli option update retzef_demo_maintenance 0 >/dev/null
echo 'Demo snapshot operation completed. Keep archives private and encrypted off-host.'
