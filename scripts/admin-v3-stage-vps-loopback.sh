#!/usr/bin/env bash
# First-time, isolated, NONPUBLIC Admin V3 VPS staging deployment.
# Requires completion of scripts/admin-v3-stage-db-bootstrap.sh.
# No production env, database, PM2 service, Nginx, DNS or Redis is modified.
set -Eeuo pipefail
set +x
umask 077

fail() { printf 'REFUSED: %s\n' "$*" >&2; exit 1; }
[ "$(id -un)" = "nitin" ] || fail "Expected VPS user nitin"
[ "$HOME" = "/home/nitin" ] || fail "Expected /home/nitin HOME"
for executable in git node npm pm2 psql ss curl; do
  command -v "$executable" >/dev/null 2>&1 || fail "Missing $executable"
done
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || fail "Node 22+ required"
[ -f "$HOME/.config/celebration-v3-staging/database-url" ] ||
  fail "Run stage database bootstrap first; dedicated credentials missing."
[ ! -L "$HOME/.config/celebration-v3-staging/database-url" ] ||
  fail "Database credential file cannot be a symlink."
[ "$(stat -c %a "$HOME/.config/celebration-v3-staging/database-url")" = "600" ] ||
  fail "Private staging database credential must be mode 600."

readonly STAGING_NAME="celebration-v3-staging"
readonly ROOT="$HOME/celebration-v3-staging"
readonly SOURCE="$ROOT/source"
readonly PRIVATE_DIR="$HOME/.config/celebration-v3-staging"
readonly ENV_FILE="$PRIVATE_DIR/.env.production"
readonly BOOTSTRAP_PASSWORD_FILE="$PRIVATE_DIR/first-login-password"
readonly BRANCH="feat/admin-v3-phase1-20261017"
readonly PORT="3055"

[ ! -e "$ROOT" ] || fail "Staging app directory already exists. Refusing to overwrite an existing installation."
[ ! -e "$ENV_FILE" ] || fail "Staging env already exists. Refusing credential rotation."
[ ! -e "$BOOTSTRAP_PASSWORD_FILE" ] || fail "First-login secret already exists. Refusing credential rotation."
if pm2 describe "$STAGING_NAME" >/dev/null 2>&1; then
  fail "Staging PM2 process already registered. No production process will be changed."
fi
if ss -H -ltn 2>/dev/null | awk '$4 ~ /:3055$/ {found=1} END{exit !found}'; then
  fail "Staging port 3055 became occupied. Cannot start safely."
fi

# Create app in user's home directory, not /var/www or production release tree.
install -d -m 700 "$ROOT"
printf 'Fetching exact development branch into an isolated home-directory tree...\n'
git clone --depth 1 --single-branch --branch "$BRANCH" \
  https://github.com/nitinkumawat9661/SHOPCELEBRATION.git "$SOURCE"
[ -d "$SOURCE/.git" ] || fail "Source checkout incomplete."
(
  cd "$SOURCE"
  git diff --quiet || fail "Checkout must remain unmodified"
  test "$(git branch --show-current)" = "$BRANCH" || fail "Wrong source branch"
)
printf 'Preparing independent test-only admin credentials locally (no secrets printed)...\n'
node - "$PRIVATE_DIR/database-url" "$ENV_FILE" "$BOOTSTRAP_PASSWORD_FILE" <<'NODE'
const fs = require('node:fs')
const { randomBytes, scryptSync } = require('node:crypto')
const [dbFile, envFile, passwordFile] = process.argv.slice(2)
const dbUrl = fs.readFileSync(dbFile, 'utf8').trim()
const url = new URL(dbUrl)
if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' ||
  url.port !== '5432' || url.pathname !== '/celebration_v3_staging' ||
  decodeURIComponent(url.username) !== 'celebration_v3_staging' ||
  !url.password || url.search || url.hash) {
  throw new Error('Unsafe staging-only DB URL. No env written.')
}
const hex = size => randomBytes(size).toString('hex')
const password = hex(20)
const salt = randomBytes(16)
const derived = scryptSync(password, salt, 64, {N:16384,r:8,p:1,maxmem:67108864})
const entries = {
  ADMIN_V3_STAGING: 'isolated-loopback',
  ADMIN_V3_STAGING_HOST: 'localhost',
  NEXT_PUBLIC_SITE_INDEXABLE: 'false',
  APP_BASE_URL: 'http://localhost:3055',
  DATABASE_URL: dbUrl,
  DATABASE_SSL_MODE: 'disable',
  ADMIN_PASSWORD_SCRYPT: salt.toString('hex') + ':' + derived.toString('hex'),
  ADMIN_SESSION_SECRET: hex(32),
  ADMIN_SESSION_VERSION: hex(16),
  TRACKING_TOKEN_SECRET: hex(32),
  PASSWORD_RESET_SECRET: hex(32),
  PAYMENT_MODE: 'sandbox',
  ORDER_ID_PREFIX: 'V3QA',
  NEXT_TELEMETRY_DISABLED: '1'
}
const data = Object.entries(entries).map(([key,value])=>key + '=' + value).join('\n') + '\n'
fs.writeFileSync(envFile, data, {mode:0o600,flag:'wx'})
fs.writeFileSync(passwordFile, password + '\n', {mode:0o600,flag:'wx'})
console.log('PASS: separate staging credentials, WebAuthn-localhost and no-index configured.')
NODE

