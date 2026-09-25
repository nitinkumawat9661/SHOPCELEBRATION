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

type AdminNavItem = { id: AdminView; label: string; helper: string }
type AdminNavGroup = { label: string; items: AdminNavItem[] }

const navGroups: AdminNavGroup[] = [
  {
    label: "Operations",
    items: [
      { id: "overview", label: "Overview", helper: "Daily control center" },
      { id: "orders", label: "Orders", helper: "Payment to delivery" },
      { id: "requests", label: "Custom Requests", helper: "Budget enquiries" }
    ]
  },
  {
    label: "Sales & Insights",
    items: [
      { id: "campaigns", label: "Offers", helper: "Discount campaigns" },
      { id: "analytics", label: "Analytics", helper: "Conversion performance" }
    ]
  },
  {
    label: "Catalog",
    items: [
      { id: "tiers", label: "Hampers & Pricing", helper: "Budgets and limits" },
      { id: "products", label: "Products", helper: "Items and images" },
      { id: "occasions", label: "Occasions", helper: "Builder defaults" }
    ]
  },
  {
    label: "System",
    items: [
      { id: "settings", label: "Store Settings", helper: "Support and helper strip" },
      { id: "history", label: "Change History", helper: "Rollback catalog versions" }
    ]
  }
]

const navItems = navGroups.flatMap((group) => group.items)

