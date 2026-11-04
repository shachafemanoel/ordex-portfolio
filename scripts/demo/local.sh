#!/usr/bin/env bash
# Local pilot demo on this Mac: Retzef, its WooCommerce worker, a dedicated Postgres cluster and a
# WooCommerce test store (WordPress Playground: PHP inside Node, no Docker or PHP install).
# Free, no cloud services. Everything lives in $RETZEF_DEMO_HOME (default ~/.retzef-demo),
# never in the repository, and never touches the development or acceptance databases.
#
# Usage: bash scripts/demo/local.sh <command>
#   setup   first time only: database, demo data, test store, build and a baseline snapshot
#   start   start everything (rebuilds when the code changed)
#   stop    stop everything
#   status  show what is running
#   reset   stop the app, worker and store and restore Retzef and the store to the baseline
#   tunnel  share the running app over a temporary public HTTPS link (needs cloudflared)
set -euo pipefail
cd "$(dirname "$0")/../.."

DEMO_HOME="${RETZEF_DEMO_HOME:-$HOME/.retzef-demo}"
PG_PORT="${RETZEF_DEMO_PG_PORT:-55433}"
APP_PORT="${RETZEF_DEMO_APP_PORT:-3100}"
DB=retzef_demo
OWNER=retzef_demo_owner
PGDATA="$DEMO_HOME/pgdata"
ENV_FILE="$DEMO_HOME/env"
RUN="$DEMO_HOME/run"
LOGS="$DEMO_HOME/logs"
STORE_PORT="${RETZEF_DEMO_STORE_PORT:-9400}"
STORE="$DEMO_HOME/store"
PLAYGROUND_VERSION=3.1.61
PLAYGROUND="$DEMO_HOME/tools/node_modules/@wp-playground/cli/wp-playground.js"

fail() { echo "Demo: $1" >&2; exit 1; }
# Node 22 from RETZEF_NODE_BIN, or the copy the release checks downloaded, or the default node.
NODE_BIN="${RETZEF_NODE_BIN:-$HOME/.cache/retzef-mvp-tools/node-v22.23.4-darwin-x64/bin}"
[[ -x "$NODE_BIN/node" ]] && PATH="$NODE_BIN:$PATH"
node -v 2>/dev/null | grep -q '^v22\.' || fail "Node 22 is required (set RETZEF_NODE_BIN to its bin folder)"
random() { openssl rand -hex 32; }
load_env() {
  [[ -f "$ENV_FILE" ]] || fail "not set up yet. Run: bash scripts/demo/local.sh setup"
  set -a; . "$ENV_FILE"; set +a
}
owner_psql() { psql "$DIRECT_URL" -X -At -v ON_ERROR_STOP=1 "$@"; }
pg_running() { pg_ctl -D "$PGDATA" status >/dev/null 2>&1; }
pg_start() {
  pg_running && return
  # macOS refuses to start Postgres without a valid LC_ALL.
  LC_ALL=en_US.UTF-8 pg_ctl -D "$PGDATA" -l "$LOGS/postgres.log" -w \
    -o "-p $PG_PORT -c listen_addresses=127.0.0.1 -k $DEMO_HOME" start >/dev/null
}
alive() { [[ -f "$RUN/$1.pid" ]] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }
stop_process() {
  if alive "$1"; then
    kill "$(cat "$RUN/$1.pid")"
    for _ in $(seq 1 20); do alive "$1" || break; sleep 0.5; done
  fi
  rm -f "$RUN/$1.pid"
}
# The reset tool only acts on a database that carries this environment's marker.
check_marker() {
  [[ "$(owner_psql -c 'SELECT id FROM retzef_demo_environment WHERE singleton')" == "$RETZEF_DEMO_ID" ]] ||
    fail "the database is not the identified demo database ($RETZEF_DEMO_ID)"
}
build_if_needed() {
  local sha
  # The build rewrites next-env.d.ts, so that file is left out or every start would rebuild.
  sha=$({ git rev-parse HEAD; git diff HEAD -- . ':(exclude)next-env.d.ts'; git ls-files --others --exclude-standard; } | shasum | cut -c1-40)
  if [[ ! -f .next/BUILD_ID || "$(cat "$DEMO_HOME/built" 2>/dev/null)" != "$sha" ]]; then
    echo "Building the app (a few minutes)..."
    npx next build > "$LOGS/build.log" 2>&1 || fail "build failed, see $LOGS/build.log"
    echo "$sha" > "$DEMO_HOME/built"
  fi
}
# The store's WordPress files and SQLite database live in $STORE/wordpress. The two small plugins
# are refreshed on every start: demo safety (no email, offline payment methods only) and the
# local exceptions that let the store and Retzef reach each other on this Mac.
store_start() {
  alive store && return
  mkdir -p "$STORE/wordpress"
  if [[ -f "$STORE/wordpress/wp-config.php" ]]; then
    mkdir -p "$STORE/wordpress/wp-content/mu-plugins"
    cp infra/wordpress/retzef-demo.php infra/wordpress/local/retzef-local-store.php "$STORE/wordpress/wp-content/mu-plugins/"
  fi
  # Playground accepts connections before WordPress is installed, so wait for its "Ready!" line.
  touch "$LOGS/store.log"
  local from=$(( $(wc -l < "$LOGS/store.log") + 1 ))
  nohup node "$PLAYGROUND" server --port "$STORE_PORT" --site-url "http://localhost:$STORE_PORT" \
    --mount-before-install "$STORE/wordpress:/wordpress" --mount "$PWD/infra/wordpress/local:/retzef-src" \
    --mount "$STORE/secrets:/retzef" --define RETZEF_DEMO_ID "$RETZEF_DEMO_ID" \
    --define RETZEF_DEMO_ENVIRONMENT true --define RETZEF_APP_PORT "$APP_PORT" "$@" >> "$LOGS/store.log" 2>&1 &
  echo $! > "$RUN/store.pid"
  for _ in $(seq 1 150); do
    tail -n +"$from" "$LOGS/store.log" | grep -q '^Ready!' && return
    alive store || break
    sleep 2
  done
  fail "the test store did not start, see $LOGS/store.log"
}

