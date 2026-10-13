import { query, transaction } from "./db"
import { isSafePublicOrderId } from "../validation/identifiers"

export type TelegramReplyInput = {
  updateId: number
  messageId: number
  replyToMessageId: number
  text: string
}

export async function recordTelegramOrderReply(input: TelegramReplyInput) {
  if (![input.updateId, input.messageId, input.replyToMessageId].every(
    value => Number.isSafeInteger(value) && value > 0
  )) return { ok: false as const, reason: "INVALID_MESSAGE_ID" }
  const text = typeof input.text === "string" ? input.text.trim() : ""
  if (!text || text.length > 2000) return { ok: false as const, reason: "MESSAGE_LENGTH_INVALID" }

  return transaction(async client => {
    const matched = await client.query<{ order_id: string; public_id: string }>(
      `SELECT q.order_id, o.public_id
         FROM telegram_notification_outbox q
         JOIN orders o ON o.id = q.order_id
        WHERE q.telegram_message_id = $1
          AND q.sent_at IS NOT NULL
        ORDER BY q.id DESC LIMIT 1`,
      [input.replyToMessageId]
    )
    const order = matched.rows[0]
    if (!order) return { ok: false as const, reason: "UNKNOWN_ORDER_NOTIFICATION" }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO telegram_order_messages
        (order_id, body, telegram_update_id, telegram_message_id, reply_to_telegram_message_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [order.order_id, text, input.updateId, input.messageId, input.replyToMessageId]
    )
    return { ok: true as const, duplicate: !inserted.rowCount, publicId: order.public_id }
  })
}

async function ownsOrder(publicId: string, accountId: string) {
  if (!isSafePublicOrderId(publicId)) return null
  const found = await query<{ id: string }>(
    `SELECT id FROM orders WHERE public_id=$1 AND customer_account_id=$2 LIMIT 1`,
    [publicId, accountId]
  )
  return found.rows[0]?.id || null
}

export async function listCustomerOrderMessages(publicId: string, accountId: string) {
  const orderId = await ownsOrder(publicId, accountId)
  if (!orderId) return null
  const rows = await query<{
    id: string
    sender: string
    body: string
    sent_at: Date
    read_at: Date | null
  }>(
    `SELECT id,sender,body,sent_at,read_at
       FROM telegram_order_messages
      WHERE order_id=$1 ORDER BY sent_at DESC,id DESC LIMIT 100`,
    [orderId]
  )
  const unread = await query<{ count: number }>(
    `SELECT count(*)::int AS count FROM telegram_order_messages WHERE order_id=$1 AND sender='celebration_support' AND read_at IS NULL`,
    [orderId]
  )
  return {
    messages: rows.rows.reverse().map(row => ({
      id: row.id,
      sender: row.sender,
      body: row.body,
      sentAt: row.sent_at.toISOString(),
      readAt: row.read_at?.toISOString() ?? null
    })),
    unreadCount: unread.rows[0]?.count || 0
  }
}

export async function acknowledgeCustomerOrderMessages(publicId: string, accountId: string) {
  const orderId = await ownsOrder(publicId, accountId)
  if (!orderId) return null
  const result = await query(
    `UPDATE telegram_order_messages SET read_at=now()
      WHERE order_id=$1 AND sender='celebration_support' AND read_at IS NULL`,
    [orderId]
  )
  return { acknowledged: result.rowCount || 0 }
}

export async function sendCustomerOrderMessage(publicId: string, accountId: string, body: string, requestId: string) {
  const trimmed = typeof body === "string" ? body.trim() : ""
  if (!trimmed || trimmed.length > 1200 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))
    return { ok: false as const, reason: "INVALID_MESSAGE" }
  const orderId = await ownsOrder(publicId, accountId)
  if (!orderId) return { ok: false as const, reason: "ORDER_NOT_FOUND" }
  const inserted = await query<{ id: string; body: string; sent_at: Date }>(
    `INSERT INTO telegram_order_messages (order_id,sender,body,client_message_id)
      VALUES ($1,'customer',$2,$3::uuid)
      ON CONFLICT (client_message_id) DO NOTHING
      RETURNING id,body,sent_at`,
    [orderId, trimmed, requestId]
  )
  // A retry never queues the same message twice; do not reveal any message
  // associated with another account even if a request ID were to collide.
  const previous = inserted.rows[0] ? null : await query<{ id: string; body: string; sent_at: Date }>(
    `SELECT m.id,m.body,m.sent_at
       FROM telegram_order_messages m JOIN orders o ON o.id=m.order_id
      WHERE m.client_message_id=$1::uuid AND o.customer_account_id=$2
        AND o.public_id=$3 AND m.sender='customer' LIMIT 1`,
    [requestId, accountId, publicId]
  )
  const row = inserted.rows[0] || previous?.rows[0]
  if (!row) return { ok: false as const, reason: "MESSAGE_CONFLICT" }
  return { ok: true as const, message: {
    id: row.id, sender: "customer" as const, body: row.body,
    sentAt: row.sent_at.toISOString(), readAt: null
  }}
}

