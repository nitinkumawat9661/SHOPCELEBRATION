"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { routes } from "../../config/routes"
import { formatMoney } from "../../lib/domain/catalog"
import { customerTimeline, orderStatusLabels, type OrderStatus } from "../../lib/domain/order-status"
import { supportWhatsappUrl } from "../../lib/domain/support"
import { useStoreSettings } from "../shell/useStoreSettings"
import { notifyUx } from "../ux/UxMessenger"
import { CustomerAuthPanel } from "./CustomerAuthPanel"
import { useCustomerAccount } from "./useCustomerAccount"

type DashboardOrder = {
  publicId: string
  subtotalPaise: number
  discountPaise: number
  amountPaise: number
  campaignTitle: string | null
  tierName: string
  productNames: string[]
  requiredDate: string
  occasion: string
  status: OrderStatus
  paymentStatus: string
  receiverName: string
  packingVideoUrl: string | null
  shippingProvider: string | null
  shippingTrackingNumber: string | null
  customerApprovedAt: string | null
  createdAt: string
  updatedAt: string
}

function progressIndex(status: OrderStatus) {
  const index = customerTimeline.indexOf(status)
  if (index >= 0) return index
  if (status === "issue_reported" || status === "refund_or_replacement_resolved") return customerTimeline.length - 1
  return 0
}

function friendlyOrderError(code: string) {
  if (code === "UNAUTHORIZED") return "Your session has ended. Please login again."
  if (code === "RATE_LIMITED") return "Too many requests. Please try again shortly."
  if (code === "APPROVAL_SERVICE_UNAVAILABLE") return "We couldn’t save the packing approval right now. Please try again."
  return "We couldn’t load the latest order updates. Check your connection and try again."
}

function nextUpdateText(status: OrderStatus) {
  const copy: Record<OrderStatus, string> = {
    payment_verification_pending: "We’re confirming your payment.",
    payment_verified: "Your hamper is ready to move into preparation.",
    preparing: "We’re preparing your hamper. The packing video comes next.",
    packing_video_ready: "Your packing video is ready. Review it and approve dispatch.",
    customer_approved: "Approved. Shipping details will be added next.",
    shipped: "Your hamper is on the way.",
    delivered: "Delivered. Need help? WhatsApp support is available below.",
    issue_reported: "Your issue is under review.",
    refund_or_replacement_resolved: "Your reported issue has been resolved.",
    cancelled: "This order is cancelled. Contact support if you need help."
  }
  return copy[status]
}

