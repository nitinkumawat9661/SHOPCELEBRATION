"use client"

import { useEffect, useMemo, useState } from "react"
import { formatMoney, type CatalogConfig } from "../../../lib/domain/catalog"

type Period = 7 | 30 | 90
type Event = "storefront_view" | "budget_selected" | "builder_started" | "checkout_reached" | "offer_shown" | "payment_started"
type Metric = { sessions: number; events: number }
type Overview = {
  days: number
  orders: number
  revenuePaise: number
  subtotalPaise: number
  discountPaise: number
  customRequests: number
  offerQuotes: number
  offerRedemptions: number
  checkoutRate: number
  orderRate: number
  offerRedemptionRate: number
  funnel: Record<Event, Metric>
  campaigns: { campaignId: string; campaignTitle: string; orders: number; revenuePaise: number; discountPaise: number }[]
}
type Report = {
  days: number
  overview: Overview
  checkoutTelemetry: {
    inactivityMinutes: number
    checkoutSessionsInactive: number
    checkoutWithoutLaterPaymentStart: number
    cartAbandonmentAvailable: false
    identifiableCheckoutRecoveryAvailable: false
  }
  wishlist: {
    savedRelationshipsCurrent: number
    accountsWithSavedCurrent: number
    currentSavesCreatedInPeriod: number
    topProducts: { productId: string; savedAccounts: number }[]
  }
  individualProductSales: { productId: string; paidOrders: number; units: number; grossLineValuePaise: number }[]
  dailyPaidOrders: { day: string; paidOrders: number; paidOrderValuePaise: number }[]
}
type Api = { ok?: boolean; analytics?: Report; error?: string }

const money = (paise: number) => formatMoney(paise / 100)
const funnelStages: { event: Event; label: string }[] = [
  { event: "storefront_view", label: "Storefront views" },
  { event: "budget_selected", label: "Hamper budget selected" },
  { event: "builder_started", label: "Builder opened" },
  { event: "checkout_reached", label: "Checkout reached" },
  { event: "payment_started", label: "Payment started" }
]
const maxPercent = (value: number, max: number) => max > 0 ? Math.max(value > 0 ? 2 : 0, Math.min(100, 100 * value / max)) : 0

