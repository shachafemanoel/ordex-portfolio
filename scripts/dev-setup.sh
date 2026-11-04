#!/usr/bin/env bash
# Builds a local development database that matches the release setup:
# migrations as the owner, a separate runtime role under row-level security,
# and one business with a one-time invitation for its first admin.
#
# Usage: npm run dev:setup -- "<business name>" <admin email>
# Without DIRECT_URL it starts postgres-dev from docker-compose.dev.yml and uses that.
set -euo pipefail

BUSINESS_NAME="${1:?Business name is required}"
ADMIN_EMAIL="${2:?Admin email is required}"
if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "Starting postgres-dev..."
  docker compose -f docker-compose.dev.yml up -d postgres-dev
  until docker exec ordex-postgres-dev pg_isready -U ordex_user -d ordex_dev >/dev/null 2>&1; do sleep 1; done
  DIRECT_URL="postgresql://ordex_user:ordex_dev_password@localhost:5432/ordex_dev"
fi
APP_URL="${APP_URL:-http://localhost:3000}"
ENV_FILE=".env.development.local"
INVITE_FILE="${INVITE_FILE:-.dev-invite.json}"

host=$(node -e 'console.log(new URL(process.argv[1]).hostname)' "$DIRECT_URL")
if [[ "$host" != "localhost" && "$host" != "127.0.0.1" ]]; then
  echo "Refusing to run against a non-local database ($host)." >&2
  exit 1
fi
if [[ -e "$ENV_FILE" ]]; then
  echo "$ENV_FILE already exists. Remove it to rebuild the local setup." >&2
  exit 1
fi

runtime_password=$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')
runtime_url=$(node -e 'const u=new URL(process.argv[1]); u.username="retzef_runtime"; u.password=process.argv[2]; console.log(u.href)' "$DIRECT_URL" "$runtime_password")
secret() { node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'; }

echo "Applying migrations..."
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy

echo "Provisioning the runtime role..."
DIRECT_URL="$DIRECT_URL" DATABASE_RUNTIME_PASSWORD="$runtime_password" node scripts/provision-runtime-role.mjs

umask 077
cat > "$ENV_FILE" <<EOF
TENANT_ENFORCEMENT=true
APP_URL=$APP_URL
DATABASE_URL=$runtime_url
DIRECT_URL=$DIRECT_URL
AUTH_JWT_SECRET=$(secret)
JWT_SECRET=$(secret)
SESSION_SECRET=$(secret)
ENCRYPTION_KEY=$(secret)
EOF

echo "Creating the business and its admin invitation..."
rm -f "$INVITE_FILE"
(set -a; . "./$ENV_FILE"; set +a
  node --import tsx scripts/tenant-operator.ts create "$BUSINESS_NAME" "$ADMIN_EMAIL" "$INVITE_FILE")

echo
echo "Done. Local settings were written to $ENV_FILE."
echo "Run 'npm run dev', then open the inviteUrl from $INVITE_FILE to set the admin password."
