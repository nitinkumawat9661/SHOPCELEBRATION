"use client"

import { useMemo, useState } from "react"
import type { AdminOrderFilterId } from "../../config/admin-orders"
import { formatMoney } from "../../lib/domain/catalog"
import { uiContent } from "../../lib/domain/content"
import { AdminCampaigns } from "./AdminCampaigns"
import { AdminConversionAnalytics } from "./AdminConversionAnalytics"
import { AdminCatalogHistory } from "./AdminCatalogHistory"
import { AdminCatalogManager, type CatalogAdminSection } from "./AdminCatalogManager"
import { AdminCustomRequests } from "./AdminCustomRequests"
import { AdminOrderCard } from "./AdminOrderCard"
import { AdminOrderToolbar } from "./AdminOrderToolbar"
import { AdminStoreSettings } from "./AdminStoreSettings"
import { countAdminFilter, defaultAdminOrderFilter, filterAdminOrders, type AdminOrderSort } from "./orderFilters"
import { useAdminOrders } from "./useAdminOrders"

type AdminView = "overview" | "orders" | "requests" | CatalogAdminSection | "campaigns" | "analytics" | "settings" | "history"

const navItems: { id: AdminView; label: string; short: string }[] = [
  { id: "overview", label: "Overview", short: "Home" },
  { id: "orders", label: "Orders", short: "Orders" },
  { id: "requests", label: "Custom Requests", short: "Requests" },
  { id: "campaigns", label: "Offers", short: "Offers" },
  { id: "analytics", label: "Analytics", short: "Analytics" },
  { id: "tiers", label: "Hampers", short: "Hampers" },
  { id: "products", label: "Products", short: "Products" },
  { id: "occasions", label: "Occasions", short: "Occasions" },
  { id: "settings", label: "Store Settings", short: "Settings" },
  { id: "history", label: "Change History", short: "History" }
]

const viewCopy: Record<AdminView, { kicker: string; title: string; body: string }> = {
  overview: { kicker: "CONTROL CENTER", title: "Aaj kya attention chahiye?", body: "Orders, requests aur store configuration ka clean operational view." },
  orders: { kicker: "ORDERS", title: "Order operations", body: "Payment se delivery tak har active order ka next action yahin se manage karein." },
  requests: { kicker: "CUSTOM REQUESTS", title: "Budget request queue", body: "Apne-budget requests ko quickly search, WhatsApp aur close karein." },
  campaigns: { kicker: "OFFERS", title: "Automatic campaigns", body: "Genuine discounts, eligibility, timing aur usage limits bina deploy ke control karein." },
  analytics: { kicker: "ANALYTICS", title: "Conversion & offer performance", body: "Tracked funnel, checkout rate, campaign redemption aur real order-value impact dekhein." },
  tiers: { kicker: "CATALOG", title: "Hampers & budgets", body: "Price tiers, sizes aur selection limits without code deploy manage karein." },
  products: { kicker: "CATALOG", title: "Products & objects", body: "Items, images, categories, eligibility aur display order manage karein." },
  occasions: { kicker: "CATALOG", title: "Occasions & defaults", body: "Builder ke occasions aur default selections control karein." },
  settings: { kicker: "STORE SETTINGS", title: "Support & convenience", body: "Top helper strip aur WhatsApp support ko runtime par update karein." },
  history: { kicker: "SAFETY", title: "Catalog change history", body: "Published versions dekhein aur zarurat par one-click restore karein." }
}