ln -s "$ENV_FILE" "$SOURCE/.env.production"
cd "$SOURCE"

# Run Next and DB tools with an empty external environment, so production
# integration keys accidentally exported in the operator shell cannot leak in.
sanitized_node() {
  env -i HOME="$HOME" PATH="$PATH" USER=nitin NODE_ENV=production node "$@"
}
sanitized_npm() {
  env -i HOME="$HOME" PATH="$PATH" USER=nitin NODE_ENV=production npm "$@"
}
printf 'Installing staging dependencies only...\n'
sanitized_npm ci

printf 'Running staging environment preflight before any SQL migration...\n'
sanitized_node -e 'const {loadEnvConfig}=require("@next/env");loadEnvConfig(process.cwd(),false);import("./scripts/admin-v3-staging-loopback-preflight.mjs").catch(e=>{console.error(e.message);process.exitCode=1})'

# Verify database identity before allowing the migration runner to execute.
sanitized_node -e 'const {loadEnvConfig}=require("@next/env");loadEnvConfig(process.cwd(),false);const pg=require("pg");const c=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:false});c.connect().then(()=>c.query("SELECT current_database() AS db, current_user AS role")).then(r=>{if(r.rows[0].db!=="celebration_v3_staging" || r.rows[0].role!=="celebration_v3_staging")throw Error("REFUSED: staging database role mismatch");console.log("PASS: isolated database identity verified.")}).catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>c.end())'
printf 'Migrating ONLY dedicated staging DB...\n'
sanitized_node -e 'const {loadEnvConfig}=require("@next/env");loadEnvConfig(process.cwd(),false);import("./scripts/migrate.mjs").catch(e=>{console.error(e.message);process.exitCode=1})'

printf 'Inserting synthetic test-only catalog, never real inventory...\n'
sanitized_node -e 'const {loadEnvConfig}=require("@next/env");loadEnvConfig(process.cwd(),false);import("./scripts/admin-v3-stage-synthetic-seed.mjs").catch(e=>{console.error(e.message);process.exitCode=1})'

printf 'Building production-mode Next assets only for PRIVATE staging...\n'
sanitized_npm run build

# Port remains bound to 127.0.0.1. Deliberately NO Nginx, DNS or public HTTPS.
started=0
on_exit() {
  result=$?
  if [ "$result" -ne 0 ] && [ "$started" -eq 1 ]; then
    env -i HOME="$HOME" PATH="$PATH" USER=nitin PM2_HOME="$HOME/.pm2" \
      pm2 delete "$STAGING_NAME" >/dev/null 2>&1 || true
  fi
}
trap on_exit EXIT
printf 'Starting private, loopback-only PM2 staging on port 3055...\n'
env -i HOME="$HOME" PATH="$PATH" USER=nitin NODE_ENV=production PM2_HOME="$HOME/.pm2" \
  pm2 start "$SOURCE/node_modules/next/dist/bin/next" --name "$STAGING_NAME" \
  --cwd "$SOURCE" -- start -H 127.0.0.1 -p "$PORT"
started=1
healthy=0
for attempt in $(seq 1 45); do
  if curl --silent --show-error --fail --max-time 2 \
      "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q '"ok":true'; then
    healthy=1
    break
  fi
  sleep 2
done
[ "$healthy" -eq 1 ] || fail "Isolated staging failed its local health check; stage-only PM2 process will be stopped."
ss -H -ltn | grep -Eq '127\.0\.0\.1:3055[[:space:]]' ||
  fail "Staging is not exclusively bound to 127.0.0.1; stage-only PM2 process will be stopped."
printf 'PASS: staging health and localhost-only listener verified.\n'
printf 'STAGING_SOURCE_COMMIT=%s\n' "$(git rev-parse HEAD)"
printf 'STAGING_URL_VIA_SSH_TUNNEL=http://localhost:3055/admin/v3\n'
printf 'FIRST_LOGIN_PASSWORD_STORED_LOCALLY=~/.config/celebration-v3-staging/first-login-password\n'
printf 'NO CHANGES to production PM2 service, catalog, production DB, DNS or Nginx.\n'
