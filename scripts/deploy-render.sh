#!/usr/bin/env bash
set -euo pipefail

# Simple wrapper to deploy Ordex services on Render via CLI.
# Usage:
#   RENDER_SERVICE_WEB_ID=srv_xxx \
#   RENDER_SERVICE_WORKER_ID=srv_yyy \
#   CLEAR_CACHE=true \
#   ./scripts/deploy-render.sh

if ! command -v render >/dev/null 2>&1; then
  echo "Error: render CLI is not installed. See https://render.com/docs/cli" >&2
  exit 1
fi

echo "Checking Render auth..."
if ! render whoami --output text >/dev/null 2>&1; then
  echo "Not logged in. Running 'render login'..."
  render login || {
    echo "Login failed; aborting." >&2
    exit 1
  }
fi

WEB_ID="${RENDER_SERVICE_WEB_ID:-}"
WORKER_ID="${RENDER_SERVICE_WORKER_ID:-}"
CLEAR="${CLEAR_CACHE:-false}"

if [[ -z "$WEB_ID" ]]; then
  echo "RENDER_SERVICE_WEB_ID is required (web service id)." >&2
  exit 1
fi

CREATE_ARGS=(deploys create "$WEB_ID" --wait)
if [[ "$CLEAR" == "true" ]]; then
  CREATE_ARGS+=(--clear-cache)
fi

echo "Deploying web service: $WEB_ID (clear-cache=$CLEAR)" 
render "${CREATE_ARGS[@]}"

if [[ -n "$WORKER_ID" ]]; then
  echo "Deploying worker service: $WORKER_ID (clear-cache=$CLEAR)"
  CREATE_ARGS=(deploys create "$WORKER_ID" --wait)
  if [[ "$CLEAR" == "true" ]]; then
    CREATE_ARGS+=(--clear-cache)
  fi
  render "${CREATE_ARGS[@]}"
fi

echo "Done. You can inspect logs with:"
echo "  render logs -r $WEB_ID --limit 200 --output text"
if [[ -n "$WORKER_ID" ]]; then
  echo "  render logs -r $WORKER_ID --limit 200 --output text"
fi