const viewCopy: Record<AdminView, { kicker: string; title: string; body: string }> = {
  overview: { kicker: "CONTROL CENTER", title: "Business overview", body: "Aaj ke orders, pending actions aur store health ko ek jagah se control karein." },
  orders: { kicker: "OPERATIONS", title: "Order operations", body: "Payment se delivery tak har active order ka next action manage karein." },
  requests: { kicker: "OPERATIONS", title: "Custom request queue", body: "Budget requests ko search, contact aur close karein." },
  campaigns: { kicker: "SALES", title: "Offers & campaigns", body: "Discount rules, eligibility, timing aur usage limits bina deploy ke control karein." },
  analytics: { kicker: "INSIGHTS", title: "Conversion analytics", body: "Funnel, checkout, campaign redemption aur order-value impact dekhein." },
  tiers: { kicker: "CATALOG", title: "Hampers & pricing", body: "Price tiers, sizes aur selection limits without code deploy manage karein." },
  products: { kicker: "CATALOG", title: "Products & items", body: "Items, images, categories, eligibility aur display order manage karein." },
  occasions: { kicker: "CATALOG", title: "Occasions & defaults", body: "Builder occasions aur default selections control karein." },
  settings: { kicker: "SYSTEM", title: "Store settings", body: "Support details aur storefront helper content runtime par update karein." },
  history: { kicker: "SYSTEM", title: "Change history", body: "Published catalog versions dekhein aur zarurat par restore karein." }
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
  const activeGroup = navGroups.find((group) => group.items.some((item) => item.id === view))?.label ?? "Admin"
  const activeNavItem = navItems.find((item) => item.id === view)

  function openOrders(nextFilter: AdminOrderFilterId = "active") {
    setFilter(nextFilter)
    setSearch("")
    setView("orders")
  }

  return (
    <div className="adminV2Shell">
      <aside className="adminSidebar" aria-label="Admin navigation">
        <div className="adminSidebarBrand">
          <span>Celebration</span>
          <b>Admin workspace</b>
        </div>

        <nav className="adminGroupedNav">
          {navGroups.map((group) => (
            <section className="adminNavGroup" key={group.label} aria-label={group.label}>
              <div className="adminNavGroupLabel">{group.label}</div>
              <div className="adminNavGroupItems">
                {group.items.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={view === item.id ? "adminNavButton active" : "adminNavButton"}
                    onClick={() => setView(item.id)}
                  >
                    <span>
                      <b>{item.label}</b>
                      <small>{item.helper}</small>
                    </span>
                    {item.id === "orders" && counts.active > 0 && <em>{counts.active}</em>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="adminSidebarBottom">
          <a className="adminStoreLink" href="/" target="_blank" rel="noreferrer">View storefront <span>↗</span></a>
          <button type="button" className="secondary" onClick={admin.logout}>Logout</button>
        </div>
      </aside>

      <div className="adminMain">
        <div className="adminMobileSectionPicker">
          <label htmlFor="admin-section">Admin section</label>
          <select id="admin-section" value={view} onChange={(event) => setView(event.target.value as AdminView)}>
            {navGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </optgroup>
            ))}
          </select>
          <a href="/" target="_blank" rel="noreferrer" aria-label="Open storefront">Store ↗</a>
        </div>

        <header className="adminV2Topbar">
          <div>
            <div className="adminBreadcrumb"><span>Admin</span><i>/</i><span>{activeGroup}</span><i>/</i><strong>{activeNavItem?.label}</strong></div>
            <div className="kicker">{activeView.kicker}</div>
            <h1>{activeView.title}</h1>
            <p>{activeView.body}</p>
          </div>
          <div className="adminActions">
            <button className="secondary" onClick={admin.load} disabled={admin.loading}>{admin.loading ? "Refreshing…" : copy.refresh}</button>
            <a className="secondary adminViewStoreButton" href="/" target="_blank" rel="noreferrer">View store</a>
            <button className="secondary adminDesktopLogout" onClick={admin.logout}>{copy.logout}</button>
          </div>
        </header>

        {admin.notice && <div className="successBox adminFeedback">{admin.notice}</div>}
        {admin.error && <div className="errorBox adminFeedback">{admin.error}</div>}

        {view === "overview" && <section className="adminOverview">
          <section className="adminPriorityBlock">
            <div className="adminPriorityHead">
              <div><div className="kicker">TODAY'S WORK</div><h2>Order pipeline</h2><p>Pending work ko status ke hisaab se open karein.</p></div>
              <button type="button" className="secondary" onClick={() => openOrders("active")}>Open active orders</button>
            </div>
            <div className="adminKpiGrid">
              <button type="button" onClick={() => openOrders("active")}><span>Active orders</span><b>{counts.active}</b><small>Action pending</small></button>
              <button type="button" onClick={() => openOrders("payment")}><span>Payment check</span><b>{counts.payment}</b><small>Verify UPI / bank</small></button>
              <button type="button" onClick={() => openOrders("packing")}><span>Packing</span><b>{counts.packing}</b><small>Prepare / video</small></button>
              <button type="button" onClick={() => openOrders("approval")}><span>Approval</span><b>{counts.approval}</b><small>Customer decision</small></button>
              <button type="button" onClick={() => openOrders("shipping")}><span>Shipping</span><b>{counts.shipping}</b><small>Courier / delivery</small></button>
              <button type="button" className={counts.issues ? "attention" : ""} onClick={() => openOrders("issues")}><span>Issues</span><b>{counts.issues}</b><small>Needs resolution</small></button>
            </div>
          </section>

          <div className="adminOverviewSplit">
            <section className="adminWorkspaceCard adminOverviewCard">
              <div className="adminWorkspaceHead"><div><div className="kicker">BUSINESS SNAPSHOT</div><h2>Order summary</h2></div><button className="secondary" type="button" onClick={() => openOrders("all")}>All orders</button></div>
              <div className="adminOverviewStats"><div><span>Total orders</span><b>{counts.all}</b></div><div><span>Submitted value</span><b>{formatMoney(orderValue)}</b></div><div><span>Offer discount</span><b>{formatMoney(totalDiscount)}</b></div></div>
              <p className="adminMetricNote">Submitted value includes current order records; verified revenue should still follow payment verification status.</p>
            </section>

            <section className="adminWorkspaceCard adminQuickActions">
              <div className="kicker">QUICK ACTIONS</div><h2>Common tasks</h2>
              <div>
                <button type="button" onClick={() => setView("products")}><b>Products</b><span>Add items or update images</span></button>
                <button type="button" onClick={() => setView("tiers")}><b>Hamper pricing</b><span>Update budgets and limits</span></button>
                <button type="button" onClick={() => setView("campaigns")}><b>Offers</b><span>Create or manage discounts</span></button>
                <button type="button" onClick={() => setView("requests")}><b>Custom requests</b><span>Review budget enquiries</span></button>
                <button type="button" onClick={() => setView("analytics")}><b>Analytics</b><span>Check conversion performance</span></button>
                <button type="button" onClick={() => setView("history")}><b>Change history</b><span>Review or restore catalog</span></button>
              </div>
            </section>
          </div>

          <section className="adminWorkspaceCard">
            <div className="adminWorkspaceHead"><div><div className="kicker">RECENT ACTIVITY</div><h2>Latest orders</h2><p>Recent orders ka quick operational view.</p></div><button className="secondary" type="button" onClick={() => openOrders("active")}>Order workspace</button></div>
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
