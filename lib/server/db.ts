import { Pool, type PoolClient, type QueryResultRow } from "pg"
import { databaseConfig } from "../../config/database"
import { env, requireEnv } from "../../config/env"

let pool: Pool | null = null

function getPool() {
  if (pool) return pool
  const connectionString = requireEnv("databaseUrl")
  const ssl = env.databaseSsl === "disable" ? false : { rejectUnauthorized: true }
  pool = new Pool({
    connectionString,
    ssl,
    max: databaseConfig.poolMaxConnections,
    idleTimeoutMillis: databaseConfig.idleTimeoutMillis
  })
  return pool
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values)
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    const result = await work(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
