"use client"

import { useEffect, useMemo, useState } from "react"
import { formatMoney } from "../../../lib/domain/catalog"
import type { Campaign, CampaignConfig } from "../../../lib/domain/campaign"
import { AdminCampaigns } from "../AdminCampaigns"

type Range = 7 | 30 | 90
type Stats = {
  days: number
  orders: number
  discountPaise: number
  offerQuotes: number
  offerRedemptions: number
  campaigns: {
    campaignId: string
    campaignTitle: string
    orders: number
    revenuePaise: number
    discountPaise: number
  }[]
}
type State = "active" | "scheduled" | "inactive" | "expired"
function stateFor(campaign: Campaign, now: number): State {
  if (!campaign.active) return "inactive"
  const ended = campaign.endAt ? Date.parse(campaign.endAt) : null
  const starts = campaign.startAt ? Date.parse(campaign.startAt) : null
  if (ended !== null && Number.isFinite(ended) && ended <= now) return "expired"
  if (starts !== null && Number.isFinite(starts) && starts > now) return "scheduled"
  return "active"
}
function stateText(value: State) {
  return ({ active: "Enabled · in date window", inactive: "Off", scheduled: "Scheduled", expired: "Expired" } as const)[value]
}
function offerValue(campaign: Campaign) {
  return campaign.discountType === "percent"
    ? campaign.discountValue + "% off" : formatMoney(campaign.discountValue) + " off"
}
function dateRange(iso: string) {
  if (!iso) return "No date restriction"
  const date = new Date(iso)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata"
  }).format(date) + " IST" : "Invalid date"
}

