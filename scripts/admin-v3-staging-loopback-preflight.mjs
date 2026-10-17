/**
 * Fail-closed guard for private SSH-tunneled localhost staging on the owner's
 * existing VPS. Separate from the HTTPS-host preflight. No network or writes.
 *
 * APP_BASE_URL=http://localhost:3055 is valid for WebAuthn under browser
 * localhost secure-context exception. It MUST be accessed only through SSH
 * local port forwarding, NEVER through a public reverse proxy.
 */
import assert from "node:assert/strict"

const env = process.env
function must(condition, code) { assert(condition, code) }
must(env.ADMIN_V3_STAGING === "isolated-loopback", "STAGING_MARKER_REQUIRED")
must(env.NODE_ENV === "production", "NEXT_PRODUCTION_SERVER_REQUIRED")
must(env.APP_BASE_URL === "http://localhost:3055", "LOCALHOST_TUNNEL_ORIGIN_REQUIRED")
must(env.ADMIN_V3_STAGING_HOST === "localhost", "STAGING_HOST_MISMATCH")
must(env.NEXT_PUBLIC_SITE_INDEXABLE === "false", "INDEXING_MUST_BE_DISABLED")
must(!env.NEXT_PUBLIC_GA4_MEASUREMENT_ID, "GA4_MUST_NOT_TRACK_STAGING")
must(env.DATABASE_SSL_MODE === "disable", "LOOPBACK_DB_SSL_MODE")
const db = new URL(env.DATABASE_URL || "invalid:")
must(db.protocol === "postgresql:" || db.protocol === "postgres:", "INVALID_DB_PROTOCOL")
must(db.hostname === "127.0.0.1", "DB_MUST_USE_IPV4_LOOPBACK")
must(db.port === "5432", "DB_PORT_MISMATCH")
must(db.pathname === "/celebration_v3_staging", "STAGING_DB_REQUIRED")
must(decodeURIComponent(db.username) === "celebration_v3_staging", "STAGING_DB_ROLE_REQUIRED")
must(Boolean(db.password) && !db.search && !db.hash, "STAGING_DB_PASSWORD_REQUIRED")
must(!env.PGHOST && !env.PGPORT && !env.PGDATABASE && !env.PGUSER && !env.PGPASSWORD,
  "PG_OVERRIDES_FORBIDDEN")
must(env.PAYMENT_MODE === "sandbox", "PAYMENT_SANDBOX_REQUIRED")
must(!env.PAYMENT_PROVIDER && !env.SMS_PROVIDER, "PROVIDERS_MUST_BE_DISABLED")
must(!env.VERCEL && !env.VERCEL_ENV, "VERCEL_FORBIDDEN")
must(!env.CELEBRATION_REDIS_URL, "STAGING_REDIS_MUST_BE_DISABLED")
const forbidden = [
  "CASHFREE_APP_ID","CASHFREE_SECRET_KEY","CASHFREE_WEBHOOK_SECRET",
  "RAZORPAY_KEY_ID","RAZORPAY_KEY_SECRET","RAZORPAY_WEBHOOK_SECRET",
  "SHIPWAY_EMAIL","SHIPWAY_LICENSE_KEY","SHIPWAY_WAREHOUSE_ID",
  "SHIPWAY_RETURN_WAREHOUSE_ID","TELEGRAM_BOT_TOKEN",
  "TELEGRAM_ADMIN_CHAT_ID","TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_COURIER_POLL_SECRET","MSG91_AUTH_KEY","MSG91_WIDGET_TOKEN",
  "MSG91_WIDGET_ID","R2_ACCOUNT_ID","R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY","R2_BUCKET",
  "SMS_API_KEY","CASHFREE_ENV"
]
const active = forbidden.filter(key => env[key]?.trim())
must(active.length === 0, "FORBIDDEN_EXTERNAL_INTEGRATIONS: " + active.join(","))
must(/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(env.ADMIN_PASSWORD_SCRYPT || ""),
  "ISOLATED_BOOTSTRAP_PASSWORD_HASH_REQUIRED")
for(const key of ["ADMIN_SESSION_SECRET", "TRACKING_TOKEN_SECRET", "PASSWORD_RESET_SECRET"]){
  must((env[key] || "").length >= 64, key + "_REQUIRED")
}
must((env.ADMIN_SESSION_VERSION || "").length >= 24, "SESSION_VERSION_REQUIRED")
must(new Set([
  env.ADMIN_SESSION_SECRET,env.TRACKING_TOKEN_SECRET,env.PASSWORD_RESET_SECRET
]).size === 3, "SECRETS_MUST_BE_INDEPENDENT")
console.log("PASS: SSH-loopback staging guard; external integrations blocked; DB target validated.")
