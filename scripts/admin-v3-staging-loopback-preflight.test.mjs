import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const file = join(dirname(fileURLToPath(import.meta.url)), "admin-v3-staging-loopback-preflight.mjs")
const base = {
  ADMIN_V3_STAGING: "isolated-loopback",
  ADMIN_V3_STAGING_HOST: "localhost",
  NODE_ENV: "production",
  NEXT_PUBLIC_SITE_INDEXABLE: "false",
  APP_BASE_URL: "http://localhost:3055",
  DATABASE_URL: "postgresql://celebration_v3_staging:fake-disposable@127.0.0.1:5432/celebration_v3_staging",
  DATABASE_SSL_MODE: "disable",
  PAYMENT_MODE: "sandbox",
  ADMIN_PASSWORD_SCRYPT: "a".repeat(32) + ":" + "b".repeat(128),
  ADMIN_SESSION_SECRET: "c".repeat(64),
  ADMIN_SESSION_VERSION: "d".repeat(32),
  TRACKING_TOKEN_SECRET: "e".repeat(64),
  PASSWORD_RESET_SECRET: "f".repeat(64)
}
function check(changes={}) {
  const env = {PATH: process.env.PATH, ...base, ...changes}
  return spawnSync(process.execPath,[file],{env,encoding:"utf8"})
}
const valid=check()
assert.equal(valid.status,0,valid.stderr)
assert.match(valid.stdout,/PASS:/)
const negatives = {
  noMarker: { ADMIN_V3_STAGING: undefined },
  wrongHostname: { ADMIN_V3_STAGING_HOST:"shopcelebration.in" },
  prodOrigin: { APP_BASE_URL:"https://shopcelebration.in" },
  publicListener: { APP_BASE_URL:"http://0.0.0.0:3055" },
  wrongPort: { APP_BASE_URL:"http://localhost:3040" },
  prodDb: {DATABASE_URL:"postgresql://celebration_v3_staging:x@127.0.0.1:5432/celebration"},
  dbRole: {DATABASE_URL:"postgresql://postgres:x@127.0.0.1:5432/celebration_v3_staging"},
  remoteDb: {DATABASE_URL:"postgresql://celebration_v3_staging:x@db.example.com:5432/celebration_v3_staging"},
  indexing: {NEXT_PUBLIC_SITE_INDEXABLE:"true"},
  redis: {CELEBRATION_REDIS_URL:"redis://127.0.0.1:6390/0"},
  cashfree: {CASHFREE_SECRET_KEY:"fake"},
  telegram: {TELEGRAM_BOT_TOKEN:"fake"},
  shipping: {SHIPWAY_LICENSE_KEY:"fake"},
  r2: {R2_SECRET_ACCESS_KEY:"fake"},
  ga4: {NEXT_PUBLIC_GA4_MEASUREMENT_ID:"G-FAKE"},
  payment: {PAYMENT_MODE:"production"},
  sms: {SMS_PROVIDER:"msg91"},
  noSession: {ADMIN_SESSION_SECRET:undefined},
  reusedSecrets: {TRACKING_TOKEN_SECRET:"c".repeat(64)},
  pgOverride: {PGHOST:"prod.internal"},
  vercel: {VERCEL_ENV:"preview"}
}
for (const [name, changes] of Object.entries(negatives)) {
  const result=check(changes)
  assert.notEqual(result.status,0,"Unsafe stage input accepted: " + name)
  assert(!result.stdout.includes("PASS:"),"Unsafe stage claimed pass: " + name)
}
console.log("PASS: SSH loopback staging guard rejects "+Object.keys(negatives).length+" unsafe configurations.")
