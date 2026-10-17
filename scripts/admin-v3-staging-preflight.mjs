/**
 * Non-mutating, fail-closed Admin V3 private-staging environment preflight.
 * Run BEFORE staging starts. No network, DB connection or filesystem writes.
 */
const env = process.env
function refusal(message) {
  console.error(`REFUSED: ${message}`)
  process.exitCode = 1
  throw new Error("STAGING_PREFLIGHT_REFUSED")
}
function requireCheck(ok, message) { if (!ok) refusal(message) }
function url(key, protocols) {
  let value
  try { value = new URL(env[key] || "") } catch { refusal(`${key} must be a valid URL`) }
  requireCheck(protocols.includes(value.protocol), `${key} has an unexpected protocol`)
  requireCheck(!value.hash && !value.search, `${key} must not contain a query or fragment`)
  return value
}
function main() {
  requireCheck(env.ADMIN_V3_STAGING === "isolated", "ADMIN_V3_STAGING must equal isolated")
  requireCheck(env.NEXT_PUBLIC_SITE_INDEXABLE === "false", "Indexing must be explicitly disabled")
  const app = url("APP_BASE_URL", ["https:"])
  const hostname = app.hostname.toLowerCase()
  requireCheck(!app.username && !app.password && !app.port, "APP_BASE_URL must not contain credentials or nonstandard port")
  requireCheck(app.pathname === "/" || !app.pathname, "APP_BASE_URL must not contain a path")
  requireCheck(!["shopcelebration.in", "www.shopcelebration.in", "localhost", "127.0.0.1"].includes(hostname),
    "Production or non-HTTPS-capable physical-passkey host is forbidden")
  requireCheck(env.ADMIN_V3_STAGING_HOST === hostname, "ADMIN_V3_STAGING_HOST must match APP_BASE_URL")
  const db = url("DATABASE_URL", ["postgres:", "postgresql:"])
  requireCheck(["127.0.0.1", "localhost", "[::1]"].includes(db.hostname), "Staging DB must use loopback")
  requireCheck(db.port === "5432", "Staging DB port must be 5432")
  requireCheck(db.pathname === "/celebration_v3_staging", "Staging DB name must be celebration_v3_staging")
  requireCheck(decodeURIComponent(db.username) === "celebration_v3_staging", "Use dedicated celebration_v3_staging role")
  requireCheck(Boolean(db.password), "Staging DB needs a dedicated credential")
  requireCheck(env.DATABASE_SSL_MODE === "disable", "Loopback staging DB requires DATABASE_SSL_MODE=disable")
  requireCheck(!env.PGHOST && !env.PGPORT && !env.PGDATABASE && !env.PGUSER, "Remove conflicting PG* overrides")
  const externalKeys = [
    "CASHFREE_APP_ID", "CASHFREE_SECRET_KEY", "CASHFREE_WEBHOOK_SECRET",
    "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET",
    "SHIPWAY_EMAIL", "SHIPWAY_LICENSE_KEY", "SHIPWAY_WAREHOUSE_ID",
    "TELEGRAM_BOT_TOKEN", "TELEGRAM_ADMIN_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET",
    "TELEGRAM_COURIER_POLL_SECRET", "MSG91_AUTH_KEY", "MSG91_WIDGET_TOKEN",
    "MSG91_WIDGET_ID", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "CELEBRATION_REDIS_URL"
  ]
  const present = externalKeys.filter(key => Boolean(env[key]?.trim()))
  requireCheck(!present.length, `No external integration credentials allowed at isolation gate: ${present.join(", ")}`)
  requireCheck(!env.PAYMENT_MODE || env.PAYMENT_MODE.toLowerCase() === "sandbox",
    "Production payment mode forbidden")
  requireCheck(!env.VERCEL && !env.VERCEL_ENV, "No Vercel deployment for this private staging checkpoint")
  console.log("PASS: V3 isolated staging configuration; no DB, HTTP or provider access attempted.")
  console.log("STILL REQUIRED: verify independent DB grants, private access, isolated session keys and login.")
}
try { main() } catch (error) {
  if (error?.message !== "STAGING_PREFLIGHT_REFUSED") throw error
}
