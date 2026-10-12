import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { env } from "../../../../../config/env"
import { readJsonBody, RequestSecurityError } from "../../../../../lib/security/request"
import { recordTelegramOrderReply } from "../../../../../lib/server/telegram-order-messages"

export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "no-store" }

type TelegramUpdate = {
  update_id?: unknown
  message?: {
    message_id?: unknown
    date?: unknown
    chat?: { id?: unknown; type?: unknown }
    from?: { id?: unknown; is_bot?: unknown }
    reply_to_message?: { message_id?: unknown }
    text?: unknown
  }
}

function secretMatches(provided: string | null, expected: string) {
  if (!expected || expected.length < 32 || !provided) return false
  const a = createHash("sha256").update(provided).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}

// Only error notices go back to the owner. Never forward a failed reply to a buyer.
async function tellOwner(reason: string) {
  if (!env.telegramBotToken || !env.telegramAdminChatId) return
  try {
    await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.telegramAdminChatId,
        text: reason === "UNKNOWN_ORDER_NOTIFICATION"
          ? "Celebration: Message NOT delivered. Reply directly to a bot order notification."
          : "Celebration: Message NOT delivered. Use 1–2000 characters in a text reply."
      }),
      signal: AbortSignal.timeout(3000)
    })
  } catch {
    // An unavailable Telegram API must not change an already stored reply.
  }
}

export async function POST(request: Request) {
  if (!env.telegramWebhookSecret || !env.telegramAdminChatId || !env.telegramBotToken)
    return NextResponse.json({ ok: false, error: "TELEGRAM_NOT_CONFIGURED" }, { status: 503, headers: noStore })
  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), env.telegramWebhookSecret))
    return NextResponse.json({ ok: false }, { status: 403, headers: noStore })

  try {
    const update = await readJsonBody<TelegramUpdate>(request, 16384)
    const message = update?.message
    if (!message) return NextResponse.json({ ok: true }, { headers: noStore })
    if (message.chat?.type !== "private" ||
        String(message.chat?.id ?? "") !== env.telegramAdminChatId ||
        String(message.from?.id ?? "") !== env.telegramAdminChatId ||
        message.from?.is_bot === true)
      return NextResponse.json({ ok: true, ignored: "UNAUTHORIZED_SENDER" }, { headers: noStore })

    if (!message.reply_to_message?.message_id) {
      return NextResponse.json({ ok: true, ignored: "NOT_AN_ORDER_REPLY" }, { headers: noStore })
    }
    const input = {
      updateId: Number(update.update_id),
      messageId: Number(message.message_id),
      replyToMessageId: Number(message.reply_to_message.message_id),
      text: typeof message.text === "string" ? message.text : ""
    }
    const saved = await recordTelegramOrderReply(input)
    if (!saved.ok) await tellOwner(saved.reason)
    return NextResponse.json({ ok: true, stored: saved.ok, duplicate: saved.ok ? saved.duplicate : false },
      { headers: noStore })
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      // Telegram retries any non-2xx status. Acknowledge malformed updates
      // (after header auth) so a bad update never blocks legitimate replies.
      return NextResponse.json({ ok: true, ignored: "INVALID_UPDATE" }, { headers: noStore })
    }
    console.error("telegram-reply-persistence", error instanceof Error ? error.message : "ERROR")
    // 503 allows Telegram to retry the same update; the DB update ID is unique.
    return NextResponse.json({ ok: false }, { status: 503, headers: noStore })
  }
}
