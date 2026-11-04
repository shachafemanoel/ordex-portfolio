#!/usr/bin/env bash
# Generate fresh application secrets after the Railway env-var incident (Oct 2026).
#
# Writes ONLY to a gitignored env file (default: .env.local). Values are never
# printed to stdout/stderr; the script reports variable names only.
#
# Usage:
#   scripts/generate-app-secrets.sh                 # upsert into .env.local
#   scripts/generate-app-secrets.sh --file .env.prod.local
#   scripts/generate-app-secrets.sh --with-encryption-key
#
# --with-encryption-key writes ENCRYPTION_KEY_NEW (64-char hex = 32 bytes).
# It does NOT replace ENCRYPTION_KEY: existing data must first be re-encrypted
# with scripts/rotate-encryption-key.ts.
#
# After running: copy the values into your hosting provider (Vercel, etc.)
# yourself. Rotating JWT/session secrets logs every user out.

set -euo pipefail

TARGET=".env.local"
WITH_ENC=false

while [ $# -gt 0 ]; do
  case "$1" in
    --file) TARGET="$2"; shift 2 ;;
    --with-encryption-key) WITH_ENC=true; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required" >&2
  exit 1
fi

# Refuse to write anywhere git would track.
if ! git check-ignore -q "$TARGET"; then
  echo "Refusing to write: $TARGET is not ignored by .gitignore" >&2
  exit 1
fi
if git ls-files --error-unmatch "$TARGET" >/dev/null 2>&1; then
  echo "Refusing to write: $TARGET is tracked by git" >&2
  exit 1
fi

umask 077
touch "$TARGET"
chmod 600 "$TARGET"

# Single-line base64 without '/', '+' or '=' so values are safe in env files and URLs.
gen_b64() { openssl rand -base64 48 | tr -d '\n=' | tr '+/' '-_'; }
gen_hex32() { openssl rand -hex 32; }

# Replace KEY=... if present, otherwise append. Value is passed via env var, never echoed.
upsert() {
  local key="$1"
  local tmp
  tmp="$(mktemp "${TARGET}.XXXXXX")"
  NEW_VALUE="$2" awk -v k="$key" '
    BEGIN { done = 0 }
    $0 ~ "^" k "=" { print k "=" ENVIRON["NEW_VALUE"]; done = 1; next }
    { print }
    END { if (!done) print k "=" ENVIRON["NEW_VALUE"] }
  ' "$TARGET" > "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$TARGET"
  echo "  updated $key"
}

echo "Writing new secrets to $TARGET (values not shown):"
for key in AUTH_JWT_SECRET JWT_SECRET JWT_REFRESH_SECRET SESSION_SECRET CRON_SIGNATURE_SECRET; do
  upsert "$key" "$(gen_b64)"
done

if [ "$WITH_ENC" = true ]; then
  upsert ENCRYPTION_KEY_NEW "$(gen_hex32)"
  echo "  NOTE: ENCRYPTION_KEY_NEW written. Keep the old ENCRYPTION_KEY until"
  echo "        scripts/rotate-encryption-key.ts has re-encrypted stored data."
fi

echo "Done. Next: copy these into the runtime environment (Vercel/hosting) manually."
echo "Also update the cron caller (Authorization: Bearer <CRON_SIGNATURE_SECRET>)."
