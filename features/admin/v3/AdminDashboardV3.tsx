"use client"

import { useEffect, useMemo, useState } from "react"
import type { CatalogConfig, GiftProduct } from "../../../lib/domain/catalog"
import { catalogImageVariant, formatMoney, primaryProductImage } from "../../../lib/domain/catalog"
import { orderStatusLabels, customerPaymentStatusLabel } from "../../../lib/domain/order-status"
import { countAdminFilter, filterAdminOrders } from "../orderFilters"
import type { AdminOrder } from "../types"
import { AdminOrderDetailV3, AdminProductDetailV3 } from "./AdminDetailsV3"
import type { AdminOrderFilterId } from "../../../config/admin-orders"

type View = "overview" | "orders" | "products" | "inventory" | "hampers" | "offers" | "customers" | "analytics" | "reviews" | "settings"
type Analytics = { days: number; orders: number; revenuePaise: number; discountPaise: number; checkoutRate: number }
type ResultOrders = { ok?: boolean; orders?: AdminOrder[]; error?: string }
type ResultCatalog = { ok?: boolean; catalog?: CatalogConfig; error?: string }
type ResultAnalytics = { ok?: boolean; analytics?: Analytics; error?: string }

const groups: { label: string; views: { id: View; label: string; icon: string }[] }[] = [
  { label: "Workspace", views: [
    { id: "overview", label: "Overview", icon: "▦" },
    { id: "orders", label: "Orders", icon: "▤" },
    { id: "products", label: "Products", icon: "◇" },
    { id: "inventory", label: "Inventory", icon: "▥" }
  ] },
  { label: "Commerce", views: [
    { id: "hampers", label: "Hampers", icon: "▣" },
    { id: "offers", label: "Offers & Coupons", icon: "%" },
    { id: "customers", label: "Customers", icon: "♙" },
    { id: "analytics", label: "Analytics", icon: "⌁" }
  ] },
  { label: "Management", views: [
    { id: "reviews", label: "Reviews", icon: "☆" },
    { id: "settings", label: "Settings", icon: "⚙" }
  ] }
]

const headings: Record<View, { kicker: string; heading: string; description: string }> = {
  overview: { kicker: "Store command center", heading: "Welcome to your workspace.", description: "Live paid-order numbers and operational priorities in one place." },
  orders: { kicker: "Order operations", heading: "Orders", description: "Search the current order pipeline. Existing admin handles fulfilment actions." },
  products: { kicker: "Your catalogue", heading: "Products", description: "Browse live jewellery and hamper items. Existing admin handles publishing." },
  inventory: { kicker: "Coming in phase 3", heading: "Inventory", description: "Transactional stock adjustments and reservations will be added after safety testing." },
  hampers: { kicker: "Coming in phase 4", heading: "Hampers", description: "Curated and Self-Build configuration stays in the existing admin for now." },
  offers: { kicker: "Coming in phase 4", heading: "Offers & Coupons", description: "The existing versioned campaign editor remains the operational source." },
  customers: { kicker: "Coming in phase 5", heading: "Customers", description: "Privacy-safe customer profiles require new admin-only endpoints." },
  analytics: { kicker: "Coming in phase 5", heading: "Analytics", description: "Current analytics remains available in the existing admin." },
  reviews: { kicker: "Coming in a later phase", heading: "Reviews", description: "Genuine-review moderation remains available in the current admin." },
  settings: { kicker: "Coming in phase 6", heading: "Settings & Security", description: "Existing passkeys, payment credentials and support settings remain unchanged." }
}

const orderFilters: { id: AdminOrderFilterId; label: string }[] = [
  { id: "all", label: "All" }, { id: "active", label: "Active" },
  { id: "payment", label: "Payment" }, { id: "packing", label: "Packing" },
  { id: "approval", label: "Approval" }, { id: "shipping", label: "Shipping" },
  { id: "issues", label: "Issues" }, { id: "closed", label: "Closed" }
]

