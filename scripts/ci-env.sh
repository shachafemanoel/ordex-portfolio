#!/usr/bin/env bash
# Writes throwaway credentials for one CI run to $GITHUB_ENV. Nothing here is stored in the
# repository: the database is an ephemeral service container that trusts local connections, and
# every password and signing secret is random per run and masked in the logs.
# Usage: bash scripts/ci-env.sh <database name>
set -euo pipefail

db="${1:?Database name is required}"
random() { openssl rand -hex 32; }

runtime_password=$(random)
for value in "$runtime_password"; do echo "::add-mask::$value"; done
{
  echo "DIRECT_URL=postgresql://postgres@localhost:5432/$db"
  echo "DATABASE_RUNTIME_PASSWORD=$runtime_password"
  echo "DATABASE_URL=postgresql://retzef_runtime:$runtime_password@localhost:5432/$db"
} >> "$GITHUB_ENV"

for name in AUTH_JWT_SECRET JWT_SECRET SESSION_SECRET ENCRYPTION_KEY; do
  value=$(random)
  echo "::add-mask::$value"
  echo "$name=$value" >> "$GITHUB_ENV"
done
