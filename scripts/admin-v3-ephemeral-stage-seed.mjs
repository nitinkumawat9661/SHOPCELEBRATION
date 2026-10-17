/**
 * Fixture setup for disposable, GitHub-hosted Admin V3 HTTP integration only.
 * Explicit localhost/database/role identity checks prevent unsafe use.
 */
import assert from "node:assert/strict"
import pg from "pg"
import { readFile } from "node:fs/promises"

assert.equal(process.env.GITHUB_ACTIONS, "true", "Only GitHub isolated CI runner is permitted")
assert.equal(process.env.ADMIN_V3_STAGING, "ephemeral-ci")
assert.equal(process.env.NEXT_PUBLIC_SITE_INDEXABLE, "false")
const url = new URL(process.env.DATABASE_URL || "invalid:")
assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
assert.equal(url.port, "5432")
assert.equal(url.pathname, "/celebration_v3_staging")
assert.equal(decodeURIComponent(url.username), "celebration_v3_staging")
assert.equal(process.env.DATABASE_SSL_MODE, "disable")
const client = new pg.Client({ connectionString: url.href, ssl: false })
await client.connect()
try {
  const identity = (await client.query("SELECT current_database() AS db, current_user AS role")).rows[0]
  assert.equal(identity.db, "celebration_v3_staging")
  assert.equal(identity.role, "celebration_v3_staging")
  const table = (await client.query("SELECT to_regclass('public.product_inventory') AS name")).rows[0]
  assert(table.name, "Migrations must be applied to disposable staging first")
  // Seed one valid, wholly synthetic catalog SKU. An orphan inventory row is
  // intentionally rejected by the real Admin V3 stock mutation backend.
  const source = JSON.parse(await readFile(new URL("../content/catalog.json", import.meta.url), "utf8"))
  const tier = source.tiers.find(row => row.id === source.settings.defaultTierId)
  assert(tier && tier.active !== false)
  const catalog = {
    tiers: [tier],
    occasions: [source.settings.defaultOccasion],
    settings: source.settings,
    products: [{
      id: "staging-qa-necklace-001", name: "Synthetic QA Necklace",
      category: "Synthetic staging test", minTier: 0, points: 1,
      active: true, sellIndividually: true, salePricePaise: 19900,
      note: "Disposable integration fixture; no actual retail SKU"
    }]
  }
  await client.query(
    `INSERT INTO catalog_config(id, payload, version)
      VALUES ('primary', $1::jsonb, 1)`,
    [JSON.stringify(catalog)]
  )
  await client.query(
    `INSERT INTO catalog_revisions(version, payload)
      VALUES (1, $1::jsonb)`,
    [JSON.stringify(catalog)]
  )
  await client.query(
    `INSERT INTO product_inventory(product_id, available_quantity)
      VALUES ($1, 5)
      ON CONFLICT (product_id) DO UPDATE SET available_quantity=EXCLUDED.available_quantity`,
    ["staging-qa-necklace-001"]
  )
  console.log("PASS: dedicated ephemeral Postgres identity and synthetic inventory fixture")
} finally {
  await client.end()
}