function asMoney(paise: number) { return formatMoney(paise / 100) }
function dateTime(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata"
  }).format(date)
}
function statusStyle(status: string) {
  if (status === "delivered" || status === "payment_verified" || status === "refund_or_replacement_resolved") return "good"
  if (status === "issue_reported" || status === "cancelled") return "bad"
  return "pending"
}
function Badge({ text, variant }: { text: string; variant: string }) {
  return <span className={"cav3-badge cav3-badge--" + variant}>{text}</span>
}
function Section({ title, extra, children, className = "" }: { title: string; extra?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={"cav3-panel " + className}><div className="cav3-panel-head"><h2>{title}</h2>{extra}</div>{children}</section>
}
function Metric({ title, value, note, attention }: { title: string; value: string; note: string; attention?: boolean }) {
  return <div className={"cav3-metric" + (attention ? " cav3-metric--attention" : "")}>
    <span>{title}</span><strong>{value}</strong><small>{note}</small>
  </div>
}
function ProductThumb({ product }: { product: GiftProduct }) {
  const source = primaryProductImage(product)?.url
  return <div className="cav3-thumb">{source
    ? <img src={catalogImageVariant(source, "thumb")} alt="" loading="lazy" referrerPolicy="no-referrer" />
    : <span aria-hidden="true">◇</span>}</div>
}
function OrderRow({ order, onSelect }: { order: AdminOrder; onSelect: () => void }) {
  return <div role="button" tabIndex={0} onClick={onSelect}
    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect() } }}
    aria-label={"View order " + order.publicId} className="cav3-table-row cav3-order-row cav3-click-row">
    <div><b>{order.publicId}</b><small>{dateTime(order.createdAt)}</small></div>
    <div><b>{order.customerName || "Customer"}</b><small>{order.orderType === "individual" ? "Jewellery" : "Hamper"}</small></div>
    <div><b>{asMoney(order.amountPaise)}</b><small>{customerPaymentStatusLabel(order.paymentStatus)}</small></div>
    <div><Badge text={orderStatusLabels[order.status] || order.status.replaceAll("_", " ")} variant={statusStyle(order.status)} /></div>
  </div>
}

