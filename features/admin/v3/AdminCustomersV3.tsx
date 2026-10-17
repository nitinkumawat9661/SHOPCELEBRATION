"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { formatMoney, type CatalogConfig } from "../../../lib/domain/catalog"
import type { DeliveryAddress } from "../../../lib/domain/delivery-address"

type Customer = {
  id: string
  displayName: string
  maskedPhone: string
  status: "active" | "disabled"
  phoneVerified: boolean
  hasSavedAddress: boolean
  createdAt: string | null
  lastLoginAt: string | null
  totalLinkedOrders: number
  paidOrders: number
  paidOrderValuePaise: number
  reportedIssueOrders: number
  lastOrderAt: string | null
  wishlistCount: number
}
type CustomerOrder = {
  publicId: string
  orderType: "individual" | "hamper"
  tierName: string
  amountPaise: number
  status: string
  paymentStatus: string
  hasReportedIssue: boolean
  createdAt: string | null
}
type SavedProduct = { productId: string; savedAt: string | null }
type DirectoryResponse = { ok: boolean; customers?: Customer[]; page?: number; total?: number; pageSize?: number; error?: string }
type DetailResponse = {
  ok: boolean
  customer?: Customer
  orders?: CustomerOrder[]
  savedProducts?: SavedProduct[]
  savedAddress?: DeliveryAddress | null
  error?: string
}
type DetailView = "overview" | "orders" | "wishlist" | "activity"
const money = (paise: number) => formatMoney(paise / 100)
function displayDate(value: string | null) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Not recorded"
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata"
  }).format(date)
}
function AccountStatus({ customer }: { customer: Customer }) {
  return <span className={"cav3-customer-status " + (customer.status === "active" ? "is-active" : "is-disabled")}>
    {customer.status === "active" ? "Active" : "Disabled"}
  </span>
}
function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <div className="cav3-customer-metric"><span>{label}</span><b>{value}</b><small>{note}</small></div>
}
function Labeled({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="cav3-customer-fact"><dt>{label}</dt><dd>{value}</dd></div>
}

/**
 * Admin-only, read-only customer directory.
 * Account association uses orders.customer_account_id, never matching phones
 * of guest orders or separately-entered gift receivers.
 */
export function AdminCustomersV3({ catalog, onOpenOrder }: {
  catalog: CatalogConfig | null
  onOpenOrder: (publicId: string) => void
}) {
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [status, setStatus] = useState<"all" | "active" | "disabled">("all")
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [list, setList] = useState<Customer[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [size, setSize] = useState(25)
  const [listBusy, setListBusy] = useState(true)
  const [listError, setListError] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<DetailResponse | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [detailTab, setDetailTab] = useState<DetailView>("overview")
  const [address, setAddress] = useState<DeliveryAddress | null>(null)
  const [addressVisible, setAddressVisible] = useState(false)
  const [addressBusy, setAddressBusy] = useState(false)
  const [addressError, setAddressError] = useState("")
  const addressAbort = useRef<AbortController | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()
    setListBusy(true)
    setListError("")
    const params = new URLSearchParams({ search: debounced, status, page: String(page) })
    void (async () => {
      try {
        const response = await fetch("/api/admin/customers?" + params, {
          cache: "no-store", credentials: "same-origin", signal: controller.signal
        })
        const data = await response.json() as DirectoryResponse
        if (!response.ok || !data.ok || !Array.isArray(data.customers) ||
            typeof data.total !== "number" || typeof data.pageSize !== "number") {
          throw new Error(data.error || "CUSTOMER_DIRECTORY_UNAVAILABLE")
        }
        if (!controller.signal.aborted) {
          setList(data.customers)
          setCount(data.total)
          setSize(data.pageSize)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setList([])
          setCount(null)
          setListError(error instanceof Error ? error.message : "Unable to load customers")
        }
      } finally { if (!controller.signal.aborted) setListBusy(false) }
    })()
    return () => controller.abort()
  }, [debounced, status, page, revision])

  useEffect(() => {
    addressAbort.current?.abort()
    setAddressVisible(false)
    setAddress(null)
    setAddressError("")
    if (!selectedId) { setSelected(null); setDetailBusy(false); return }
    const controller = new AbortController()
    setSelected(null)
    setDetailBusy(true)
    setDetailError("")
    void (async () => {
      try {
        const response = await fetch("/api/admin/customers/" + encodeURIComponent(selectedId), {
          cache: "no-store", credentials: "same-origin", signal: controller.signal
        })
        const result = await response.json() as DetailResponse
        if (!response.ok || !result.ok || !result.customer ||
            !Array.isArray(result.orders) || !Array.isArray(result.savedProducts)) {
          throw Error(result.error || "CUSTOMER_DETAIL_UNAVAILABLE")
        }
        if (!controller.signal.aborted) setSelected(result)
      } catch (error) {
        if (!controller.signal.aborted) setDetailError(
          error instanceof Error ? error.message : "Unable to load customer record")
      } finally { if (!controller.signal.aborted) setDetailBusy(false) }
    })()
    return () => { controller.abort(); addressAbort.current?.abort() }
  }, [selectedId, revision])

  async function revealAddress() {
    if (!selectedId || !selected?.customer?.hasSavedAddress) return
    addressAbort.current?.abort()
    const controller = new AbortController()
    addressAbort.current = controller
    setAddressBusy(true)
    setAddressError("")
    try {
      const response = await fetch(
        "/api/admin/customers/" + encodeURIComponent(selectedId) + "?address=1", {
          cache: "no-store", credentials: "same-origin", signal: controller.signal
        })
      const result = await response.json() as DetailResponse
      if (!response.ok || !result.ok || result.customer?.id !== selectedId ||
          !Object.prototype.hasOwnProperty.call(result, "savedAddress")) {
        throw Error(result.error || "ADDRESS_REVEAL_UNAVAILABLE")
      }
      if (!controller.signal.aborted) {
        setAddress(result.savedAddress || null)
        setAddressVisible(true)
      }
    } catch (error) {
      if (!controller.signal.aborted) setAddressError(
        error instanceof Error ? error.message : "Saved address unavailable")
    } finally { if (!controller.signal.aborted) setAddressBusy(false) }
  }

  const selectedCustomer = selected?.customer
  const catalogNames = useMemo(() => new Map(catalog?.products.map(item => [item.id, item.name]) || []), [catalog])
  const totalPages = count === null ? 0 : Math.ceil(count / size)
  const shown = selectedCustomer ? selectedCustomer : null

  return <section className="cav3-customers" aria-label="Customers administration">
    <div className="cav3-customer-notice" role="note">
      <b>Registered accounts only.</b> Order history is linked by verified account ID, not by a matching phone number.
      Gift recipients and guest purchasers are not merged into a customer profile. Guest browser carts and saved
      product lists are not available here. All details are read-only and access-controlled.
    </div>
    {selectedId ? <>
      <button type="button" className="cav3-detail-back" onClick={() => {
        addressAbort.current?.abort()
        setSelectedId(null)
        setDetailTab("overview")
        setAddressVisible(false)
        setAddress(null)
      }}>← Back to customers</button>
      {detailBusy && <p className="cav3-state" role="status">Loading linked account details…</p>}
      {detailError && <p className="cav3-error" role="alert">{detailError}
        <button type="button" onClick={() => setRevision(v => v + 1)}>Retry</button></p>}
      {shown && <div className="cav3-customer-detail">
        <div className="cav3-customer-head">
          <div><span className="cav3-eyebrow">Registered customer · {shown.id}</span><h2>{shown.displayName}</h2>
            <div className="cav3-customer-sub"><span>{shown.maskedPhone}</span><AccountStatus customer={shown} />
              <span>{shown.phoneVerified ? "Phone verified" : "Phone not verified"}</span></div>
          </div>
          <button type="button" onClick={() => setRevision(v => v + 1)}>Refresh customer</button>
        </div>
        <div className="cav3-customer-metrics">
          <Metric label="Linked orders" value={shown.totalLinkedOrders} note="Account-linked, including unpaid" />
          <Metric label="Paid orders" value={shown.paidOrders} note="Verified/paid and not cancelled" />
          <Metric label="Paid-order value" value={money(shown.paidOrderValuePaise)} note="Recorded value, before refunds" />
          <Metric label="Saved products" value={shown.wishlistCount} note="Account-backed wishlist only" />
        </div>
        <div className="cav3-customer-tabs" role="group" aria-label="Customer profile sections">
          {(["overview", "orders", "wishlist", "activity"] as DetailView[]).map(tab =>
            <button type="button" key={tab} className={detailTab === tab ? "is-selected" : ""}
              aria-pressed={detailTab === tab} onClick={() => setDetailTab(tab)}>
              {tab === "overview" ? "Profile & Address" : tab === "orders" ? "Orders" :
                tab === "wishlist" ? "Saved Products" : "Activity"}</button>)}
        </div>
        {detailTab === "overview" && <div className="cav3-customer-profile-columns">
          <div className="cav3-panel cav3-customer-block">
            <div className="cav3-panel-head"><h2>Account profile</h2></div>
            <dl><Labeled label="Name" value={shown.displayName} />
              <Labeled label="Contact" value={shown.maskedPhone} />
              <Labeled label="Status" value={shown.status} />
              <Labeled label="Phone verified" value={shown.phoneVerified ? "Yes" : "No"} />
              <Labeled label="Registered" value={displayDate(shown.createdAt)} />
              <Labeled label="Last login" value={displayDate(shown.lastLoginAt)} />
              <Labeled label="Last order" value={displayDate(shown.lastOrderAt)} /></dl>
          </div>
          <div className="cav3-panel cav3-customer-block">
            <div className="cav3-panel-head"><h2>Saved default address</h2></div>
            <div className="cav3-customer-address">
              {!shown.hasSavedAddress ? <p>No saved default address on this account.</p>
                : !addressVisible ? <><p>Address exists. Full delivery details are hidden until explicitly requested.</p>
                    <button type="button" onClick={() => void revealAddress()} disabled={addressBusy}>
                      {addressBusy ? "Loading…" : "Reveal saved address"}</button></>
                : <><dl><Labeled label="Recipient" value={address?.receiverName || "Not recorded"} />
                    <Labeled label="Address" value={address?.address || "Not recorded"} />
                    <Labeled label="City" value={address?.city || "Not recorded"} />
                    <Labeled label="State" value={address?.state || "Not recorded"} />
                    <Labeled label="Pincode" value={address?.pincode || "Not recorded"} /></dl>
                    <button type="button" onClick={() => { setAddressVisible(false); setAddress(null) }}>Hide address</button></>}
              {addressError && <p role="alert" className="cav3-error">{addressError}</p>}
              <small>This is the account's saved default, not necessarily the address on any historical order.</small>
            </div>
          </div>
        </div>}
        {detailTab === "orders" && <div className="cav3-panel">
          <div className="cav3-panel-head"><h2>Account-linked order history</h2>
            <span className="cav3-quiet">Latest {selected?.orders?.length || 0} of {shown.totalLinkedOrders}</span></div>
          {selected?.orders?.length ? selected.orders.map(order =>
            <div className="cav3-customer-order" key={order.publicId}>
              <div><b>{order.publicId}</b><small>{order.orderType === "hamper" ? "Hamper · " + order.tierName : "Jewellery"} · {displayDate(order.createdAt)}</small></div>
              <div><b>{money(order.amountPaise)}</b><small>{order.paymentStatus.replaceAll("_", " ")}</small></div>
              <div><b>{order.status.replaceAll("_", " ")}</b>
                {order.hasReportedIssue && <small>Issue reported on this order</small>}</div>
              <button type="button" onClick={() => onOpenOrder(order.publicId)}>View order →</button>
            </div>) : <p className="cav3-state">This registered account has no linked orders.</p>}
          {shown.totalLinkedOrders > (selected?.orders?.length || 0) &&
            <p className="cav3-state">Showing the latest 50 only; use the operational Orders workspace for historical records.</p>}
        </div>}
        {detailTab === "wishlist" && <div className="cav3-panel">
          <div className="cav3-panel-head"><h2>Account wishlist</h2><span className="cav3-quiet">{shown.wishlistCount} saved product IDs</span></div>
          {selected?.savedProducts?.length ? selected.savedProducts.map(item =>
            <div className="cav3-customer-wishlist-row" key={item.productId}>
              <span><b>{catalogNames.get(item.productId) || "Product not in current catalog"}</b>
                <small>SKU: {item.productId} · Saved {displayDate(item.savedAt)}</small></span>
              <small>{catalogNames.has(item.productId) ? "Current catalog name" : "Archived or unavailable"}</small>
            </div>) : <p className="cav3-state">No account-synced saved products.</p>}
          <p className="cav3-customer-footnote">Guest favourites exist only in their browsers; this report cannot see them. Current product names are not historical purchase snapshots.</p>
        </div>}
        {detailTab === "activity" && <div className="cav3-panel">
          <div className="cav3-panel-head"><h2>Recorded account milestones</h2></div>
          <dl className="cav3-customer-activity">
            <Labeled label="Created" value={displayDate(shown.createdAt)} />
            <Labeled label="Last recorded login" value={displayDate(shown.lastLoginAt)} />
            <Labeled label="Most recent linked order" value={displayDate(shown.lastOrderAt)} />
            <Labeled label="Orders with an issue field" value={shown.reportedIssueOrders} />
          </dl>
          <p className="cav3-customer-footnote">No inferred browsing timeline, guest cart history, marketing consent, customer notes or support messages are being fabricated.</p>
        </div>}
      </div>}
    </> : <>
      <div className="cav3-customer-top"><div className="cav3-customer-list-summary">
        <Metric label="Matching registered accounts" value={count === null ? "—" : count} note="Exact account records, not guest checkouts" />
        <Metric label="Shown on this page" value={listBusy ? "—" : list.length} note={"Page " + page + (totalPages ? " / " + totalPages : "")} />
      </div><button type="button" onClick={() => setRevision(v => v + 1)}>Refresh</button></div>
      <div className="cav3-customer-filters">
        <input type="search" value={query} maxLength={80} aria-label="Search registered customers"
          onChange={event => { setQuery(event.target.value); setPage(1) }}
          placeholder="Search customer name or exact 10-digit account phone" />
        <select value={status} aria-label="Customer account status"
          onChange={event => { setStatus(event.target.value as typeof status); setPage(1) }}>
          <option value="all">All account statuses</option>
          <option value="active">Active accounts</option><option value="disabled">Disabled accounts</option>
        </select>
      </div>
      {listError && <p className="cav3-error" role="alert">{listError}
        <button type="button" onClick={() => setRevision(v => v + 1)}>Retry</button></p>}
      <div className="cav3-panel">
        <div className="cav3-panel-head"><h2>Registered customers</h2>
          <span className="cav3-quiet">{listBusy ? "Loading…" : "Most recent registrations first"}</span></div>
        {listBusy && <p className="cav3-state" role="status">Loading registered customer directory…</p>}
        {!listBusy && !listError && !list.length && <p className="cav3-state">No accounts match this search.</p>}
        {!listBusy && list.map(customer => <button type="button" key={customer.id}
          className="cav3-customer-list-row" onClick={() => { setSelectedId(customer.id); setDetailTab("overview") }}>
          <div className="cav3-customer-identity"><span className="cav3-customer-avatar">{customer.displayName.slice(0, 1).toUpperCase()}</span>
            <span><b>{customer.displayName}</b><small>{customer.maskedPhone} · Joined {displayDate(customer.createdAt)}</small></span></div>
          <div><b>{customer.paidOrders} paid</b><small>{customer.totalLinkedOrders} linked orders</small></div>
          <div><b>{money(customer.paidOrderValuePaise)}</b><small>Before refunds</small></div>
          <div><b>{customer.wishlistCount} saved</b><small>Account wishlist</small></div>
          <AccountStatus customer={customer} />
          <span className="cav3-customer-arrow" aria-hidden="true">→</span>
        </button>)}
      </div>
      {count !== null && count > size && <nav className="cav3-customer-pagination" aria-label="Customer directory pages">
        <button type="button" disabled={page <= 1 || listBusy} onClick={() => setPage(v => v - 1)}>← Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" disabled={page >= totalPages || page >= 100 || listBusy}
          onClick={() => setPage(v => v + 1)}>Next →</button>
      </nav>}
      <p className="cav3-customer-footnote">Names and phone numbers come only from registered accounts. Search matches the account name or an exact 10-digit registered phone; partial phone enumeration is not supported. Paid value excludes cancelled orders, but does not subtract refunds.</p>
    </>}
  </section>
}