export function AdminDashboard() {
  const admin = useAdminOrders()
  const copy = uiContent.admin
  const [view, setView] = useState<AdminView>("overview")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<AdminOrderFilterId>(defaultAdminOrderFilter)
  const [sort, setSort] = useState<AdminOrderSort>("newest")

  const visibleOrders = useMemo(() => filterAdminOrders(admin.orders, filter, search, sort), [admin.orders, filter, search, sort])
  const counts = useMemo(() => ({
    active: countAdminFilter(admin.orders, "active"),
    payment: countAdminFilter(admin.orders, "payment"),
    packing: countAdminFilter(admin.orders, "packing"),
    approval: countAdminFilter(admin.orders, "approval"),
    shipping: countAdminFilter(admin.orders, "shipping"),
    issues: countAdminFilter(admin.orders, "issues"),
    closed: countAdminFilter(admin.orders, "closed"),
    all: countAdminFilter(admin.orders, "all")
  }), [admin.orders])

  const orderValue = useMemo(() => admin.orders.reduce((sum, order) => sum + order.amountPaise, 0) / 100, [admin.orders])
  const totalDiscount = useMemo(() => admin.orders.reduce((sum, order) => sum + (order.discountPaise || 0), 0) / 100, [admin.orders])
  const recentOrders = admin.orders.slice(0, 4)
  const activeView = viewCopy[view]

  function openOrders(nextFilter: AdminOrderFilterId = "active") {
    setFilter(nextFilter)
    setSearch("")
    setView("orders")
  }

  return (
    <div className="adminV2Shell">
      <aside className="adminSidebar" aria-label="Admin navigation">
        <div className="adminSidebarBrand"><span>Celebration</span><b>Admin</b></div>
        <nav>{navItems.map((item) => <button type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.label}</span></button>)}</nav>
        <div className="adminSidebarBottom"><button type="button" className="secondary" onClick={admin.logout}>Logout</button></div>
      </aside>

      <div className="adminMain">
        <div className="adminMobileNav" aria-label="Admin sections">{navItems.map((item) => <button type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.short}</button>)}</div>

        <header className="adminV2Topbar">
          <div><div className="kicker">{activeView.kicker}</div><h1>{activeView.title}</h1><p>{activeView.body}</p></div>
          <div className="adminActions"><button className="secondary" onClick={admin.load} disabled={admin.loading}>{admin.loading ? "Refreshing…" : copy.refresh}</button><button className="secondary adminDesktopLogout" onClick={admin.logout}>{copy.logout}</button></div>
        </header>

        {admin.notice && <div className="successBox adminFeedback">{admin.notice}</div>}
        {admin.error && <div className="errorBox adminFeedback">{admin.error}</div>}

        {view === "overview" && <section className="adminOverview">
          <div className="adminKpiGrid">
            <button type="button" onClick={() => openOrders("active")}><span>Active orders</span><b>{counts.active}</b><small>Action pending</small></button>
            <button type="button" onClick={() => openOrders("payment")}><span>Payment check</span><b>{counts.payment}</b><small>Verify UPI / bank</small></button>
            <button type="button" onClick={() => openOrders("packing")}><span>Packing</span><b>{counts.packing}</b><small>Prepare / video</small></button>
            <button type="button" onClick={() => openOrders("approval")}><span>Approval</span><b>{counts.approval}</b><small>Customer decision</small></button>
            <button type="button" onClick={() => openOrders("shipping")}><span>Shipping</span><b>{counts.shipping}</b><small>Courier / delivery</small></button>
            <button type="button" className={counts.issues ? "attention" : ""} onClick={() => openOrders("issues")}><span>Issues</span><b>{counts.issues}</b><small>Needs resolution</small></button>
          </div>

          <div className="adminOverviewSplit">
            <section className="adminWorkspaceCard adminOverviewCard">
              <div className="adminWorkspaceHead"><div><div className="kicker">BUSINESS SNAPSHOT</div><h2>Order summary</h2></div><button className="secondary" type="button" onClick={() => openOrders("all")}>All orders</button></div>
              <div className="adminOverviewStats"><div><span>Total orders</span><b>{counts.all}</b></div><div><span>Submitted value</span><b>{formatMoney(orderValue)}</b></div><div><span>Offer discount</span><b>{formatMoney(totalDiscount)}</b></div></div>
              <p className="adminMetricNote">Submitted value includes current order records; verified revenue should still follow your payment verification status.</p>
            </section>

            <section className="adminWorkspaceCard adminQuickActions">
              <div className="kicker">QUICK ACTIONS</div><h2>Common kaam</h2>
              <div><button type="button" onClick={() => setView("campaigns")}>Offer / discount campaign</button><button type="button" onClick={() => setView("analytics")}>Conversion analytics</button><button type="button" onClick={() => setView("products")}>+ Product / image manage karein</button><button type="button" onClick={() => setView("tiers")}>Hamper pricing update karein</button><button type="button" onClick={() => setView("requests")}>Budget requests dekhein</button><button type="button" onClick={() => setView("history")}>Catalog history / rollback</button></div>
            </section>
          </div>

          <section className="adminWorkspaceCard">
            <div className="adminWorkspaceHead"><div><div className="kicker">RECENT</div><h2>Latest orders</h2><p>Recent activity ka quick view.</p></div><button className="secondary" type="button" onClick={() => openOrders("active")}>Order workspace</button></div>
            {admin.loading && <div className="trackingState">Orders load ho rahe hain…</div>}
            {!admin.loading && recentOrders.length === 0 && <div className="trackingState">Abhi koi order nahi hai.</div>}
            <div className="adminRecentOrders">{recentOrders.map((order) => <button key={order.publicId} type="button" onClick={() => { setSearch(order.publicId); setFilter("all"); setView("orders") }}><div><b>{order.publicId}</b><span>{order.customerName} • {order.tierName}</span></div><div><strong>{formatMoney(order.amountPaise / 100)}</strong><small>{order.discountPaise > 0 ? `${formatMoney(order.discountPaise / 100)} saved • ` : ""}{order.status.replaceAll("_", " ")}</small></div></button>)}</div>
          </section>
        </section>}

        {view === "orders" && <section className="adminOrdersSection adminWorkspaceCard">
          <AdminOrderToolbar search={search} filter={filter} sort={sort} total={admin.orders.length} visible={visibleOrders.length} counts={counts} onSearch={setSearch} onFilter={setFilter} onSort={setSort} />
          {admin.loading && <div className="trackingState">{uiContent.admin.loadingIndicator}</div>}
          {!admin.loading && visibleOrders.length === 0 && <div className="trackingState">{search ? copy.noMatchingOrders : copy.noOrders}</div>}
          <div className="adminOrderList">{visibleOrders.map((order) => <AdminOrderCard key={order.publicId} order={order} busy={admin.busy === order.publicId} onStatus={(status) => admin.updateStatus(order, status)} onShipping={(provider, trackingNumber) => admin.saveShipping(order, provider, trackingNumber)} onVideo={(file) => admin.uploadVideo(order, file)} />)}</div>
        </section>}

        {view === "requests" && <AdminCustomRequests />}
        {view === "campaigns" && <AdminCampaigns />}
        {view === "analytics" && <AdminConversionAnalytics />}
        {(view === "tiers" || view === "products" || view === "occasions") && <AdminCatalogManager section={view} />}
        {view === "settings" && <AdminStoreSettings />}
        {view === "history" && <AdminCatalogHistory />}
      </div>
    </div>
  )
}
