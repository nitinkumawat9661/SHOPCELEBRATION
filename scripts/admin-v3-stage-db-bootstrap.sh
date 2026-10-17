#!/usr/bin/env bash
# ONE-TIME bootstrap of the *new* isolated Celebration Admin V3 database.
# Runs only on the owner's Linux VPS, requires interactive sudo rights for
# postgres, and NEVER reads/modifies production DB/env/services.
set -Eeuo pipefail
set +x
umask 077

fail() { printf 'REFUSED: %s\n' "$*" >&2; exit 1; }
[ "$(id -un)" = "nitin" ] || fail "Run as user nitin on the existing VPS."
[ "$HOME" = "/home/nitin" ] || fail "Expected /home/nitin HOME."
for bin in sudo psql createdb node pg_isready; do
  command -v "$bin" >/dev/null 2>&1 || fail "Missing: $bin"
done
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || fail "Node 22+ required"
pg_isready -q -h 127.0.0.1 -p 5432 -t 3 || fail "Loopback PostgreSQL unavailable"

readonly ROLE="celebration_v3_staging"
readonly DB="celebration_v3_staging"
readonly PRIVATE_DIR="$HOME/.config/celebration-v3-staging"
readonly CREDENTIAL_FILE="$PRIVATE_DIR/database-url"

if [ -e "$CREDENTIAL_FILE" ]; then
  fail "Staging database credentials already exist. No replacement will be attempted."
fi

printf 'Checking interactive sudo rights to create ONLY the new staging database...\n'
sudo -v || fail "Sudo unavailable. Ask the VPS administrator to provision the dedicated DB/role; do not supply credentials in chat."
role_exists="$(sudo -u postgres psql -X -Atq -d postgres -c "SELECT count(*) FROM pg_roles WHERE rolname = '$ROLE'")" ||
  fail "Cannot read PostgreSQL role metadata using postgres OS role"
db_exists="$(sudo -u postgres psql -X -Atq -d postgres -c "SELECT count(*) FROM pg_database WHERE datname = '$DB'")" ||
  fail "Cannot read PostgreSQL DB metadata using postgres OS role"
[ "$role_exists" = "0" ] || fail "The reserved staging role already exists; stopping rather than resetting an existing credential."
[ "$db_exists" = "0" ] || fail "The reserved staging database already exists; stopping rather than reusing or altering it."
[ ! -e "$PRIVATE_DIR" ] || fail "Private staging directory already exists; inspect it before first-time bootstrap."

secret="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
[ "${#secret}" -eq 64 ] || fail "Random password generation failed"

# Never echo passwords, set shell tracing, publish tokens, or target production.
printf 'Creating new dedicated PostgreSQL role and database (no existing DB changes)...\n'
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d postgres \
  -c "CREATE ROLE $ROLE LOGIN PASSWORD '$secret' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;" >/dev/null \
  || fail "Role creation failed; check PostgreSQL before retrying."
sudo -u postgres createdb --encoding=UTF8 --template=template0 --owner="$ROLE" "$DB" \
  || fail "Staging role created, but database failed; manual postgres reconciliation required. DO NOT drop any other database."
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d postgres \
  -c "REVOKE ALL ON DATABASE $DB FROM PUBLIC;" >/dev/null \
  || fail "Staging DB created, but restricting PUBLIC DB rights failed"
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d "$DB" \
  -c "REVOKE ALL ON SCHEMA public FROM PUBLIC;" >/dev/null \
  || fail "Staging DB created, but restricting PUBLIC schema rights failed"

install -d -m 700 "$PRIVATE_DIR"
tmp="$(mktemp "$PRIVATE_DIR/.database-url.XXXXXX")"
trap 'rm -f -- "$tmp"' EXIT
printf 'postgresql://%s:%s@127.0.0.1:5432/%s\n' "$ROLE" "$secret" "$DB" > "$tmp"
chmod 600 "$tmp"
mv -n -- "$tmp" "$CREDENTIAL_FILE"
unset secret
[ -s "$CREDENTIAL_FILE" ] || fail "Credential file was not saved"
chmod 600 "$CREDENTIAL_FILE"

# Connect using the stored database URL without writing its contents to a log.
database_url="$(<"$CREDENTIAL_FILE")"
identity="$(DATABASE_URL="$database_url" node -e '
const { Client } = require("pg")
const client = new Client({connectionString:process.env.DATABASE_URL,ssl:false})
;(async()=>{await client.connect()
 const r=await client.query("SELECT current_database() AS d, current_user AS u")
 process.stdout.write(r.rows[0].d + " " + r.rows[0].u)
 await client.end()})().catch(e=>{console.error(e.code||"DB_LOGIN_FAILED");process.exit(1)})
' 2>&1)" || fail "DB authentication verification failed: $identity"
unset database_url
[ "$identity" = "$DB $ROLE" ] || fail "Staging DB identity mismatch"
printf 'PASS: dedicated stage-only Postgres DB and least-privilege role created.\n'
printf 'PASS: private credentials stored at ~/.config/celebration-v3-staging/database-url (never share).\n'
printf 'UNCHANGED: production database, running website, PM2, Nginx and Redis.\n'
