import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"
import pg from "pg"

// This check deliberately destroys ONLY the disposable test database.
// Never pass a production or hosted DATABASE_URL.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const databaseUrl = process.env.TEST_DATABASE_URL?.trim()
if (!databaseUrl) throw Error("TEST_DATABASE_URL required for a disposable localhost-only Postgres database.")
const dbUrl = new URL(databaseUrl)
if (!["127.0.0.1", "localhost", "[::1]"].includes(dbUrl.hostname) ||
    dbUrl.pathname !== "/celebration_v3_qa" ||
    !["postgres:", "postgresql:"].includes(dbUrl.protocol) ||
    dbUrl.search || dbUrl.hash || dbUrl.port !== "5432") {
  throw Error("REFUSED: V3 DB test accepts only localhost:5432/celebration_v3_qa without query/fragment.")
}

process.env.DATABASE_URL = databaseUrl
process.env.DATABASE_SSL_MODE = "disable"
process.env.NEXT_PUBLIC_SITE_INDEXABLE = "false"
const dir = await mkdtemp(join(repo, ".admin-v3-db-test-"))
const client = new pg.Client({ connectionString: databaseUrl, ssl: false })
const requireRoot = createRequire(join(repo, "package.json"))
const ts = requireRoot("typescript")
async function compileDir(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = join(folder, entry.name)
    if (entry.isDirectory()) { await compileDir(file); continue }
    if (!entry.name.endsWith(".ts")) continue
    const out = join(dir, relative(repo, file).replace(/\.ts$/, ".js"))
    await mkdir(dirname(out), { recursive: true })
    const compiled = ts.transpileModule(await readFile(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true
      }, fileName: file
    })
    await writeFile(out, compiled.outputText)
  }
}
try {
  await client.connect()
  const identity = (await client.query("SELECT current_database() as name")).rows[0]?.name
  assert.equal(identity, "celebration_v3_qa")
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")

  const migrations = (await readdir(join(repo, "db/migrations")))
    .filter(name => /^\d+_.+\.sql$/.test(name)).sort()
  for (const migration of migrations) {
    const sql = await readFile(join(repo, "db/migrations", migration), "utf8")
    await client.query("BEGIN")
    try {
      await client.query(sql)
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw new Error("Migration failed: " + migration, { cause: error })
    }
  }

  await compileDir(join(repo, "lib"))
  await compileDir(join(repo, "config"))
  await cp(join(repo, "content"), join(dir, "content"), { recursive: true })
  for (const name of await readdir(join(repo, "config"))) {
    if (name.endsWith(".json")) await cp(join(repo, "config", name), join(dir, "config", name))
  }
  const load = path => requireRoot(join(dir, path))
  const stock = load("lib/server/admin-inventory-adjustments.js")
  const settings = load("lib/server/store-settings.js")
  const customers = load("lib/server/admin-customers.js")
  const reviews = load("lib/server/admin-review-queue.js")
  const behaviour = load("lib/server/admin-behaviour-analytics.js")

  const catalog = {
    products: [{ id: "qa-necklace-001", name: "QA Necklace", category: "Jewellery",
      active: true, sellIndividually: true }],
    tiers: [], occasions: [], settings: {}
  }
  await client.query(
    "INSERT INTO catalog_config(id, payload, version) VALUES('primary', $1::jsonb, 1)", [JSON.stringify(catalog)]
  )
  await client.query(
    "INSERT INTO product_inventory(product_id, available_quantity) VALUES('qa-necklace-001', 5)"
  )
  const entry = {
    requestId: randomUUID(), productId: "qa-necklace-001",
    mode: "add", quantity: 2, expectedAvailable: 5, reason: "QA verified stock arrival"
  }
  const first = await stock.applyAdminInventoryAdjustment(entry)
  assert.equal(first.previousAvailable, 5)
  assert.equal(first.availableQuantity, 7)
  assert.equal(first.replayed, false)
  const replay = await stock.applyAdminInventoryAdjustment(entry)
  assert.equal(replay.replayed, true)
  assert.equal(replay.availableQuantity, 7)
  assert.equal((await client.query(
    "SELECT count(*)::integer AS count FROM admin_inventory_adjustments"
  )).rows[0].count, 1, "Idempotency must prevent duplicate audit entries")
  await assert.rejects(
    stock.applyAdminInventoryAdjustment({ ...entry, quantity: 3 }),
    error => error.code === "REQUEST_ID_REUSED"
  )
  await assert.rejects(
    stock.applyAdminInventoryAdjustment({ ...entry, requestId: randomUUID(), expectedAvailable: 5 }),
    error => error.code === "STOCK_CHANGED_RELOAD"
  )
  await assert.rejects(
    stock.applyAdminInventoryAdjustment({ ...entry, requestId: randomUUID(),
      expectedAvailable: 7, mode: "remove", quantity: 8 }),
    error => error.code === "STOCK_OUT_OF_RANGE"
  )
  const concurrent = await Promise.allSettled([
    stock.applyAdminInventoryAdjustment({ ...entry, requestId: randomUUID(), expectedAvailable: 7, mode: "add", quantity: 1 }),
    stock.applyAdminInventoryAdjustment({ ...entry, requestId: randomUUID(), expectedAvailable: 7, mode: "add", quantity: 1 })
  ])
  assert.equal(concurrent.filter(item => item.status === "fulfilled").length, 1,
    "Only one of two conflicting stock changes must commit")
  assert.equal(concurrent.filter(item => item.status === "rejected" && item.reason?.code === "STOCK_CHANGED_RELOAD").length, 1)
  assert.equal((await client.query(
    "SELECT available_quantity AS count FROM product_inventory WHERE product_id = 'qa-necklace-001'"
  )).rows[0].count, 8)
  assert.equal((await stock.listAdminInventoryAdjustments("qa-necklace-001")).length, 2)

  const loaded = await settings.getStoreSettings()
  const beforeVersion = loaded.version
  const saved = await settings.saveStoreSettingsVersioned(loaded.settings, beforeVersion)
  assert.equal(saved.version, beforeVersion + 1)
  await assert.rejects(
    settings.saveStoreSettingsVersioned(loaded.settings, beforeVersion),
    error => error.code === "SETTINGS_VERSION_CONFLICT"
  )

  const directory = await customers.listAdminCustomers({ page: 1, status: "all", search: "" })
  assert.equal(directory.total, 0)
  assert.deepEqual(directory.customers, [])
  const moderation = await reviews.listAdminReviewQueue({ status: "pending", page: 1, search: "" })
  assert.equal(moderation.summary.total, 0)
  assert.equal(moderation.reviews.length, 0)
  const report = await behaviour.getAdminBehaviourAnalytics(7)
  assert.equal(report.checkoutTelemetry.identifiableCheckoutRecoveryAvailable, false)
  assert.equal(report.checkoutTelemetry.cartAbandonmentAvailable, false)
  assert.equal(report.wishlist.savedRelationshipsCurrent, 0)
  assert.equal(report.dailyPaidOrders.length, 0)

  console.log("PASS: PostgreSQL 16 all migrations + V3 atomic stock, idempotency, concurrent CAS, settings version conflict, customer/review/analytics reads.")
  console.log("ISOLATED ONLY: localhost:5432/celebration_v3_qa; no production values or accounts.")
} finally {
  await client.end().catch(() => {})
  await rm(dir, { recursive: true, force: true })
}
