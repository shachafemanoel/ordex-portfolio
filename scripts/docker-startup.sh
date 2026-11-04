#!/bin/sh
set -eu
node /app/scripts/validate-env.js
export HOSTNAME="0.0.0.0"
exec node /app/server.js
