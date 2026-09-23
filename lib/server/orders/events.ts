import type { PoolClient } from "pg"
import { randomUUID } from "node:crypto"

export async function appendOrderEvent(
  client: PoolClient,
  orderId: string,
  eventType: string,
  payload: Record<string, unknown> = {}
) {
  await client.query(
    `INSERT INTO order_events (id, order_id, event_type, payload) VALUES ($1,$2,$3,$4::jsonb)`,
    [randomUUID(), orderId, eventType, JSON.stringify(payload)]
  )
}
