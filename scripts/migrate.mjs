import { readdir, readFile } from "node:fs/promises"
import { basename } from "node:path"
import pg from "pg"

const connectionString = process.env.DATABASE_URL?.trim()
if (!connectionString) throw new Error("DATABASE_URL is required")

const sslMode = process.env.DATABASE_SSL_MODE?.trim()
const migrationsDir = new URL("../db/migrations/", import.meta.url)
const client = new pg.Client({ connectionString, ssl: sslMode === "disable" ? false : { rejectUnauthorized: true } })

await client.connect()
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const files = (await readdir(migrationsDir)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()
  const applied = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((row) => row.name))

  for (const name of files) {
    if (applied.has(name)) continue
    const sql = await readFile(new URL(name, migrationsDir), "utf8")
    await client.query("BEGIN")
    try {
      await client.query(sql)
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [basename(name)])
      await client.query("COMMIT")
      console.log(`Applied migration: ${name}`)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  }
  console.log("Database migrations are up to date.")
} finally {
  await client.end()
}
