import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = dirname(fileURLToPath(import.meta.url))
const script = resolve(root, "admin-v3-staging-preflight.mjs")
const valid = {
  ADMIN_V3_STAGING: "isolated",
  ADMIN_V3_STAGING_HOST: "staging.shopcelebration.in",
  APP_BASE_URL: "https://staging.shopcelebration.in",
  NEXT_PUBLIC_SITE_INDEXABLE: "false",
  DATABASE_URL: "postgresql://celebration_v3_staging:test-placeholder@127.0.0.1:5432/celebration_v3_staging",
  DATABASE_SSL_MODE: "disable"
}
function run(changes = {}) {
  const env = { PATH: process.env.PATH, ...valid, ...changes }
  return spawnSync(process.execPath, [script], { env, encoding: "utf8" })
}
assert.equal(run().status, 0, "isolated example must pass")
const rejected = {
  noGate: { ADMIN_V3_STAGING: undefined },
  indexable: { NEXT_PUBLIC_SITE_INDEXABLE: "true" },
  productionHost: { APP_BASE_URL: "https://shopcelebration.in", ADMIN_V3_STAGING_HOST: "shopcelebration.in" },
  productionAlias: { APP_BASE_URL: "https://www.shopcelebration.in", ADMIN_V3_STAGING_HOST: "www.shopcelebration.in" },
  httpHost: { APP_BASE_URL: "http://staging.shopcelebration.in" },
  hostMismatch: { ADMIN_V3_STAGING_HOST: "other.example.test" },
  productionDbName: { DATABASE_URL: "postgresql://celebration_v3_staging:x@127.0.0.1:5432/celebration" },
  wrongDbRole: { DATABASE_URL: "postgresql://postgres:x@127.0.0.1:5432/celebration_v3_staging" },
  remoteDb: { DATABASE_URL: "postgresql://celebration_v3_staging:x@db.example.com:5432/celebration_v3_staging" },
  gatewaySecret: { CASHFREE_SECRET_KEY: "test-placeholder" },
  courierSecret: { SHIPWAY_LICENSE_KEY: "test-placeholder" },
  telegramSecret: { TELEGRAM_BOT_TOKEN: "test-placeholder" },
  paymentLive: { PAYMENT_MODE: "production" },
  vercelPreview: { VERCEL_ENV: "preview" }
}
for (const [caseName, changes] of Object.entries(rejected)) {
  const result = run(changes)
  assert.notEqual(result.status, 0, `${caseName} must fail closed`)
  assert.match(result.stderr, /REFUSED:/, `${caseName} must explain refusal`)
  assert(!result.stdout.includes("PASS:"), `${caseName} must not claim success`)
}
console.log("PASS: Admin V3 staging guard accepts safe fixture and rejects 14 unsafe configurations.")
