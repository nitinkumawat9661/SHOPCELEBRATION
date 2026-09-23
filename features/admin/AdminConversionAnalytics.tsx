"use client"

import { useEffect, useState } from "react"
import { routes } from "../../config/routes"
import { formatMoney } from "../../lib/domain/catalog"

type FunnelMetric = { sessions: number; events: number }
type Analytics = {
  days: number
  funnel: {
    storefront_view: FunnelMetric
    budget_selected: FunnelMetric
    builder_started: FunnelMetric
    checkout_reached: FunnelMetric
    offer_shown: FunnelMetric
    payment_started: FunnelMetric
  }
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
  campaigns: { campaignId: string; campaignTitle: string; orders: number; revenuePaise: number; discountPaise: number }[]
}

const empty: Analytics = {
  days: 30,
  funnel: {
    storefront_view: { sessions: 0, events: 0 },
    budget_selected: { sessions: 0, events: 0 },
    builder_started: { sessions: 0, events: 0 },
    checkout_reached: { sessions: 0, events: 0 },
    offer_shown: { sessions: 0, events: 0 },
    payment_started: { sessions: 0, events: 0 }
  },
  orders: 0,
  revenuePaise: 0,
  subtotalPaise: 0,
  discountPaise: 0,
  customRequests: 0,
  offerQuotes: 0,
  offerRedemptions: 0,
  checkoutRate: 0,
  orderRate: 0,
  offerRedemptionRate: 0,
  campaigns: []
}

export function AdminConversionAnalytics() {
  const [days, setDays] = useState(30)
  const [analytics, setAnalytics] = useState<Analytics>(empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function load(nextDays = days) {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`${routes.api.adminAnalytics}?days=${nextDays}`, { cache: "no-store" })
      const data = await response.json() as { ok?: boolean; analytics?: Analytics; error?: string }
      if (!response.ok || !data.ok || !data.analytics) throw new Error(data.error || "ANALYTICS_LOAD_FAILED")
      setAnalytics(data.analytics)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ANALYTICS_LOAD_FAILED")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load(days) }, [days])

  const funnel = [
    ["Store visits", analytics.funnel.storefront_view.sessions],
    ["Budget selected", analytics.funnel.budget_selected.sessions],
    ["Builder started", analytics.funnel.builder_started.sessions],
    ["Checkout reached", analytics.funnel.checkout_reached.sessions],
    ["Payment started", analytics.funnel.payment_started.sessions]
  ] as const
  const base = Math.max(1, analytics.funnel.storefront_view.sessions)

  return (
    <section className="adminWorkspaceCard adminAnalyticsWorkspace">
      <div className="adminWorkspaceHead">
        <div><div className="kicker">CONVERSION ANALYTICS</div><h2>What moves customers forward?</h2><p>Privacy-safe funnel counts use anonymous browser-session hashes; campaign revenue comes from actual non-cancelled orders.</p></div>
        <div className="adminActions"><select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select><button className="secondary" type="button" disabled={loading} onClick={() => load()}>{loading ? "Refreshing…" : "Refresh"}</button></div>
      </div>
      {error && <div className="errorBox adminFeedback">{error}</div>}

      <div className="adminKpiGrid analyticsKpis">
        <div><span>Orders</span><b>{analytics.orders}</b><small>{analytics.orderRate}% of tracked visits</small></div>
        <div><span>Order value</span><b>{formatMoney(analytics.revenuePaise / 100)}</b><small>Non-cancelled submitted orders</small></div>
        <div><span>Discount given</span><b>{formatMoney(analytics.discountPaise / 100)}</b><small>Real campaign discount</small></div>
        <div><span>Checkout rate</span><b>{analytics.checkoutRate}%</b><small>Tracked visit → checkout</small></div>
        <div><span>Offer redemption</span><b>{analytics.offerRedemptionRate}%</b><small>{analytics.offerRedemptions}/{analytics.offerQuotes} reserved quotes</small></div>
        <div><span>Budget requests</span><b>{analytics.customRequests}</b><small>Custom hamper leads</small></div>
      </div>

      <div className="adminOverviewSplit analyticsSplit">
        <section className="adminWorkspaceCard analyticsFunnelCard">
          <div className="kicker">FUNNEL</div><h3>Tracked customer journey</h3>
          <div className="analyticsFunnel">{funnel.map(([label, value]) => <div key={label}><div><span>{label}</span><b>{value}</b></div><i><em style={{ width: `${Math.max(value ? 4 : 0, Math.min(100, value * 100 / base))}%` }} /></i></div>)}</div>
          <small className="adminMetricNote">One browser session can create multiple events; funnel uses distinct sessions at each step, not personally identified users.</small>
        </section>

        <section className="adminWorkspaceCard analyticsOfferCard">
          <div className="kicker">OFFER IMPACT</div><h3>Discount economics</h3>
          <div className="analyticsMoney"><div><span>Gross before discount</span><b>{formatMoney(analytics.subtotalPaise / 100)}</b></div><div><span>Discount</span><b>− {formatMoney(analytics.discountPaise / 100)}</b></div><div><span>Submitted order value</span><b>{formatMoney(analytics.revenuePaise / 100)}</b></div></div>
        </section>
      </div>

      <section className="adminWorkspaceCard campaignPerformance">
        <div className="adminWorkspaceHead"><div><div className="kicker">CAMPAIGN PERFORMANCE</div><h3>Offers that converted</h3></div></div>
        {analytics.campaigns.length === 0 ? <div className="trackingState">No campaign orders in this period yet.</div> : <div className="campaignPerformanceList">{analytics.campaigns.map((campaign) => <div key={campaign.campaignId}><div><b>{campaign.campaignTitle}</b><small>{campaign.campaignId}</small></div><span>{campaign.orders} orders</span><span>{formatMoney(campaign.revenuePaise / 100)} value</span><span>{formatMoney(campaign.discountPaise / 100)} discount</span></div>)}</div>}
      </section>
    </section>
  )
}
