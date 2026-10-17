/** Populate only disposable synthetic Admin V3 VPS staging data. */
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import pg from "pg"
import "./admin-v3-staging-loopback-preflight.mjs"

const db = new URL(process.env.DATABASE_URL)
const client = new pg.Client({ connectionString: db.href, ssl: false })
await client.connect()
try {
  const identity = (await client.query("SELECT current_database() AS db, current_user AS role")).rows[0]
  assert.equal(identity.db, "celebration_v3_staging")
  assert.equal(identity.role, "celebration_v3_staging")
  const requiredTables = [
    "catalog_config", "catalog_revisions", "product_inventory", "orders",
    "customer_accounts", "admin_passkeys", "store_settings"
  ]
  for (const name of requiredTables) {
    const row = (await client.query("SELECT to_regclass($1) AS name", ["public." + name])).rows[0]
    assert(row.name, "Migrations incomplete: " + name)
  }
  for (const name of [
    "catalog_config", "catalog_revisions", "product_inventory", "orders",
    "customer_accounts", "admin_passkeys", "store_settings"
  ]) {
    const row = (await client.query("SELECT count(*)::integer AS n FROM " + name)).rows[0]
    assert.equal(row.n, 0, "Expected empty NEW isolated staging table: " + name)
  }

  const raw = JSON.parse(await readFile(new URL("../content/catalog.json", import.meta.url), "utf8"))
  const tier = raw.tiers.find(row => row.id === raw.settings.defaultTierId)
  assert(tier && tier.active !== false, "Cannot find safe reference tier")
  const catalog = {
    tiers: [tier],
    occasions: [raw.settings.defaultOccasion],
    settings: raw.settings,
    products: [{
      id: "staging-qa-necklace-001",
      name: "Synthetic QA Necklace",
      category: "Synthetic QA",
      minTier: 0,
      points: 1,
      active: true,
      sellIndividually: true,
      salePricePaise: 19900,
      note: "STAGING ONLY: imaginary product, never offered on live website."
    }]
  }
  await client.query("BEGIN")
  try {
    await client.query(
      "INSERT INTO catalog_config (id, payload, version, updated_at) VALUES ('primary', $1::jsonb, 1, now())",
      [JSON.stringify(catalog)]
    )
    await client.query("INSERT INTO catalog_revisions (version, payload) VALUES (1, $1::jsonb)",
      [JSON.stringify(catalog)])
    await client.query(
      "INSERT INTO product_inventory(product_id,available_quantity) VALUES ('staging-qa-necklace-001',5)"
    )
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }
  console.log("PASS: synthetic-only catalog and 5 test units seeded into isolated staging DB.")
} finally {
  await client.end()
}
