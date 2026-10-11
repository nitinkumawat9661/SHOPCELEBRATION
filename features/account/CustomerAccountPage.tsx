"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { routes } from "../../config/routes"
import { formatMoney } from "../../lib/domain/catalog"
import type { OrderLineItem } from "../../lib/domain/order"
import { customerPaymentStatusLabel, customerTimeline, orderStatusLabels, type OrderStatus } from "../../lib/domain/order-status"
import { supportWhatsappUrl } from "../../lib/domain/support"
import { useStoreSettings } from "../shell/useStoreSettings"
import { notifyUx } from "../ux/UxMessenger"
import { CustomerAuthPanel } from "./CustomerAuthPanel"
import { CourierJourney } from "../tracking/CourierJourney"
import type { CourierPublicStatus } from "../../lib/domain/courier-tracking"
import { DefaultAddressPanel } from "./DefaultAddressPanel"
import { useCustomerAccount } from "./useCustomerAccount"

type DashboardOrder = {
  orderType: "hamper" | "individual"
  lineItems: OrderLineItem[]
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
  shippingTrackingNumber: string | null
  estimatedDeliveryDate: string | null
  courier?: CourierPublicStatus | null
  courierUnavailable?: boolean
  customerApprovedAt: string | null
  createdAt: string
  updatedAt: string
}

function formatDeliveryDate(value: string | null | undefined) {
  if (!value) return ""
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return value
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date)
}

function progressIndex(status: OrderStatus) {
  const index = customerTimeline.indexOf(status)
  if (index >= 0) return index
  if (status === "issue_reported" || status === "refund_or_replacement_resolved") return customerTimeline.length - 1
  return 0
}

function friendlyOrderError(code: string) {
  if (code === "UNAUTHORIZED") return "You’ve been signed out. Please sign in again."
  if (code === "RATE_LIMITED") return "Too many attempts. Please try again shortly."
  if (code === "APPROVAL_SERVICE_UNAVAILABLE") return "We couldn’t save the packing approval right now. Please try again."
  if (code === "ORDER_ALREADY_SHIPPED" || code === "ORDER_CANCELLATION_NOT_ALLOWED") return "This order can no longer be cancelled because dispatch has already started."
  if (code === "SHIPWAY_CANCEL_FAILED" || code === "SHIPWAY_CANCELLATION_UNAVAILABLE") return "The courier cancellation could not be confirmed. Your order was not cancelled here, so please try again or contact support."
  if (code === "ORDER_CANCELLATION_FAILED") return "We couldn’t cancel this order right now. Please try again."
  return "We couldn’t load the latest order updates. Check your connection and try again."
}