export function AdminDashboardV3() {
  const [view, setView] = useState<View>("overview")
  const [period, setPeriod] = useState<7 | 30 | 90>(7)
  const [refreshKey, setRefreshKey] = useState(0)
  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  const [catalog, setCatalog] = useState<CatalogConfig | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [ordersError, setOrdersError] = useState("")
  const [catalogError, setCatalogError] = useState("")
  const [analyticsError, setAnalyticsError] = useState("")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [orderFilter, setOrderFilter] = useState<AdminOrderFilterId>("active")
  const [moreOpen, setMoreOpen] = useState(false)
  const [busyLogout, setBusyLogout] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setOrdersError("")
    setCatalogError("")
    void (async () => {
      try {
        const r = await fetch("/api/admin/orders", { cache: "no-store", signal: controller.signal })
        const data = await r.json() as ResultOrders
        if (!r.ok || !data.ok || !Array.isArray(data.orders)) throw new Error("Order records unavailable.")
        if (!controller.signal.aborted) setOrders(data.orders)
      } catch { if (!controller.signal.aborted) { setOrders(null); setOrdersError("Orders could not be loaded. Refresh to retry.") } }
    })()
    void (async () => {
      try {
        const r = await fetch("/api/catalog", { cache: "no-store", signal: controller.signal })
        const data = await r.json() as ResultCatalog
        if (!r.ok || !data.ok || !data.catalog?.products) throw new Error("Catalog unavailable.")
        if (!controller.signal.aborted) setCatalog(data.catalog)
      } catch { if (!controller.signal.aborted) { setCatalog(null); setCatalogError("The live catalog could not be loaded. Refresh to retry.") } }
    })()
    return () => controller.abort()
  }, [refreshKey])

  useEffect(() => {
    const controller = new AbortController()
    setAnalytics(null)
    setAnalyticsError("")
    void (async () => {
      try {
        const r = await fetch("/api/admin/analytics?days=" + period, { cache: "no-store", signal: controller.signal })
        const data = await r.json() as ResultAnalytics
        if (!r.ok || !data.ok || !data.analytics || !Number.isFinite(data.analytics.revenuePaise)) throw new Error("Analytics unavailable.")
        if (!controller.signal.aborted) setAnalytics(data.analytics)
      } catch { if (!controller.signal.aborted) setAnalyticsError("Verified analytics could not be loaded. Refresh to retry.") }
    })()
    return () => controller.abort()
  }, [period, refreshKey])

  const queue = useMemo(() => orders ? {
    active: countAdminFilter(orders, "active"), payment: countAdminFilter(orders, "payment"),
    packing: countAdminFilter(orders, "packing"), approval: countAdminFilter(orders, "approval"),
    shipping: countAdminFilter(orders, "shipping"), issues: countAdminFilter(orders, "issues")
  } : null, [orders])

  const products = useMemo(() => {
    if (!catalog) return []
    const normalized = query.trim().toLowerCase()
    return catalog.products.filter((p) =>
      (category === "all" || p.category === category) &&
      (!normalized || (p.name + " " + p.id + " " + p.category).toLowerCase().includes(normalized))
    )
  }, [catalog, query, category])
  const availableCategories = useMemo(() => catalog
    ? Array.from(new Set(catalog.products.map((p) => p.category))).sort()
    : [], [catalog])
  const currentOrders = useMemo(() => orders
    ? filterAdminOrders(orders, orderFilter, query, "newest") : [], [orders, orderFilter, query])
  const recentOrders = useMemo(() => orders ? [...orders].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)).slice(0, 4) : [], [orders])
  const retail = useMemo(() => catalog ? catalog.products.filter((p) =>
    p.active !== false && p.sellIndividually === true && typeof p.stockAvailable === "number") : [], [catalog])
  const stockLow = retail.filter((p) => (p.stockAvailable || 0) > 0 && (p.stockAvailable || 0) <= 3).length
  const stockOut = retail.filter((p) => p.stockAvailable === 0).length
  const selectedOrder = selectedOrderId ? orders?.find((order) => order.publicId === selectedOrderId) : undefined
  const selectedProduct = selectedProductId ? catalog?.products.find((product) => product.id === selectedProductId) : undefined
  const info = headings[view]

  function navigate(next: View) {
    setView(next)
    setMoreOpen(false)
    setQuery("")
    setCategory("all")
    setSelectedOrderId(null)
    setSelectedProductId(null)
    window.scrollTo({ top: 0, behavior: "instant" })
  }
  async function logout() {
    setBusyLogout(true)
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" })
      if (!response.ok) throw new Error("Logout failed")
      window.location.href = "/admin"
    } catch {
      setBusyLogout(false)
      window.alert("Could not sign out. Try again.")
    }
  }

  const nav = (id: View, label: string, icon: string, mobile = false) =>
    <button key={id} type="button" className={(mobile ? "cav3-bottom-item" : "cav3-nav-item") + (view === id ? " is-current" : "")}
      onClick={() => navigate(id)} aria-current={view === id ? "page" : undefined}>
      <span className="cav3-nav-icon" aria-hidden="true">{icon}</span><span>{label}</span>
      {!mobile && id === "orders" && queue?.active ? <em>{queue.active}</em> : null}
    </button>

  return <div className="cav3-root">
    <aside className="cav3-sidebar" aria-label="Admin V3 navigation">
      <div className="cav3-brand"><span className="cav3-brand-mark">C</span><span><b>Celebration</b><small>ADMIN STUDIO</small></span></div>
      <nav className="cav3-sidebar-scroll">{groups.map((g) =>
        <div className="cav3-nav-group" key={g.label}><div className="cav3-nav-label">{g.label}</div>
          {g.views.map((item) => nav(item.id, item.label, item.icon))}</div>
      )}</nav>
      <div className="cav3-side-footer"><span>DEVELOPMENT PREVIEW · V3</span><small>Read-only. Live admin is unchanged.</small>
        <a href="/admin">Open current admin ↗</a><button type="button" disabled={busyLogout} onClick={() => void logout()}>Log out</button>
      </div>
    </aside>

    <div className="cav3-main">
      <header className="cav3-topbar"><span>Celebration Admin <span className="cav3-breadcrumb">/ {view === "overview" ? "Overview" : info.heading}</span></span>
        <div><Badge text="DEVELOPMENT PREVIEW" variant="neutral" /><a href="/" target="_blank" rel="noreferrer">View store ↗</a></div>
      </header>
      <main className="cav3-content">
        <div className="cav3-intro"><div><div className="cav3-eyebrow">{info.kicker}</div><h1>{info.heading}</h1><p>{info.description}</p></div>
          <div className="cav3-intro-buttons">{view === "overview" && <select aria-label="Reporting period" value={period} onChange={(e) => setPeriod(Number(e.target.value) as 7 | 30 | 90)}>
            <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
          </select>}
          <button type="button" onClick={() => setRefreshKey((v) => v + 1)}>Refresh</button>
          <a className="cav3-primary" href="/admin">Manage in current admin ↗</a></div>
        </div>

        <p className="cav3-preview-notice" role="note">Phase 1: passkey-protected, read-only V3 preview with real backend data. No product, order, stock or payment updates occur here.</p>

        {view === "overview" && <>
          {(analyticsError || ordersError || catalogError) && <p className="cav3-error" role="alert">{[analyticsError, ordersError, catalogError].filter(Boolean).join(" ")}</p>}
          <div className="cav3-metrics">
            <Metric title="Verified paid-order value" value={analytics ? asMoney(analytics.revenuePaise) : "—"} note={"Last " + period + " days · paid/verified, non-cancelled"} />
            <Metric title="Paid orders" value={analytics ? String(analytics.orders) : "—"} note={"Last " + period + " days"} />
            <Metric title="Needs attention" value={queue ? String(queue.payment + queue.packing + queue.approval + queue.issues) : "—"} note="Current queue · not historical" attention />
            <Metric title="Average order value" value={analytics ? (analytics.orders ? asMoney(Math.round(analytics.revenuePaise / analytics.orders)) : asMoney(0)) : "—"} note="Paid-order value divided by paid orders" />
          </div>
          <div className="cav3-two-col">
            <Section title="Action center" extra={<button type="button" className="cav3-text-link" onClick={() => navigate("orders")}>View all →</button>}>
              {queue ? <div className="cav3-action-list">
                {([["payment", "Payment verification", queue.payment], ["packing", "Orders to prepare", queue.packing],
                  ["approval", "Customer approval", queue.approval], ["issues", "Customer issues", queue.issues]] as const).map(([id, label, count]) =>
                  <button type="button" key={id} onClick={() => { navigate("orders"); setOrderFilter(id) }}>
                    <span>{label}</span><b>{count}</b></button>)}
              </div> : <p className="cav3-state">Loading operational queue…</p>}
            </Section>
            <Section title="Inventory health" extra={<button type="button" className="cav3-text-link" onClick={() => navigate("products")}>Products →</button>}>
              {catalog ? <div className="cav3-health"><p><span>Tracked active retail products</span><b>{retail.length}</b></p>
                <p><span>Low stock (1–3 units)</span><b>{stockLow}</b></p>
                <p><span>Out of stock</span><b>{stockOut}</b></p></div>
              : <p className="cav3-state">Loading live inventory view…</p>}
            </Section>
          </div>
          <Section title="Recent orders" extra={<button type="button" className="cav3-text-link" onClick={() => { navigate("orders"); setOrderFilter("all") }}>All orders →</button>}>
            {orders ? recentOrders.length ? <div className="cav3-table">
              {recentOrders.map((order) => <OrderRow key={order.publicId} order={order} onSelect={() => {
                navigate("orders"); setOrderFilter("all"); setSelectedOrderId(order.publicId)
              }} />)}
            </div> : <p className="cav3-state">No orders recorded yet.</p>
            : <p className="cav3-state">Order data unavailable or loading.</p>}
          </Section>
        </>}

        {view === "products" && (selectedProduct ? <AdminProductDetailV3 key={selectedProduct.id} product={selectedProduct}
          onBack={() => setSelectedProductId(null)} /> : <>
          {catalogError && <p role="alert" className="cav3-error">{catalogError}</p>}
          <div className="cav3-filters"><input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            aria-label="Search live products" placeholder="Search product or SKU…" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter category">
              <option value="all">All categories</option>{availableCategories.map((v) => <option value={v} key={v}>{v}</option>)}
            </select></div>
          <Section title="Live product catalogue" extra={<span className="cav3-quiet">{catalog ? products.length + " matching products" : "Loading…"}</span>}>
            {catalog ? products.length ? <div className="cav3-table cav3-product-list">
              {products.slice(0, 60).map((product) => <div role="button" tabIndex={0} className="cav3-table-row cav3-product-row cav3-click-row" key={product.id}
                onClick={() => { setSelectedProductId(product.id); window.scrollTo({ top: 0, behavior: "instant" }) }}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault(); setSelectedProductId(product.id); window.scrollTo({ top: 0, behavior: "instant" })
                } }} aria-label={"View product " + product.name}>
                <div className="cav3-product-identity"><ProductThumb product={product} /><span><b>{product.name}</b><small>{product.id}</small></span></div>
                <div><b>{product.category}</b><small>{product.active === false ? "Inactive" : "Active"}</small></div>
                <div><b>{typeof product.salePricePaise === "number" ? asMoney(product.salePricePaise) : "—"}</b><small>Selling price</small></div>
                <div><Badge text={product.sellIndividually
                  ? (product.stockAvailable === 0 ? "Out of stock" : typeof product.stockAvailable === "number" ? product.stockAvailable + " available" : "Stock unavailable")
                  : "Hamper catalogue"} variant={product.stockAvailable === 0 ? "bad" : "neutral"} /></div>
              </div>)}
              {products.length > 60 && <p className="cav3-state">Showing the first 60 matching products. Narrow search to locate a specific SKU.</p>}
            </div> : <p className="cav3-state">No products match these filters.</p> : <p className="cav3-state">Loading live catalogue…</p>}
          </Section>
        </>)}

        {view === "orders" && (selectedOrder ? <AdminOrderDetailV3 key={selectedOrder.publicId} order={selectedOrder}
          onBack={() => setSelectedOrderId(null)} /> : <>
          {ordersError && <p role="alert" className="cav3-error">{ordersError}</p>}
          <div className="cav3-filters"><input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            aria-label="Search orders" placeholder="Search order ID, customer or tracking…" /></div>
          <div className="cav3-chips" aria-label="Order filters">{orderFilters.map((f) =>
            <button key={f.id} type="button" className={orderFilter === f.id ? "is-active" : ""}
              onClick={() => setOrderFilter(f.id)}>{f.label}</button>)}</div>
          <Section title="Order pipeline" extra={<span className="cav3-quiet">{orders ? currentOrders.length + " orders" : "Loading…"}</span>}>
            {orders ? currentOrders.length ? <div className="cav3-table">{currentOrders.slice(0, 60).map((order) => <OrderRow key={order.publicId} order={order}
                onSelect={() => { setSelectedOrderId(order.publicId); window.scrollTo({ top: 0, behavior: "instant" }) }} />)}
              {currentOrders.length > 60 && <p className="cav3-state">Showing the first 60 matches. Narrow your search.</p>}
            </div> : <p className="cav3-state">No orders match this filter.</p> : <p className="cav3-state">Loading current orders…</p>}
          </Section>
          <p className="cav3-help">To verify payments, update status, upload packing video or book Shipway, continue using the <a href="/admin">existing operational admin</a>.</p>
        </>)}

        {!["overview", "products", "orders"].includes(view) && <div className="cav3-next-phase">
          <span className="cav3-brand-mark">C</span><h2>{info.heading} · Planned development</h2>
          <p>{info.description} This visual shell is not yet connected to a V3 operational screen. Nothing is fabricated or editable.</p>
          <a className="cav3-primary" href="/admin">Open existing operational admin ↗</a>
        </div>}
      </main>
    </div>
    <nav className="cav3-bottom-nav" aria-label="Mobile admin navigation">
      {nav("overview", "Home", "▦", true)}{nav("orders", "Orders", "▤", true)}
      {nav("products", "Products", "◇", true)}{nav("inventory", "Stock", "▥", true)}
      <button type="button" className={"cav3-bottom-item" + (moreOpen ? " is-current" : "")}
        aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}><span className="cav3-nav-icon">☰</span><span>More</span></button>
    </nav>
    {moreOpen && <div className="cav3-more" role="dialog" aria-label="More admin sections"><h2>More sections</h2>
      {groups.flatMap((g) => g.views).filter((v) => !["overview", "orders", "products", "inventory"].includes(v.id))
        .map((v) => nav(v.id, v.label, v.icon))}
      <a href="/admin">Existing admin ↗</a><button type="button" disabled={busyLogout} onClick={() => void logout()}>Log out</button>
    </div>}
  </div>
}
