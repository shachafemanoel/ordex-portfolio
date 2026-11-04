#!/usr/bin/env bash
set -euo pipefail
node scripts/validate-env.js
export PORT="${PORT:-10000}"
export HOSTNAME="0.0.0.0"
exec npm start