export function CustomerAccountPage() {
  const accountState = useCustomerAccount()
  const settings = useStoreSettings()
  const [orders, setOrders] = useState<DashboardOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState("")
  const [approving, setApproving] = useState("")
  const [approvalConsent, setApprovalConsent] = useState<Record<string, boolean>>({})
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)

  const loadOrders = useCallback(async (announce = false) => {
    if (!accountState.account) return
    setOrdersLoading(true)
    setOrdersError("")
    try {
      const response = await fetch(routes.api.customerOrders, { cache: "no-store" })
      const data = await response.json() as { ok?: boolean; orders?: DashboardOrder[]; error?: string }
      if (!response.ok || !data.ok) throw new Error(data.error || "ORDER_LOAD_FAILED")
      setOrders(data.orders || [])
      setLastRefreshedAt(new Date())
      if (announce) notifyUx({ title: "Orders updated ✓", body: "You’re seeing the latest progress.", tone: "success" })
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "ORDER_LOAD_FAILED"
      const message = friendlyOrderError(code)
      setOrdersError(message)
      if (announce) notifyUx({ title: "Couldn’t refresh", body: message, tone: "error" })
    } finally {
      setOrdersLoading(false)
    }
  }, [accountState.account])

  useEffect(() => { if (accountState.account) loadOrders() }, [accountState.account, loadOrders])

  async function approvePacking(order: DashboardOrder) {
    if (!approvalConsent[order.publicId]) return
    setApproving(order.publicId)
    setOrdersError("")
    try {
      const response = await fetch(routes.api.customerOrderApprove(order.publicId), { method: "POST" })
      const data = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !data.ok) throw new Error(data.error || "APPROVAL_FAILED")
      setApprovalConsent((current) => ({ ...current, [order.publicId]: false }))
      notifyUx({ title: "Packing approved ✓", body: `${order.publicId} is ready for dispatch.`, tone: "success", durationMs: 4000 })
      await loadOrders()
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "APPROVAL_FAILED"
      const message = friendlyOrderError(code)
      setOrdersError(message)
      notifyUx({ title: "Approval not saved", body: message, tone: "error" })
    } finally {
      setApproving("")
    }
  }

  async function logout() {
    const ok = await accountState.logout()
    if (ok) notifyUx({ title: "Logged out", body: "You can sign in again anytime to see your orders.", tone: "info" })
    else notifyUx({ title: "Couldn’t log out", body: "Please check your connection and try again.", tone: "error" })
  }

  async function copyTracking(number: string) {
    try {
      await navigator.clipboard.writeText(number)
      notifyUx({ title: "Tracking number copied ✓", body: number, tone: "success" })
    } catch {
      notifyUx({ title: "Couldn’t copy", body: `Tracking number: ${number}`, tone: "error" })
    }
  }

  const stats = useMemo(() => ({
    total: orders.length,
    active: orders.filter((order) => !["delivered", "refund_or_replacement_resolved", "cancelled"].includes(order.status)).length,
    delivered: orders.filter((order) => order.status === "delivered").length
  }), [orders])

  if (accountState.loading) return <div className="accountState">Loading your account…</div>

  if (!accountState.account) {
    return (
      <div className="accountPublicWrap">
        <CustomerAuthPanel busy={accountState.busy} error={accountState.error} onAuthenticate={accountState.authenticate} onClearError={() => accountState.setError("")} onSuccess={(account) => notifyUx({ title: "Welcome back ✓", body: `${account.displayName}, your orders are loading.`, tone: "success" })} />
      </div>
    )
  }

  return (
    <div className="customerDashboard">
      <section className="customerDashHero">
        <div>
          <div className="kicker">MY CELEBRATION</div>
          <h1>Hi {accountState.account.displayName}, your orders are all here.</h1>
          <p>See what you ordered, what happens next, packing approval and shipping updates — without hunting through messages.</p>
        </div>
        <div className="customerDashActions">
          <Link className="primary" href={`${routes.home}#budgets`}>Create another hamper</Link>
          <button className="secondary" type="button" disabled={accountState.busy} onClick={logout}>{accountState.busy ? "Logging out…" : "Logout"}</button>
        </div>
      </section>

      <section className="customerStats" aria-label="Order summary">
        <div><span>Total orders</span><b>{stats.total}</b></div>
        <div><span>In progress</span><b>{stats.active}</b></div>
        <div><span>Delivered</span><b>{stats.delivered}</b></div>
      </section>

      <div className="customerDashToolbar">
        <div><div className="kicker">YOUR ORDERS</div><h2>Order progress</h2>{lastRefreshedAt && <div className="dashboardActionNote">Last refreshed {lastRefreshedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>}</div>
        <button className="secondary" type="button" disabled={ordersLoading} onClick={() => loadOrders(true)}>{ordersLoading ? "Refreshing…" : "Refresh"}</button>
      </div>

      {ordersError && <div className="errorBox" role="alert">{ordersError}</div>}
      {ordersLoading && orders.length === 0 && <div className="accountState">Loading your orders…</div>}
      {!ordersLoading && orders.length === 0 && (
        <section className="customerEmptyOrders">
          <h3>No orders yet</h3>
          <p>Start with a budget, pick a few gifts and make your first Celebration hamper.</p>
          <Link className="primary" href={`${routes.home}#builder`}>Build a hamper</Link>
        </section>
      )}

      <div className="customerOrderList">
        {orders.map((order) => {
          const currentIndex = progressIndex(order.status)
          const supportMessage = `Hi Celebration, I need help with order ${order.publicId}.`
          const approvalReady = order.status === "packing_video_ready" && Boolean(order.packingVideoUrl)
          return (
            <article className="customerOrderCard" key={order.publicId}>
              <header className="customerOrderHead">
                <div><small>{new Date(order.createdAt).toLocaleDateString("en-IN")}</small><h3>{order.tierName}</h3><span>{order.publicId}</span></div>
                <div className="customerOrderPrice"><strong>{formatMoney(order.amountPaise / 100)}</strong>{order.discountPaise > 0 && <small><s>{formatMoney(order.subtotalPaise / 100)}</s> • saved {formatMoney(order.discountPaise / 100)}</small>}<span className={`customerStatus status-${order.status}`}>{orderStatusLabels[order.status]}</span></div>
              </header>

              {order.discountPaise > 0 && <div className="customerOfferSaved"><b>Offer applied ✓</b><span>{order.campaignTitle || "Celebration offer"} saved you {formatMoney(order.discountPaise / 100)}.</span></div>}

              <div className="customerOrderMeta">
                <div><span>Gift for</span><b>{order.receiverName}</b></div>
                <div><span>Occasion</span><b>{order.occasion}</b></div>
                <div><span>Needed by</span><b>{order.requiredDate}</b></div>
                <div><span>Payment</span><b>{order.paymentStatus}</b></div>
              </div>

              <div className="checkoutProgressNote"><span>→</span><span><b>What’s next:</b> {nextUpdateText(order.status)}</span></div>

              <div className="customerProgress" aria-label="Order progress">
                {customerTimeline.map((status, index) => <div className={index < currentIndex ? "done" : index === currentIndex ? "current" : ""} key={status}><i>{index <= currentIndex ? "✓" : ""}</i><span>{orderStatusLabels[status]}</span></div>)}
              </div>

              {order.productNames.length > 0 && <div className="customerOrderProducts"><span>Selected gifts</span><p>{order.productNames.join(" • ")}</p></div>}

              <div className="customerOrderUpdates">
                <div className="customerUpdateCard"><span>Packing video</span>{order.packingVideoUrl ? <a href={order.packingVideoUrl} target="_blank" rel="noreferrer">Watch video</a> : <b>Available after packing</b>}</div>
                <div className="customerUpdateCard"><span>Shipping</span>{order.shippingTrackingNumber ? <><b>{order.shippingProvider || "Courier"} • {order.shippingTrackingNumber}</b><div className="shippingActions"><button className="secondary" type="button" onClick={() => copyTracking(order.shippingTrackingNumber!)}>Copy tracking</button></div></> : <b>Tracking appears here after dispatch</b>}</div>
              </div>

              {approvalReady && <div className="customerPackingApproval"><div><b>Your hamper is ready for a final look</b><p>Watch the packing video and approve it when you’re happy with the presentation.</p></div><label><input type="checkbox" checked={Boolean(approvalConsent[order.publicId])} onChange={(event) => setApprovalConsent((current) => ({ ...current, [order.publicId]: event.target.checked }))} /><span>I’ve reviewed the packing video and approve this hamper for dispatch.</span></label><button className="primary" type="button" disabled={!approvalConsent[order.publicId] || approving === order.publicId} onClick={() => approvePacking(order)}>{approving === order.publicId ? "Approving…" : "Approve for dispatch"}</button></div>}

              <footer className="customerOrderFooter">
                <small>Last update: {new Date(order.updatedAt).toLocaleString("en-IN")}</small>
                <a className="secondary" href={supportWhatsappUrl(supportMessage, settings.whatsapp)} target="_blank" rel="noreferrer">WhatsApp support</a>
              </footer>
            </article>
          )
        })}
      </div>
    </div>
  )
}
