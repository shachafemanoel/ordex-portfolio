#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must be configured}"
export DATABASE_URL="${DIRECT_URL:-${DATABASE_DIRECT_URL:-$DATABASE_URL}}"
exec node ./node_modules/prisma/build/index.js migrate deploy