setup() {
  [[ ! -e "$PGDATA" ]] || fail "already set up in $DEMO_HOME. To start over, stop it and delete that folder."
  command -v initdb >/dev/null || fail "PostgreSQL is not installed (brew install postgresql)"
  umask 077
  mkdir -p "$RUN" "$LOGS"

  local owner_password runtime_password demo_password
  owner_password=$(random); runtime_password=$(random); demo_password=$(openssl rand -hex 8)
  printf '%s\n' "$owner_password" > "$DEMO_HOME/.pwfile"
  initdb -D "$PGDATA" -U "$OWNER" --pwfile="$DEMO_HOME/.pwfile" --auth=scram-sha-256 --encoding=UTF8 \
    --locale=C.UTF-8 > "$LOGS/initdb.log"
  rm -f "$DEMO_HOME/.pwfile"
  pg_start
  PGPASSWORD="$owner_password" createdb -h 127.0.0.1 -p "$PG_PORT" -U "$OWNER" "$DB"

  cat > "$ENV_FILE" <<EOF
RETZEF_DEMO_ID=retzef-demo-local-$(openssl rand -hex 4)
RETZEF_DEMO_ENVIRONMENT=true
APP_ENV=demo
TENANT_ENFORCEMENT=true
AUTH_FALLBACK_ENABLED=false
DEMO_MODE=false
AUTO_SEED_DEMO_DATA=false
NEXT_TELEMETRY_DISABLED=1
# The test store runs on this Mac too, so the store address is local.
WOO_ALLOW_PRIVATE_HOSTS=true
APP_URL=http://localhost:$APP_PORT
PORT=$APP_PORT
DIRECT_URL=postgresql://$OWNER:$owner_password@127.0.0.1:$PG_PORT/$DB
DATABASE_URL=postgresql://retzef_runtime:$runtime_password@127.0.0.1:$PG_PORT/$DB
AUTH_JWT_SECRET=$(random)
JWT_SECRET=$(random)
SESSION_SECRET=$(random)
ENCRYPTION_KEY=$(random)
EOF
  load_env

  echo "Applying migrations..."
  DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy > "$LOGS/migrate.log" 2>&1 ||
    fail "migrations failed, see $LOGS/migrate.log"
  DATABASE_RUNTIME_PASSWORD="$runtime_password" node scripts/provision-runtime-role.mjs > /dev/null
  owner_psql -c "CREATE TABLE retzef_demo_environment (singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), id text NOT NULL)" \
    -c "INSERT INTO retzef_demo_environment (id) VALUES ('$RETZEF_DEMO_ID')" > /dev/null

  echo "Creating the demo businesses..."
  DEMO_PASSWORD="$demo_password" node --import tsx scripts/demo/seed-local.ts > "$LOGS/seed.log" 2>&1 ||
    fail "seeding failed, see $LOGS/seed.log"
  cat > "$DEMO_HOME/credentials.txt" <<EOF
Retzef local demo: http://localhost:$APP_PORT
Password for every demo account: $demo_password

רהיטי הדגמה (the business the store connects to)
  admin.main@retzef-demo.invalid    מנהל
  staff.main@retzef-demo.invalid    עובד תפעול
מטבחי הדגמה (second business, shows the separation)
  admin.second@retzef-demo.invalid  מנהל
  staff.second@retzef-demo.invalid  עובד תפעול
EOF

  echo "Setting up the WooCommerce test store (a few minutes)..."
  npm install --prefix "$DEMO_HOME/tools" --no-audit --no-fund "@wp-playground/cli@$PLAYGROUND_VERSION" \
    > "$LOGS/tools.log" 2>&1 || fail "could not install WordPress Playground, see $LOGS/tools.log"
  mkdir -p "$STORE/secrets"
  store_start --blueprint "$PWD/infra/wordpress/local/blueprint.json"
  stop_process store
  [[ -f "$STORE/secrets/store.json" ]] || fail "the test store was not seeded, see $LOGS/store.log"
  node -e '
    const s = require(process.argv[1]);
    console.log(`
Test store: http://localhost:${process.argv[2]} (admin: http://localhost:${process.argv[2]}/wp-admin)
  WordPress user ${s.adminUser}, password ${s.adminPassword}
To connect it in Retzef (signed in as admin.main, הגדרות › אינטגרציות):
  Store address    http://localhost:${process.argv[2]}
  Consumer Key     ${s.consumerKey}
  Consumer Secret  ${s.consumerSecret}`)' "$STORE/secrets/store.json" "$STORE_PORT" >> "$DEMO_HOME/credentials.txt"

  # Same cluster and roles on restore, so ownership and the runtime role's grants are kept.
  pg_dump "$DIRECT_URL" --format=custom --file="$DEMO_HOME/baseline.dump"
  tar -C "$STORE" -czf "$DEMO_HOME/store-baseline.tgz" wordpress
  build_if_needed
  echo "Set up in $DEMO_HOME. Logins are in $DEMO_HOME/credentials.txt"
  echo "Next: bash scripts/demo/local.sh start"
}

