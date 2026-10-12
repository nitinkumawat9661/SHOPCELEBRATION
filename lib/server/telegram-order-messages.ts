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
       ON CONFLICT (telegram_update_id) DO NOTHING
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
      WHERE order_id=$1 ORDER BY sent_at ASC,id ASC LIMIT 100`,
    [orderId]
  )
  return {
    messages: rows.rows.map(row => ({
      id: row.id,
      sender: row.sender,
      body: row.body,
      sentAt: row.sent_at.toISOString(),
      readAt: row.read_at?.toISOString() ?? null
    })),
    unreadCount: rows.rows.filter(row => !row.read_at).length
  }
}

export async function acknowledgeCustomerOrderMessages(publicId: string, accountId: string) {
  const orderId = await ownsOrder(publicId, accountId)
  if (!orderId) return null
  const result = await query(
    `UPDATE telegram_order_messages SET read_at=now()
      WHERE order_id=$1 AND read_at IS NULL`,
    [orderId]
  )
  return { acknowledged: result.rowCount || 0 }
}