function Stat({ label, value, description }: { label: string; value: string | number; description: string }) {
  return <div className="cav3-analytics-stat">
    <span>{label}</span><strong>{value}</strong><small>{description}</small>
  </div>
}
function Panel({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return <section className="cav3-panel cav3-analytics-panel">
    <div className="cav3-panel-head"><h2>{title}</h2>{aside && <span className="cav3-quiet">{aside}</span>}</div>{children}
  </section>
}

export function AdminAnalyticsV3({ catalog }: { catalog: CatalogConfig | null }) {
  const [days, setDays] = useState<Period>(30)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [report, setReport] = useState<Report | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    setReport(null)
    void (async () => {
      try {
        const response = await fetch("/api/admin/analytics/v3?days=" + days, {
          cache: "no-store", credentials: "same-origin", signal: controller.signal
        })
        const body = await response.json() as Api
        if (!response.ok || !body.ok || !body.analytics ||
            !body.analytics.overview?.funnel || !Array.isArray(body.analytics.individualProductSales) ||
            !Array.isArray(body.analytics.dailyPaidOrders) ||
            !Array.isArray(body.analytics.wishlist?.topProducts)) {
          throw new Error(body.error || "ANALYTICS_UNAVAILABLE")
        }
        if (!controller.signal.aborted) setReport(body.analytics)
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Analytics cannot be loaded")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [days, revision])

  const names = useMemo(() => new Map((catalog?.products || []).map(product =>
    [product.id, { name: product.name, category: product.category }])), [catalog])
  const categories = useMemo(() => {
    if (!report) return []
    const mapped = new Map<string, { category: string; units: number; grossLineValuePaise: number }>()
    for (const entry of report.individualProductSales) {
      const category = !catalog ? "Current catalog unavailable"
        : names.get(entry.productId)?.category || "SKU no longer in current catalog"
      const row = mapped.get(category) || { category, units: 0, grossLineValuePaise: 0 }
      row.units += entry.units
      row.grossLineValuePaise += entry.grossLineValuePaise
      mapped.set(category, row)
    }
    return [...mapped.values()].sort((a, b) => b.units - a.units).slice(0, 12)
  }, [report, catalog, names])

  const overview = report?.overview
  const maxFunnel = overview ? Math.max(1, ...funnelStages.map(item => overview.funnel[item.event]?.sessions || 0)) : 1
  const dailyMax = report ? Math.max(1, ...report.dailyPaidOrders.map(item => item.paidOrderValuePaise)) : 1
  const topSavedMax = report ? Math.max(1, ...report.wishlist.topProducts.map(item => item.savedAccounts)) : 1
  const maxSold = report ? Math.max(1, ...report.individualProductSales.map(item => item.units)) : 1

  return <div className="cav3-analytics" aria-label="Admin V3 analytics">
    <div className="cav3-analytics-toolbar">
      <div><span className="cav3-eyebrow">Recorded commerce and customer behaviour</span>
        <h2>Performance Analytics</h2>
        <p>Server-side paid orders, tracked sessions and registered-account favourites. No inferred customer identities.</p>
      </div>
      <div className="cav3-analytics-actions"><select value={days} aria-label="Analytics reporting period"
        onChange={event => setDays(Number(event.target.value) as Period)}>
        <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
      </select><button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>
        {loading ? "Loading…" : "Refresh"}</button></div>
    </div>

    <p className="cav3-analytics-guidance" role="note">
      <b>Data confidence:</b> Paid-order metrics require the saved payment status to be paid/verified and the order not cancelled.
      Session events are anonymous tracking observations, not guaranteed buyers. Current wishlist totals are all-time snapshots
      of registered accounts; guest device data is inaccessible.
    </p>

    {error && <p className="cav3-error" role="alert">Analytics could not be verified: {error}.
      <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
    {loading && <p className="cav3-state" role="status">Loading verified reporting records…</p>}
    {!loading && report && overview && <>
      <div className="cav3-analytics-stats">
        <Stat label="Paid-order value" value={money(overview.revenuePaise)}
          description="Recorded order amounts · refunds not deducted" />
        <Stat label="Paid orders" value={overview.orders}
          description="Paid/verified and non-cancelled" />
        <Stat label="Recorded discounts" value={money(overview.discountPaise)}
          description="Applied to paid non-cancelled orders" />
        <Stat label="Checkout reach rate" value={overview.checkoutRate + "%"}
          description="Checkout sessions ÷ tracked storefront sessions" />
      </div>

      <div className="cav3-analytics-grid">
        <Panel title="Observed commerce funnel" aside={"Distinct tracked sessions · " + days + " days"}>
          <div className="cav3-analytics-funnel">{funnelStages.map(item => {
            const count = overview.funnel[item.event]?.sessions || 0
            return <div className="cav3-analytics-funnel-row" key={item.event}>
              <div><span>{item.label}</span><b>{count}</b></div>
              <div className="cav3-analytics-track"><span style={{ width: maxPercent(count, maxFunnel) + "%" }} /></div>
            </div>
          })}</div>
          <p className="cav3-analytics-footnote">
            Stages are distinct event-session counts, not a guaranteed step-by-step conversion cohort.
            Customers can skip tracked events or use different devices.
            Hamper-specific budget and builder stages do not apply to every jewellery checkout.
          </p>
        </Panel>

        <Panel title="Checkout inactivity indicator" aside="Aggregate telemetry only">
          <div className="cav3-analytics-inactivity">
            <Stat label="Inactive checkout sessions" value={report.checkoutTelemetry.checkoutSessionsInactive}
              description="Last tracked event at least 60 minutes ago" />
            <Stat label="No later payment-start event seen" value={report.checkoutTelemetry.checkoutWithoutLaterPaymentStart}
              description="Subset of those sessions · telemetry proxy" />
          </div>
          <p className="cav3-analytics-footnote">
            This is <b>not</b> a confirmed abandoned checkout or a recoverable order. A missing payment-start event
            could be blocked tracking, a changed device or unfinished activity. No personal details or carts are saved by this report.
          </p>
        </Panel>
      </div>

      <Panel title="Paid order value by day" aside={"Asia/Kolkata · last " + days + " rolling days"}>
        {report.dailyPaidOrders.length ? <div className="cav3-analytics-daily" aria-label="Paid-order daily chart">
          {report.dailyPaidOrders.map(item => <div key={item.day} className="cav3-analytics-day"
            title={item.day + " · " + item.paidOrders + " orders · " + money(item.paidOrderValuePaise)}>
            <b>{money(item.paidOrderValuePaise)}</b>
            <div className="cav3-analytics-bar"><span style={{ height: maxPercent(item.paidOrderValuePaise, dailyMax) + "%" }} /></div>
            <small>{item.day.slice(5)}</small></div>)}
        </div> : <p className="cav3-state">No paid, non-cancelled orders recorded in this period.</p>}
        <p className="cav3-analytics-footnote">Days with paid orders only; no bar does not establish that a date was instrumented. Totals are historical order amounts, not net settlement.</p>
      </Panel>

      <div className="cav3-analytics-grid">
        <Panel title="Saved products · registered accounts" aside="Current account wishlist holdings">
          <div className="cav3-analytics-mini-stats">
            <Stat label="Currently saved items" value={report.wishlist.savedRelationshipsCurrent}
              description="Account × SKU relationships" />
            <Stat label="Accounts with saved items" value={report.wishlist.accountsWithSavedCurrent}
              description="Registered wishlist owners" />
            <Stat label="Current saves added in period" value={report.wishlist.currentSavesCreatedInPeriod}
              description="Still-saved entries created in last " + days + " days" />
          </div>
          <div className="cav3-analytics-ranked">
            {report.wishlist.topProducts.length ? report.wishlist.topProducts.map((item, index) =>
              <div className="cav3-analytics-rank" key={item.productId}>
                <span className="cav3-analytics-rank-no">{index + 1}</span>
                <div><b>{names.get(item.productId)?.name || item.productId}</b><small>{item.productId}</small>
                  <div className="cav3-analytics-track"><span style={{ width: maxPercent(item.savedAccounts, topSavedMax) + "%" }} /></div></div>
                <strong>{item.savedAccounts}</strong>
              </div>) : <p className="cav3-state">No account-backed saved products recorded.</p>}
          </div>
          <p className="cav3-analytics-footnote">Counts come from the current account wishlist table. Removed saves and unsynced guest favourites are not included.</p>
        </Panel>

        <Panel title="Top purchased jewellery products" aside={"Individual paid orders · " + days + " days"}>
          <div className="cav3-analytics-ranked">
            {report.individualProductSales.length ? report.individualProductSales.slice(0, 12).map((item, index) =>
              <div className="cav3-analytics-rank" key={item.productId}>
                <span className="cav3-analytics-rank-no">{index + 1}</span>
                <div><b>{names.get(item.productId)?.name || item.productId}</b>
                  <small>{item.productId} · {item.paidOrders} paid orders · {money(item.grossLineValuePaise)} line value</small>
                  <div className="cav3-analytics-track"><span style={{ width: maxPercent(item.units, maxSold) + "%" }} /></div></div>
                <strong>{item.units}</strong>
              </div>) : <p className="cav3-state">No verified individual-product order line items in this period.</p>}
          </div>
          <p className="cav3-analytics-footnote">Counts and quantities are taken from saved order-line snapshots, not live stock. Gross line value is before cart-wide discounts and does not represent net profit. Curated hamper items have no line-item-level attribution here.</p>
        </Panel>
      </div>

      <Panel title="Current-category attribution" aside="Best-effort · not historical category accounting">
        {categories.length ? <div className="cav3-analytics-categories">
          {categories.map(item => <div className="cav3-analytics-category" key={item.category}>
            <b>{item.category}</b><span>{item.units} units</span><strong>{money(item.grossLineValuePaise)}</strong>
          </div>)}
        </div> : <p className="cav3-state">No category-level line items available.</p>}
        <p className="cav3-analytics-footnote">
          Grouping uses each product's <b>current</b> catalog category, not the category at order time.
          Only recorded individual-item order lines are counted (up to 500 top-selling SKUs).
          Hamper contents and refunds are excluded; figures are not full category net revenue.
        </p>
      </Panel>

      <div className="cav3-analytics-unavailable" role="note">
        <div><h3>Abandoned cart identification</h3><strong>Not available</strong>
          <p>Guest carts remain in localStorage on their own devices. No central cart ledger exists, so there is no honest cart-abandonment count.</p></div>
        <div><h3>Checkout recovery contacts</h3><strong>Not available</strong>
          <p>No verified consent-backed server-side checkout draft or identity link exists for the anonymous funnel.
            Recovery WhatsApp/SMS and individual abandoned-checkout lists are not enabled.</p></div>
        <div><h3>Customer attribution and profit</h3><strong>Not available</strong>
          <p>Session hashes are not matched to people; acquisition sources, product costs, refund settlement and fees are not
            reliably represented here. This view does not invent campaign ROI or profit.</p></div>
      </div>
    </>}
  </div>
}