start() {
  load_env
  mkdir -p "$RUN" "$LOGS"
  pg_start
  check_marker
  build_if_needed
  store_start --wordpress-install-mode do-not-attempt-installing
  # Started as node itself (not through npm/npx), so the recorded PID is the process to stop.
  if ! alive web; then
    nohup node node_modules/next/dist/bin/next start -p "$APP_PORT" >> "$LOGS/web.log" 2>&1 &
    echo $! > "$RUN/web.pid"
  fi
  if ! alive worker; then
    nohup node --import tsx workers/woocommerce.ts >> "$LOGS/worker.log" 2>&1 &
    echo $! > "$RUN/worker.pid"
  fi
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "http://localhost:$APP_PORT/login" && break
    sleep 1
  done
  curl -sf -o /dev/null "http://localhost:$APP_PORT/login" || fail "the app did not start, see $LOGS/web.log"
  echo "Retzef demo is running: http://localhost:$APP_PORT"
  echo "Test store: http://localhost:$STORE_PORT"
  echo "Logins: $DEMO_HOME/credentials.txt"
}

stop() {
  stop_process worker
  stop_process web
  stop_process store
  if [[ -d "$PGDATA" ]] && pg_running; then pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null; fi
  echo "Demo stopped."
}

status() {
  for name in web worker store; do alive "$name" && echo "$name: running" || echo "$name: stopped"; done
  pg_running && echo "database: running" || echo "database: stopped"
}

reset() {
  load_env
  stop_process worker
  stop_process web
  stop_process store
  pg_start
  check_marker
  [[ -f "$DEMO_HOME/baseline.dump" ]] || fail "no baseline snapshot in $DEMO_HOME"
  pg_restore --dbname="$DIRECT_URL" --clean --if-exists --single-transaction --exit-on-error \
    "$DEMO_HOME/baseline.dump"
  check_marker
  # The store goes back too: its webhooks belong to a connection the database restore removed.
  [[ -f "$DEMO_HOME/store-baseline.tgz" ]] || fail "no store snapshot in $DEMO_HOME"
  rm -rf "$STORE/wordpress"
  tar -C "$STORE" -xzf "$DEMO_HOME/store-baseline.tgz"
  echo "Demo data restored to the starting point. Run: bash scripts/demo/local.sh start"
}

tunnel() {
  load_env
  command -v cloudflared >/dev/null || fail "cloudflared is not installed (brew install cloudflared)"
  alive web || fail "the app is not running. Run: bash scripts/demo/local.sh start"
  echo "Sharing http://localhost:$APP_PORT. The public link appears below and stops working when you press Ctrl+C."
  cloudflared tunnel --no-autoupdate --url "http://localhost:$APP_PORT"
}

case "${1:-}" in
  setup|start|stop|status|reset|tunnel) "$1" ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac
