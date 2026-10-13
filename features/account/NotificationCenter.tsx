"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { CustomerAuthPanel } from "./CustomerAuthPanel"
import { useCustomerAccount } from "./useCustomerAccount"

type Thread = {
  orderId: string
  title: string
  orderType: string
  createdAt: string
  unreadCount: number
  lastBody: string | null
  lastSender: string | null
  lastAt: string | null
}
type Message = {
  id: string
  sender: "customer" | "celebration_support"
  body: string
  sentAt: string
  readAt: string | null
}
function indiaTime(date: string | null) {
  if (!date || Number.isNaN(Date.parse(date))) return ""
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short"
  }).format(new Date(date))
}
function triggerUnreadRefresh() {
  window.dispatchEvent(new Event("celebration:notifications-updated"))
}

function OrderChat({ orderId, accountId, onUpdate }: {
  orderId: string; accountId: string; onUpdate: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [notice, setNotice] = useState("")
  const [unread, setUnread] = useState(0)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const retryId = useRef("")
  const endOfMessages = useRef<HTMLDivElement>(null)
  const messageList = useRef<HTMLDivElement>(null)
  const messagesUrl = `/api/account/orders/${encodeURIComponent(orderId)}/messages`

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(messagesUrl, { cache: "no-store", credentials: "same-origin", signal })
      if (!response.ok) throw new Error("READ_FAILED")
      const payload = await response.json() as { ok?: boolean; messages?: Message[]; unreadCount?: number }
      if (!payload.ok || !Array.isArray(payload.messages)) throw new Error("READ_FAILED")
      if (signal?.aborted) return
      setMessages(payload.messages.filter(message =>
        typeof message.id === "string" && typeof message.body === "string" &&
        typeof message.sentAt === "string" &&
        (message.sender === "customer" || message.sender === "celebration_support")
      ))
      setUnread(Math.max(0, Number(payload.unreadCount) || 0))
      setStatus("ready")
      setNotice("")
    } catch {
      if (!signal?.aborted) {
        setStatus(previous => previous === "ready" ? previous : "error")
        setNotice("Unable to load messages. Check your connection and retry.")
      }
    }
  }, [messagesUrl])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    const timer = window.setInterval(() => {
      if (!document.hidden && navigator.onLine) void refresh(controller.signal)
    }, 20000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [refresh, accountId])

  useEffect(() => {
    const scroller = messageList.current
    if (status === "ready" && scroller) scroller.scrollTop = scroller.scrollHeight
  }, [messages, status])

  // Post-render acknowledgement only for owner replies. Buyer messages are
  // never unread to their own sender and must not clear other orders.
  useEffect(() => {
    if (status !== "ready" || unread === 0) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(messagesUrl, {
            method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal
          })
          const body = await res.json() as { ok?: boolean }
          if (!res.ok || !body.ok || controller.signal.aborted) return
          setUnread(0)
          triggerUnreadRefresh()
          onUpdate()
        } catch { /* Leave the unread state visible if acknowledgment fails. */ }
      })()
    }, 75)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [status, unread, messagesUrl, onUpdate])

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || text.length > 1200 || sending) return
    setSending(true)
    setNotice("")
    const requestId = retryId.current || crypto.randomUUID()
    retryId.current = requestId
    try {
      const response = await fetch(`${messagesUrl}/send`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, requestId })
      })
      const data = await response.json() as { ok?: boolean; message?: Message; error?: string }
      if (!response.ok || !data.ok || !data.message) {
        if (response.status === 429) throw new Error("Too many messages. Please try again shortly.")
        if (response.status === 401) throw new Error("Please sign in again to send messages.")
        throw new Error("Message could not be sent. Try again.")
      }
      setMessages(current => current.some(message => message.id === data.message!.id)
        ? current : [...current, data.message!])
      setStatus("ready")
      setDraft("")
      retryId.current = ""
      triggerUnreadRefresh()
      onUpdate()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Message could not be sent.")
    } finally {
      setSending(false)
    }
  }

  return <div className="notificationConversation" aria-label={`Conversation for order ${orderId}`}>
    <div className="notificationConversationTop">
      <div className="notificationTeamAvatar" aria-hidden="true">C</div>
      <div className="notificationConversationIdentity">
        <strong>Celebration Support</strong>
        <span>Private conversation · Order {orderId}</span>
      </div>
      <button className="notificationRefresh" type="button" onClick={() => void refresh()}
        aria-label="Refresh conversation" title="Refresh conversation">↻</button>
    </div>
    <div className="notificationConversationNote">
      Your messages go directly to our team. Replies appear here when we respond.
    </div>
    <div className="notificationMessagesScroll" ref={messageList} aria-live="polite" aria-relevant="additions text">
      {status === "loading" && <p className="notificationEmpty" role="status">Loading your conversation…</p>}
      {status === "error" && <div className="notificationEmpty" role="alert">
        <p>We couldn't load your conversation.</p>
        <button type="button" onClick={() => void refresh()}>Try again</button>
      </div>}
      {status === "ready" && messages.length === 0 && <div className="notificationEmpty">
        <span className="notificationWelcomeSymbol" aria-hidden="true">✦</span>
        <strong>We're here to help</strong>
        <p>Ask us a question about this order. Your conversation stays in one place.</p>
      </div>}
      {status === "ready" && messages.length > 0 && <ol className="notificationBubbles">
        {messages.map(message => <li key={message.id}
          className={`notificationBubble ${message.sender === "customer" ? "fromCustomer" : "fromCelebration"}`}>
          <span className="notificationBubbleSender">{message.sender === "customer" ? "You" : "Celebration"}</span>
          <p>{message.body}</p>
          <time dateTime={message.sentAt}>{indiaTime(message.sentAt)}</time>
        </li>)}
      </ol>}
      <div ref={endOfMessages} />
    </div>
    {notice && status !== "error" && <p className="notificationSendNotice" role="alert">{notice}</p>}
    <form className="notificationComposer" onSubmit={sendMessage}>
      <label htmlFor={`celebration-message-${orderId}`}>Your message</label>
      <div className="notificationComposerRow">
        <textarea id={`celebration-message-${orderId}`} value={draft} maxLength={1200}
          onChange={event => { setDraft(event.target.value); retryId.current = "" }}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder="Write a message to Celebration…" rows={2} autoComplete="off" />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message">
          <span aria-hidden="true">➤</span><span>{sending ? "Sending" : "Send"}</span>
        </button>
      </div>
      <small>Only you and Celebration can see this order conversation.</small>
    </form>
  </div>
}

export function NotificationCenter() {
  const account = useCustomerAccount()
  const accountId = account.account?.id || ""
  const [storedThreads, setThreads] = useState<Thread[]>([])
  const [threadsOwner, setThreadsOwner] = useState("")
  const [selected, setSelected] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const currentThreads = threadsOwner === accountId ? storedThreads : []
  const wantedOrder = useRef("")
  useEffect(() => {
    wantedOrder.current = new URLSearchParams(window.location.search).get("order") || ""
  }, [])

  const loadThreads = useCallback(async (signal?: AbortSignal) => {
    if (!accountId) return
    try {
      const response = await fetch("/api/account/notifications", {
        cache: "no-store", credentials: "same-origin", signal
      })
      if (!response.ok) throw new Error("NOTIFICATIONS_UNAVAILABLE")
      const data = await response.json() as { ok?: boolean; threads?: Thread[] }
      if (!data.ok || !Array.isArray(data.threads) || signal?.aborted) throw new Error("NOTIFICATIONS_UNAVAILABLE")
      setThreads(data.threads)
      setThreadsOwner(accountId)
      setSelected(previous => {
        if (data.threads!.some(thread => thread.orderId === previous)) return previous
        const chosen = data.threads!.find(thread => thread.orderId === wantedOrder.current)
        return chosen?.orderId || data.threads![0]?.orderId || ""
      })
      setError("")
    } catch {
      if (!signal?.aborted) setError("Notifications couldn't be loaded. Please try again.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    if (!accountId) { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    void loadThreads(controller.signal)
    const timer = window.setInterval(() => {
      if (!document.hidden && navigator.onLine) void loadThreads(controller.signal)
    }, 60000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [accountId, loadThreads])

  const onThreadUpdate = useCallback(() => { void loadThreads() }, [loadThreads])
  const unreadTotal = currentThreads.reduce((sum, thread) => sum + thread.unreadCount, 0)
  const currentOrder = currentThreads.find(thread => thread.orderId === selected)

  if (account.loading) return <div className="notificationPageState">Opening your notifications…</div>
  if (!account.account) return <div className="notificationSignin">
    <div className="notificationIntro">
      <span className="notificationEyebrow">PRIVATE SUPPORT</span>
      <h1>Your messages, all together.</h1>
      <p>Sign in to see updates and chat directly with Celebration about an order.</p>
    </div>
    <CustomerAuthPanel busy={account.busy} error={account.error} initialMode="login"
      onAuthenticate={account.authenticate} onClearError={() => account.setError("")} />
  </div>

  return <div className="notificationCenter">
    <div className="notificationIntro">
      <span className="notificationEyebrow">CELEBRATION · YOUR ACCOUNT</span>
      <h1>Notifications <span>& messages</span></h1>
      <p>A quiet space for your order updates and conversations with our team.</p>
      {unreadTotal > 0 && <strong className="notificationUnreadPill">{unreadTotal} unread {unreadTotal === 1 ? "reply" : "replies"}</strong>}
    </div>
    <div className="notificationWorkspace">
      <aside className="notificationSidebar" aria-label="Your order conversations">
        <div className="notificationSidebarHeading">
          <div><span className="notificationEyebrow">INBOX</span><h2>Your conversations</h2></div>
          <span className="notificationThreadCount">{currentThreads.length}</span>
        </div>
        {error && <div className="notificationSidebarError" role="alert">{error}
          <button type="button" onClick={() => void loadThreads()}>Retry</button>
        </div>}
        {loading && <p className="notificationLoading" role="status">Loading orders…</p>}
        {!loading && currentThreads.length === 0 && <div className="notificationNoOrders">
          <p>You don't have any order conversations yet.</p>
          <Link href="/jewelry">Explore jewelry</Link>
        </div>}
        <div className="notificationThreadButtons">
          {currentThreads.map(thread => <button key={thread.orderId} type="button"
            className={`notificationThread ${thread.orderId === selected ? "isSelected" : ""}`}
            aria-pressed={thread.orderId === selected}
            onClick={() => setSelected(thread.orderId)}>
            <span className="notificationThreadIcon" aria-hidden="true">✦</span>
            <span className="notificationThreadDetail">
              <strong>{thread.title || "Your order"}</strong>
              <small>#{thread.orderId}</small>
              <span>{thread.lastBody ? (thread.lastSender === "customer" ? "You: " : "Celebration: ") + thread.lastBody : "Start a conversation"}</span>
            </span>
            {thread.unreadCount > 0 && <b className="notificationThreadUnread" aria-label={`${thread.unreadCount} unread replies`}>{thread.unreadCount > 99 ? "99+" : thread.unreadCount}</b>}
          </button>)}
        </div>
      </aside>
      <section className="notificationChatArea" aria-label="Selected order conversation">
        {currentOrder
          ? <OrderChat key={`${accountId}:${currentOrder.orderId}`} accountId={accountId}
              orderId={currentOrder.orderId} onUpdate={onThreadUpdate} />
          : <div className="notificationNoConversation"><span aria-hidden="true">✉</span>
              <h2>Stay close to your celebrations.</h2>
              <p>Select an order to view messages or start a conversation.</p>
            </div>}
      </section>
    </div>
    <p className="notificationPrivacyFooter">Your private messages are linked to your orders. For urgent assistance, use WhatsApp support in My Orders.</p>
  </div>
}