export function AdminOffersV3({ onDirtyChange }: {
  onDirtyChange: (dirty: boolean) => void
}) {
  const [period, setPeriod] = useState<Range>(30)
  const [reloadToken, setReloadToken] = useState(0)
  const [campaignConfig, setCampaignConfig] = useState<CampaignConfig | null>(null)
  const [configError, setConfigError] = useState("")
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsError, setStatsError] = useState("")
  const [clock, setClock] = useState(() => Date.now())
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    const ctrl = new AbortController()
    setCampaignConfig(null)
    setConfigError("")
    void (async () => {
      try {
        const response = await fetch("/api/admin/campaigns", {
          cache: "no-store", signal: ctrl.signal, credentials: "same-origin"
        })
        const body = await response.json() as { ok?: boolean; config?: CampaignConfig }
        if (!response.ok || !body.ok || !body.config || !Array.isArray(body.config.campaigns)) {
          throw Error("CAMPAIGN_STATUS_UNAVAILABLE")
        }
        if (!ctrl.signal.aborted) setCampaignConfig(body.config)
      } catch {
        if (!ctrl.signal.aborted) setConfigError("Campaign status could not be verified. Editor may still load independently.")
      }
    })()
    return () => ctrl.abort()
  }, [reloadToken])

  useEffect(() => {
    const ctrl = new AbortController()
    setStats(null)
    setStatsError("")
    void (async () => {
      try {
        const response = await fetch("/api/admin/analytics?days=" + period, {
          cache: "no-store", signal: ctrl.signal, credentials: "same-origin"
        })
        const body = await response.json() as { ok?: boolean; analytics?: Stats }
        if (!response.ok || !body.ok || !body.analytics || !Array.isArray(body.analytics.campaigns) ||
            !Number.isFinite(body.analytics.discountPaise) || !Number.isFinite(body.analytics.orders)) {
          throw Error("CAMPAIGN_ANALYTICS_UNAVAILABLE")
        }
        if (!ctrl.signal.aborted) setStats(body.analytics)
      } catch {
        if (!ctrl.signal.aborted) setStatsError("Paid campaign analytics are unavailable; no amounts are estimated.")
      }
    })()
    return () => ctrl.abort()
  }, [period, reloadToken])

  const summary = useMemo(() => {
    if (!campaignConfig) return null
    const states = campaignConfig.campaigns.map(campaign => stateFor(campaign, clock))
    return {
      all: states.length,
      active: states.filter(status => status === "active").length,
      scheduled: states.filter(status => status === "scheduled").length,
      inactive: states.filter(status => status === "inactive").length,
      expired: states.filter(status => status === "expired").length
    }
  }, [campaignConfig, clock])

  return <div className="cav3-offers">
    <div className="cav3-offer-overview">
      <div><span>Configured offers</span><strong>{summary ? summary.all : "—"}</strong><small>Entire published campaign config</small></div>
      <div><span>Enabled in date window</span><strong>{summary ? summary.active : "—"}</strong><small>Other checkout eligibility still applies</small></div>
      <div><span>Scheduled</span><strong>{summary ? summary.scheduled : "—"}</strong><small>Future enabled start time</small></div>
      <div><span>Off / expired</span><strong>{summary ? summary.inactive + summary.expired : "—"}</strong><small>Inactive or past expiry</small></div>
    </div>
    <section className="cav3-panel">
      <div className="cav3-panel-head"><h2>Offer performance</h2>
        <div className="cav3-offer-head-actions">
          <select value={period} aria-label="Campaign performance date range" onChange={event => setPeriod(Number(event.target.value) as Range)}>
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </select>
          <button type="button" onClick={() => setReloadToken(n => n + 1)} disabled={editing}>Refresh</button>
        </div>
      </div>
      {configError && <p className="cav3-error" role="alert">{configError}</p>}
      {statsError && <p className="cav3-error" role="alert">{statsError}</p>}
      <div className="cav3-offer-stats">
        <div><span>Offer quote records</span><b>{stats ? stats.offerQuotes : "—"}</b></div>
        <div><span>Recorded redemptions</span><b>{stats ? stats.offerRedemptions : "—"}</b></div>
        <div><span>Recorded discounts on paid orders</span><b>{stats ? formatMoney(stats.discountPaise / 100) : "—"}</b></div>
      </div>
      <p className="cav3-offer-caveat">Period = rolling {period} days. These figures use existing event and verified paid/non-cancelled order reporting, not accounting net profit or ROI. A saved campaign flag does not guarantee a discount is eligible for every customer.</p>
      {stats?.campaigns.length ? <div className="cav3-offer-report">
        <div className="cav3-offer-report-heading"><b>Paid orders by campaign</b><small>Historical campaign IDs remain in records after deletion.</small></div>
        {stats.campaigns.map(row => <div key={row.campaignId} className="cav3-offer-report-row">
          <div><b>{row.campaignTitle}</b><small>{row.campaignId}</small></div>
          <span>{row.orders} paid orders</span>
          <span>{formatMoney(row.discountPaise / 100)} discounts</span>
        </div>)}
      </div> : stats && <p className="cav3-state">No paid orders with recorded campaign IDs in this period.</p>}
    </section>

    <section className="cav3-panel">
      <div className="cav3-panel-head"><h2>Published campaign rules</h2><span className="cav3-quiet">{summary ? summary.all + " campaigns" : "Loading…"}</span></div>
      {campaignConfig?.campaigns.length === 0 && <p className="cav3-state">No configured campaigns. Use the editor below to create one.</p>}
      <div className="cav3-offer-published">
        {campaignConfig?.campaigns.map(campaign => <article key={campaign.id}>
          <div><b>{campaign.name}</b><small>{campaign.id} · {campaign.mode === "coupon" ? "Coupon" : "Automatic"} · {campaign.scope}</small></div>
          <strong>{offerValue(campaign)}</strong>
          <span className={"cav3-offer-status is-" + stateFor(campaign, clock)}>{stateText(stateFor(campaign, clock))}</span>
          <small>{campaign.startAt ? "From " + dateRange(campaign.startAt) : "No start limit"} · {campaign.endAt ? "Until " + dateRange(campaign.endAt) : "No end limit"}</small>
        </article>)}
      </div>
    </section>

    <div className="cav3-offer-constraints" role="note">
      <b>Pricing safeguards:</b> Automatic and coupon offers never stack; valid quotes and submitted offer orders can reserve usage.
      First-order restrictions are checked by the server. For an individual cart, a matching eligible product
      can qualify the entire cart subtotal—not just that line item. Draft changes are only local until the
      full, version-checked configuration is published. No read-only quote simulator or archive feature has been implemented.
    </div>

    <AdminCampaigns v3 onDirtyChange={onDirtyChange} onPublished={() => setReloadToken(value => value + 1)} />
    <p className="cav3-offer-footer">The V3 editor invokes the existing protected campaign API. Publishing updates real checkout eligibility immediately
      in the connected environment. Do not test live offers on production data. <a href="/admin">Existing admin ↗</a></p>
  </div>
}