function nextUpdateText(status: OrderStatus) {
  const copy: Record<OrderStatus, string> = {
    payment_verification_pending: "We’re confirming your payment.",
    payment_verified: "Your order is ready to move into preparation.",
    preparing: "We’re preparing your order.",
    packing_video_ready: "Your packing video is ready. Review it and approve dispatch.",
    customer_approved: "Approved. We’re arranging the courier next.",
    shipped: "Your order has been shipped.",
    out_for_delivery: "Your order is out for delivery.",
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
  const [cancelling, setCancelling] = useState("")
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

  useEffect(() => {
    if (!accountState.account) return
    void loadOrders()
    // A courier can update an order without user action. Refresh the account
    // while it is visible; do not pretend a timed UI transition is a scan.
    const interval = window.setInterval(() => {
      if (!document.hidden && navigator.onLine) void loadOrders()
    }, 60000)
    const onFocus = () => { if (!document.hidden && navigator.onLine) void loadOrders() }
    document.addEventListener("visibilitychange", onFocus)
    window.addEventListener("online", onFocus)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onFocus)
      window.removeEventListener("online", onFocus)
    }
  }, [accountState.account, loadOrders])

  async function approvePacking(order: DashboardOrder) {
    if (!approvalConsent[order.publicId]) return
    setApproving(order.publicId)
    setOrdersError("")
    try {
      const response = await fetch(routes.api.customerOrderApprove(order.publicId), { method: "POST" })
      const data = await response.json() as { ok?: boolean; error?: string; shippingBooked?: boolean; status?: OrderStatus }
      if (!response.ok || !data.ok) throw new Error(data.error || "APPROVAL_FAILED")
      setApprovalConsent((current) => ({ ...current, [order.publicId]: false }))
      notifyUx({
        title: "Packing approved ✓",
        body: data.shippingBooked ? "Courier arranged. Tracking details are being updated." : "Approval saved. We’ll arrange the courier next.",
        tone: "success",
        durationMs: 4000
      })
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

  async function cancelOrder(order: DashboardOrder) {
    const paid = ["paid", "verified", "success"].includes(order.paymentStatus.trim().toLowerCase())
    const confirmed = window.confirm(paid
      ? "Cancel this order? If cancellation succeeds, any eligible prepaid amount will need to be refunded to the original payment method."
      : "Cancel this order? This cannot be undone.")
    if (!confirmed) return

    setCancelling(order.publicId)
    setOrdersError("")
    try {
      const response = await fetch(routes.api.customerOrderCancel(order.publicId), { method: "POST" })
      const data = await response.json() as { ok?: boolean; error?: string; shipwayCancelled?: boolean; refundRequired?: boolean }
      if (!response.ok || !data.ok) throw new Error(data.error || "ORDER_CANCELLATION_FAILED")
      notifyUx({
        title: "Order cancelled ✓",
        body: data.refundRequired
          ? "Cancellation is confirmed. The prepaid amount is now due for refund to the original payment method."
          : data.shipwayCancelled
            ? "Celebration and the booked courier shipment were both cancelled."
            : "Cancellation is confirmed before dispatch.",
        tone: "success",
        durationMs: 5000
      })
      await loadOrders()
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "ORDER_CANCELLATION_FAILED"
      const message = friendlyOrderError(code)
      setOrdersError(message)
      notifyUx({ title: "Order not cancelled", body: message, tone: "error", durationMs: 5000 })
    } finally {
      setCancelling("")
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
        <CustomerAuthPanel busy={accountState.busy} error={accountState.error} initialMode="signup" passwordlessSignup onAuthenticate={accountState.authenticate} onClearError={() => accountState.setError("")} onSuccess={(account) => notifyUx({ title: "Welcome back ✓", body: `${account.displayName}, your orders are loading.`, tone: "success" })} />
      </div>
    )
  }

  return (
    <div className="customerDashboard">
      <section className="customerDashHero">
        <div>
          <div className="kicker">MY CELEBRATION</div>
          <h1>Hi {accountState.account.displayName}, your orders are all here.</h1>
          <p>See what you ordered, what happens next and your shipping updates — without hunting through messages.</p>
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

      <DefaultAddressPanel accountId={accountState.account.id} />

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
          const individual = order.orderType === "individual"
          const orderTimeline = individual ? customerTimeline.filter((status) => !["packing_video_ready", "customer_approved"].includes(status)) : customerTimeline
          const cancelled = order.status === "cancelled"
          const currentIndex = cancelled ? -1 : orderTimeline.indexOf(order.status) >= 0 ? orderTimeline.indexOf(order.status) : order.status === "delivered" ? orderTimeline.length - 1 : 0
          const supportMessage = `Hi Celebration, I need help with order ${order.publicId}.`
          const approvalReady = !individual && order.status === "packing_video_ready" && Boolean(order.packingVideoUrl)
          const canCancel = ["payment_verification_pending", "payment_verified", "preparing", "packing_video_ready", "customer_approved"].includes(order.status)
          return (
            <article className="customerOrderCard" key={order.publicId}>
              <header className="customerOrderHead">
                <div><small>{new Date(order.createdAt).toLocaleDateString("en-IN")} • {individual ? "Individual purchase" : "Hamper"}</small><h3>{order.tierName}</h3><span>{order.publicId}</span></div>
                <div className="customerOrderPrice"><strong>{formatMoney(order.amountPaise / 100)}</strong>{order.discountPaise > 0 && <small><s>{formatMoney(order.subtotalPaise / 100)}</s> • saved {formatMoney(order.discountPaise / 100)}</small>}<span className={`customerStatus status-${order.status}`}>{orderStatusLabels[order.status]}</span></div>
              </header>

              {order.discountPaise > 0 && <div className="customerOfferSaved"><b>Offer applied ✓</b><span>{order.campaignTitle || "Celebration offer"} saved you {formatMoney(order.discountPaise / 100)}.</span></div>}

              {individual && <ul className="individualOrderLines" aria-label="Purchased items">{(order.lineItems || []).map((item) => <li key={item.productId}><div><b>{item.name}</b><span>{item.quantity} × {formatMoney(item.unitPricePaise / 100)} each</span></div><strong>{formatMoney(item.lineTotalPaise / 100)}</strong></li>)}</ul>}

              <div className="customerOrderMeta">
                <div><span>Gift for</span><b>{order.receiverName}</b></div>
                <div><span>Occasion</span><b>{order.occasion}</b></div>
                <div><span>Needed by</span><b>{order.requiredDate}</b></div>
                <div><span>Payment</span><b>{customerPaymentStatusLabel(order.paymentStatus)}</b></div>
              </div>

              <div className="checkoutProgressNote"><span>→</span><span><b>What’s next:</b> {nextUpdateText(order.status)}</span></div>

              <div className="customerProgressDesktop">
                <div className={`customerProgress ${cancelled ? "cancelled" : ""}`} aria-label="Order progress">
                  {cancelled
                    ? <div className="current cancelledStep"><i>×</i><span>Cancelled</span></div>
                    : orderTimeline.map((status, index) => <div className={index < currentIndex ? "done" : index === currentIndex ? "current" : ""} key={status}><i>{index <= currentIndex ? "✓" : ""}</i><span>{orderStatusLabels[status]}</span></div>)}
                </div>
              </div>
              <details className={`customerProgressMobile ${cancelled ? "cancelled" : ""}`}>
                <summary><span>Tracking timeline</span><b>{cancelled ? "Cancelled" : orderStatusLabels[order.status]}</b></summary>
                <div className={`customerProgress ${cancelled ? "cancelled" : ""}`} aria-label="Order progress">
                  {cancelled
                    ? <div className="current cancelledStep"><i>×</i><span>Cancelled</span></div>
                    : orderTimeline.map((status, index) => <div className={index < currentIndex ? "done" : index === currentIndex ? "current" : ""} key={status}><i>{index <= currentIndex ? "✓" : ""}</i><span>{orderStatusLabels[status]}</span></div>)}
                </div>
              </details>

              {!individual && order.productNames.length > 0 && <div className="customerOrderProducts"><span>Selected gifts</span><p>{order.productNames.join(" • ")}</p></div>}

              {order.shippingTrackingNumber && <CourierJourney courier={order.courier || null} unavailable={order.courierUnavailable || false} compact />}

              <div className="customerOrderUpdates">
                {!individual && <div className="customerUpdateCard"><span>Packing video</span>{order.packingVideoUrl ? <a href={order.packingVideoUrl} target="_blank" rel="noreferrer">Watch video</a> : <b>Available after packing</b>}</div>}
                <div className="customerUpdateCard"><span>Shipping</span>{order.status === "cancelled" ? <b>{order.shippingTrackingNumber ? `Shipment cancelled • ${order.shippingTrackingNumber}` : "Shipment cancelled"}</b> : order.shippingTrackingNumber ? <><b>{canCancel ? "Courier booked, awaiting pickup" : "Tracking"} • {order.shippingTrackingNumber}</b><small className="customerEta">{order.estimatedDeliveryDate ? <>Estimated delivery: <strong>{formatDeliveryDate(order.estimatedDeliveryDate)}</strong></> : "Estimated delivery will update after courier routing."}</small><div className="shippingActions"><button className="secondary" type="button" onClick={() => copyTracking(order.shippingTrackingNumber!)}>Copy tracking</button></div></> : <b>No verified courier AWB is linked yet. If you received a tracking SMS, contact support with the AWB and Celebration order ID.</b>}</div>
              </div>

              {approvalReady && <div className="customerPackingApproval"><div><b>Your {individual ? "order" : "hamper"} is ready for a final look</b><p>Watch the packing video and approve it when you’re happy with the presentation.</p></div><label><input type="checkbox" checked={Boolean(approvalConsent[order.publicId])} onChange={(event) => setApprovalConsent((current) => ({ ...current, [order.publicId]: event.target.checked }))} /><span>I’ve reviewed the packing video and approve this {individual ? "order" : "hamper"} for dispatch.</span></label><button className="primary" type="button" disabled={!approvalConsent[order.publicId] || approving === order.publicId} onClick={() => approvePacking(order)}>{approving === order.publicId ? "Approving…" : "Approve for dispatch"}</button></div>}

              <footer className="customerOrderFooter">
                <small>Last update: {new Date(order.updatedAt).toLocaleString("en-IN")}</small>
                {individual && !["paid", "verified"].includes(order.paymentStatus) && order.status === "payment_verification_pending" && <Link className="primary" href={`${routes.paymentReturn}?order_id=${encodeURIComponent(order.publicId)}`}>Check / continue payment</Link>}
                {canCancel && <button className="secondary danger" type="button" disabled={cancelling === order.publicId} onClick={() => cancelOrder(order)}>{cancelling === order.publicId ? "Cancelling…" : "Cancel order"}</button>}
                <a className="secondary" href={supportWhatsappUrl(supportMessage, settings.whatsapp)} target="_blank" rel="noreferrer">WhatsApp support</a>
              </footer>
            </article>
          )
        })}
      </div>
    </div>
  )
}
