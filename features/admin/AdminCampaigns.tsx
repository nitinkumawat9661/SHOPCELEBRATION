"use client"

import { useEffect, useMemo, useState } from "react"
import { routes } from "../../config/routes"
import type { CatalogConfig } from "../../lib/domain/catalog"
import { defaultCatalog, isIndividualListing } from "../../lib/domain/catalog"
import type { Campaign, CampaignConfig } from "../../lib/domain/campaign"

const emptyConfig: CampaignConfig = { campaigns: [] }

function localDateTime(value: string) {
  if (!value) return ""
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function isoDateTime(value: string) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : ""
}

function newCampaign(): Campaign {
  return {
    id: `offer-${Date.now().toString(36)}`,
    name: "10% Checkout Offer",
    badge: "SPECIAL OFFER",
    message: "A little extra saving on your order.",
    active: false,
    mode: "automatic",
    couponCode: "",
    scope: "all",
    trigger: "checkout",
    audience: "all",
    discountType: "percent",
    discountValue: 10,
    maxDiscountRupees: 0,
    minSubtotalRupees: 499,
    eligibleTierIds: [],
    eligibleProductIds: [],
    startAt: "",
    endAt: "",
    totalLimit: 0,
    perCustomerLimit: 1
  }
}

export function AdminCampaigns({ v3 = false, onDirtyChange, onPublished }: {
  v3?: boolean
  onDirtyChange?: (dirty: boolean) => void
  onPublished?: () => void
} = {}) {
  const [config, setConfig] = useState<CampaignConfig>(emptyConfig)
  const [catalog, setCatalog] = useState<CatalogConfig>(defaultCatalog)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState("")
  const [segment, setSegment] = useState<"all" | "active" | "scheduled" | "inactive" | "expired">("all")
  const [now, setNow] = useState(() => Date.now())
  const visible = useMemo(() => {
    const filter = search.trim().toLowerCase()
    return config.campaigns.map((campaign, index) => ({ campaign, index })).filter(({ campaign }) => {
      const start = campaign.startAt ? Date.parse(campaign.startAt) : null
      const end = campaign.endAt ? Date.parse(campaign.endAt) : null
      const state = !campaign.active ? "inactive" : end !== null && end <= now ? "expired"
        : start !== null && start > now ? "scheduled" : "active"
      return (segment === "all" || state === segment) &&
        (!filter || [campaign.id, campaign.name, campaign.couponCode, campaign.scope, campaign.badge]
          .some(value => value.toLowerCase().includes(filter)))
    })
  }, [config.campaigns, search, segment, now])
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => {
    if (!v3) return
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = "" }
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, v3])
  useEffect(() => {
    if (!v3) return
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [v3])

  async function load() {
    setError("")
    const [campaignResponse, catalogResponse] = await Promise.all([
      fetch(routes.api.adminCampaigns, { cache: "no-store" }),
      fetch("/api/catalog", { cache: "no-store" })
    ])
    const campaignData = await campaignResponse.json() as { ok?: boolean; config?: CampaignConfig; version?: number; error?: string }
    const catalogData = await catalogResponse.json() as { ok?: boolean; catalog?: CatalogConfig }
    if (!campaignResponse.ok || !campaignData.ok || !campaignData.config) throw new Error(campaignData.error || "CAMPAIGNS_LOAD_FAILED")
    setConfig(campaignData.config)
    setVersion(campaignData.version || 0)
    if (catalogResponse.ok && catalogData.ok && catalogData.catalog) setCatalog(catalogData.catalog)
    setDirty(false)
    setLoaded(true)
  }

  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : "CAMPAIGNS_LOAD_FAILED")) }, [])

  function replace(index: number, next: Campaign) {
    setConfig((current) => ({ campaigns: current.campaigns.map((item, itemIndex) => itemIndex === index ? next : item) }))
    setDirty(true)
  }

  function patch<K extends keyof Campaign>(index: number, key: K, value: Campaign[K]) {
    replace(index, { ...config.campaigns[index], [key]: value })
  }

  function toggleList(index: number, key: "eligibleTierIds" | "eligibleProductIds", value: string) {
    const current = config.campaigns[index][key]
    patch(index, key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  function add() {
    if (!loaded || busy) return
    setSegment("all")
    setSearch("")
    setConfig((current) => ({ campaigns: [...current.campaigns, newCampaign()] }))
    setDirty(true)
  }

  function remove(index: number) {
    if (v3 && !window.confirm("Remove this campaign from the complete offer configuration? This can affect existing quotes and reporting. The change becomes live only after publishing.")) return
    setConfig((current) => ({ campaigns: current.campaigns.filter((_, itemIndex) => itemIndex !== index) }))
    setDirty(true)
  }

  async function save() {
    if (!loaded || !dirty || busy) return
    if (v3) {
      const enabled = config.campaigns.filter(campaign => campaign.active)
      const couponCodes = config.campaigns.filter(campaign => campaign.mode === "coupon")
      const details = [
        "You are publishing ALL " + config.campaigns.length + " campaigns as a SINGLE versioned live configuration.",
        "Active configuration flags: " + enabled.length,
        "Coupon-mode campaigns: " + couponCodes.length,
        "Changes apply to checkout immediately after saving. There is no persistent draft or automatic rollback.",
        "Existing orders and offer quotes must still be reconciled using their stored records.",
        "The individual-cart eligible product rule currently applies the discount to the entire cart if at least one eligible item matches."
      ].join("\n")
      if (!window.confirm("REVIEW CAMPAIGN PUBLISH\n\n" + details + "\n\nPublish this full offer configuration?")) return
    }
    setBusy(true)
    setNotice("")
    setError("")
    try {
      const response = await fetch(routes.api.adminCampaigns, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, expectedVersion: version })
      })
      const data = await response.json() as { ok?: boolean; config?: CampaignConfig; version?: number; error?: string }
      if (!response.ok || !data.ok || !data.config) {
        if (data.error === "CAMPAIGN_VERSION_CONFLICT") throw new Error("Offer rules changed in another tab/device. Reload before publishing again.")
        throw new Error(data.error || "CAMPAIGNS_SAVE_FAILED")
      }
      setConfig(data.config)
      setVersion(data.version || version + 1)
      setDirty(false)
      setNotice("Offer rules published. Checkout will use these rules immediately.")
      onPublished?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "CAMPAIGNS_SAVE_FAILED")
    } finally {
      setBusy(false)
    }
  }

  async function reload() {
    if (v3 && dirty && !window.confirm("Unsaved offer changes will be discarded. Reload from server?")) return
    await load()
  }

  return (
    <section className="adminWorkspaceCard adminCampaignWorkspace">
      <div className="adminWorkspaceHead">
        <div><div className="kicker">CAMPAIGNS</div><h2>Offers & coupons</h2><p>Create automatic discounts or coupon codes with server-validated pricing. Offers never stack.</p></div>
        <div className="adminActions"><button className="secondary" type="button" onClick={add}>+ Add offer</button><button className="secondary" type="button" disabled={busy} onClick={() => reload().catch((cause) => setError(String(cause)))}>Reload</button><button className="primary" type="button" disabled={busy || !loaded || !dirty} onClick={save}>{busy ? "Publishing…" : `Publish v${version + 1}`}</button></div>
      </div>
      {v3 && <div className="adminDraftNotice" role="note">
        <b>Live campaign configuration · v{version}</b> — changes are local until Publish.
        Publishing writes the entire campaign configuration immediately; no persisted draft, independent archive, or undo operation exists.
        Eligible-products matching means any matching item qualifies the full individual-cart subtotal, not only that item's price.
      </div>}
      {dirty && <div className="adminDraftNotice">Unpublished changes • Live checkout still uses the previous campaign rules.</div>}
      {notice && <div className="successBox adminFeedback">{notice}</div>}
      {error && <div className="errorBox adminFeedback">{error}</div>}
      <div className="adminCampaignGuide"><b>Automatic</b> offers apply at checkout. <b>Coupon</b> offers apply only when the customer enters the exact code. Hamper eligibility uses selected hamper tiers; individual-item eligibility uses selected products. Active quotes and submitted offer orders reserve usage so limited campaigns cannot be oversubscribed; cancelling an order releases its slot.</div>

      {v3 && <div className="cav3-offer-filters">
        <input type="search" aria-label="Search configured offers" placeholder="Search campaign, code, ID or scope"
          value={search} onChange={event => setSearch(event.target.value)} />
        <div className="cav3-chips" aria-label="Offer state filters">
          {(["all","active","scheduled","inactive","expired"] as const).map(state =>
            <button type="button" key={state} className={segment === state ? "is-active" : ""}
              aria-pressed={segment === state} onClick={() => setSegment(state)}>
              {state === "all" ? "All" : state[0].toUpperCase()+state.slice(1)}
            </button>)}
        </div><small>Matching: {visible.length} / {config.campaigns.length}. “Active” means enabled in its time window, not a guarantee of cart eligibility.</small>
      </div>}
      {config.campaigns.length === 0 && <div className="trackingState">No campaigns yet. Add one when you want to run a genuine offer.</div>}
      <div className="adminCampaignList">
        {v3 && loaded && visible.length === 0 && config.campaigns.length > 0 &&
          <p className="trackingState">No campaigns match the current search or state filter.</p>}
        {(v3 ? visible : config.campaigns.map((campaign, index) => ({ campaign, index })))
          .map(({ campaign, index }) => <article className={`adminCampaignCard ${campaign.active ? "active" : ""}`} key={`${campaign.id}-${index}`}>
          <header><div><span>{!v3 ? (campaign.active ? "LIVE WHEN ELIGIBLE" : "DRAFT / OFF") :
            !campaign.active ? "OFF" : campaign.endAt && Date.parse(campaign.endAt) <= now ? "EXPIRED" :
            campaign.startAt && Date.parse(campaign.startAt) > now ? "SCHEDULED" : "ENABLED IN WINDOW"}</span><h3>{campaign.name}</h3><small>{campaign.id}</small></div><label className="adminToggle"><input type="checkbox" checked={campaign.active} onChange={(event) => patch(index, "active", event.target.checked)} /><span>Active</span></label></header>
          <div className="adminSettingsGrid campaignBasics">
            <label>Campaign ID<input value={campaign.id} readOnly /><small>Generated automatically; kept stable for analytics history.</small></label>
            <label>Name<input value={campaign.name} maxLength={100} onChange={(event) => patch(index, "name", event.target.value)} /></label>
            <label>Badge<input value={campaign.badge} maxLength={40} onChange={(event) => patch(index, "badge", event.target.value)} /></label>
            <label>Offer type<select value={campaign.mode} onChange={(event) => patch(index, "mode", event.target.value as Campaign["mode"])}><option value="automatic">Automatic</option><option value="coupon">Coupon code</option></select></label>
            {campaign.mode === "coupon" && <label>Coupon code<input value={campaign.couponCode} maxLength={32} placeholder="WELCOME10" onChange={(event) => patch(index, "couponCode", event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} /></label>}
            <label>Applies to<select value={campaign.scope} onChange={(event) => patch(index, "scope", event.target.value as Campaign["scope"])}><option value="all">All orders</option><option value="hamper">Hampers only</option><option value="individual">Individual items only</option></select></label>
            <label>Trigger<select value="checkout" disabled><option value="checkout">Checkout</option></select><small>Checkout-only to avoid manipulative hesitation offers.</small></label>
            <label>Audience<select value={campaign.audience} onChange={(event) => { const audience = event.target.value as Campaign["audience"]; replace(index, { ...campaign, audience, perCustomerLimit: audience === "first_order" ? 1 : campaign.perCustomerLimit }) }}><option value="all">Everyone</option><option value="first_order">First paid order only</option></select></label>
            <label>Discount type<select value={campaign.discountType} onChange={(event) => patch(index, "discountType", event.target.value as Campaign["discountType"])}><option value="percent">Percent</option><option value="fixed">Fixed ₹</option></select></label>
            <label>Discount value<input type="number" min={1} value={campaign.discountValue} onChange={(event) => patch(index, "discountValue", Number(event.target.value))} /><small>{campaign.discountType === "percent" ? "% off" : "Rupees off"}</small></label>
            <label>Max discount ₹<input type="number" min={0} value={campaign.maxDiscountRupees} onChange={(event) => patch(index, "maxDiscountRupees", Number(event.target.value))} /><small>0 = no extra cap</small></label>
            <label>Minimum order ₹<input type="number" min={0} value={campaign.minSubtotalRupees} onChange={(event) => patch(index, "minSubtotalRupees", Number(event.target.value))} /></label>
            <label>Total uses<input type="number" min={0} value={campaign.totalLimit} onChange={(event) => patch(index, "totalLimit", Number(event.target.value))} /><small>0 = unlimited</small></label>
            <label>Uses per customer<input type="number" min={campaign.audience === "first_order" ? 1 : 0} disabled={campaign.audience === "first_order"} value={campaign.audience === "first_order" ? 1 : campaign.perCustomerLimit} onChange={(event) => patch(index, "perCustomerLimit", Number(event.target.value))} /><small>{campaign.audience === "first_order" ? "Locked to 1 for first-order campaigns" : "0 = unlimited"}</small></label>
            <label>Starts<input type="datetime-local" value={localDateTime(campaign.startAt)} onChange={(event) => patch(index, "startAt", isoDateTime(event.target.value))} /></label>
            <label>Ends<input type="datetime-local" value={localDateTime(campaign.endAt)} onChange={(event) => patch(index, "endAt", isoDateTime(event.target.value))} /></label>
            <label className="adminWide">Customer message<input value={campaign.message} maxLength={180} onChange={(event) => patch(index, "message", event.target.value)} /></label>
          </div>

          <div className="campaignEligibility">
            <div><b>Eligible hampers</b><small>Applies only to hamper orders. Nothing selected = all active hampers.</small><div className="campaignChoiceGrid">{catalog.tiers.filter((tier) => tier.active !== false).map((tier) => <label key={tier.id}><input type="checkbox" checked={campaign.eligibleTierIds.includes(tier.id)} onChange={() => toggleList(index, "eligibleTierIds", tier.id)} /><span>₹{tier.price} • {tier.name}</span></label>)}</div></div>
            <div><b>Eligible products</b><small>Applies only to individual-item carts. Nothing selected = any individual product; otherwise at least one cart item must match.</small><div className="campaignChoiceGrid campaignProducts">{catalog.products.filter((product) => isIndividualListing(product)).map((product) => <label key={product.id}><input type="checkbox" checked={campaign.eligibleProductIds.includes(product.id)} onChange={() => toggleList(index, "eligibleProductIds", product.id)} /><span>{product.name}</span></label>)}</div></div>
          </div>
          <footer><div className="adminCampaignPreview"><span>{campaign.badge}</span><b>{campaign.name}</b><small>{campaign.message}</small></div><button className="dangerButton" type="button" onClick={() => remove(index)}>Delete offer</button></footer>
        </article>)}
      </div>
    </section>
  )
}
