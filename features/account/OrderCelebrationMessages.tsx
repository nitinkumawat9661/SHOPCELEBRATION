"use client"

import { useCallback, useEffect, useState } from "react"

type OwnerMessage = { id: string; sender: "celebration_support"; body: string; sentAt: string; readAt: string | null }
type ResponseBody = { ok?: boolean; messages?: OwnerMessage[]; unreadCount?: number }
type Props = {
  accountId: string
  orderId: string
  unreadCount: number
  onRead: (publicId: string) => void
}

function dateInIndia(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Time unavailable"
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata"
  }).format(date)
}

// Buyer can only read messages posted by Celebration; no customer-side composer.
export function OrderCelebrationMessages({ accountId, orderId, unreadCount, onRead }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [messages, setMessages] = useState<OwnerMessage[]>([])
  const [unreadLoaded, setUnreadLoaded] = useState(0)
  const [ackState, setAckState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [reloadKey, setReloadKey] = useState(0)
  const apiPath = `/api/account/orders/${encodeURIComponent(orderId)}/messages`

  useEffect(() => {
    if (!expanded) return
    const controller = new AbortController()
    setState("loading")
    setAckState("idle")
    void (async () => {
      try {
        const response = await fetch(apiPath, {
          cache: "no-store", credentials: "same-origin", signal: controller.signal
        })
        if (!response.ok) throw new Error("MESSAGE_FETCH_FAILED")
        const data = await response.json() as ResponseBody
        if (!data.ok || !Array.isArray(data.messages)) throw new Error("INVALID_MESSAGE_RESPONSE")
        if (controller.signal.aborted) return
        setMessages(data.messages.filter(message =>
          typeof message.id === "string" && typeof message.body === "string" &&
          typeof message.sentAt === "string" && message.sender === "celebration_support"
        ))
        setUnreadLoaded(Number.isSafeInteger(data.unreadCount) && (data.unreadCount || 0) > 0
          ? data.unreadCount || 0 : 0)
        setState("ready")
      } catch {
        if (!controller.signal.aborted) setState("error")
      }
    })()
    return () => controller.abort()
  }, [expanded, apiPath, reloadKey, accountId])

  const markRead = useCallback(async (signal?: AbortSignal) => {
    setAckState("sending")
    try {
      const response = await fetch(apiPath, {
        method: "POST", cache: "no-store", credentials: "same-origin", signal
      })
      if (!response.ok) throw new Error("MESSAGE_ACK_FAILED")
      const result = await response.json() as { ok?: boolean }
      if (!result.ok || signal?.aborted) throw new Error("MESSAGE_ACK_FAILED")
      setUnreadLoaded(0)
      setAckState("done")
      onRead(orderId)
    } catch {
      if (!signal?.aborted) setAckState("error")
    }
  }, [apiPath, orderId, onRead])

  // Runs after React has committed the rendered messages, not when the folder
  // is still collapsed or before the customer has successfully fetched them.
  useEffect(() => {
    if (!expanded || state !== "ready" || unreadLoaded === 0 || ackState !== "idle") return
    const controller = new AbortController()
    void markRead(controller.signal)
    return () => controller.abort()
  }, [expanded, state, unreadLoaded, markRead])

  const badge = unreadCount > 0 ? unreadCount : (state === "ready" ? unreadLoaded : 0)

  return (
    <section className="celebrationOrderMessages" aria-label="Messages from Celebration">
      <button
        type="button"
        className="celebrationOrderMessagesToggle"
        aria-expanded={expanded}
        aria-controls={`order-messages-${orderId}`}
        onClick={() => setExpanded(value => !value)}
      >
        <span className="celebrationOrderMessagesTitle">
          <span className="celebrationOrderMessagesIcon" aria-hidden="true">✉</span>
          <span>Messages from Celebration</span>
        </span>
        <span className="celebrationOrderMessagesEnd">
          {badge > 0 && <span className="celebrationOrderMessagesBadge" aria-label={`${badge} unread messages`}>{badge > 99 ? "99+" : badge} new</span>}
          <span className="celebrationOrderMessagesChevron" aria-hidden="true">{expanded ? "−" : "+"}</span>
        </span>
      </button>
      {expanded && <div id={`order-messages-${orderId}`} className="celebrationOrderMessagesContent" aria-live="polite">
        {state === "loading" && <p className="celebrationOrderMessagesNote" role="status">Loading messages…</p>}
        {state === "error" && <div className="celebrationOrderMessagesNotice" role="alert">
          <p>Messages couldn't be loaded. Please try again.</p>
          <button type="button" onClick={() => setReloadKey(key => key + 1)}>Try again</button>
        </div>}
        {state === "ready" && messages.length === 0 && <p className="celebrationOrderMessagesNote">No messages for this order yet. Updates will appear here.</p>}
        {state === "ready" && messages.length > 0 && <ol className="celebrationOrderMessagesList">
          {messages.map(message => <li className="celebrationOrderMessage" key={message.id}>
            <div className="celebrationOrderMessageMeta">
              <strong>Celebration Support</strong>
              <time dateTime={message.sentAt}>{dateInIndia(message.sentAt)}</time>
            </div>
            <p>{message.body}</p>
          </li>)}
        </ol>}
        {state === "ready" && ackState === "error" && unreadLoaded > 0 && <div className="celebrationOrderMessagesNotice" role="status">
          <p>Message read status couldn't be updated.</p>
          <button type="button" onClick={() => void markRead()}>Mark as read</button>
        </div>}
      </div>}
    </section>
  )
}
