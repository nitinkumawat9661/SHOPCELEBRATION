"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { catalogImageVariant, primaryProductImage, type CatalogConfig, type GiftProduct } from "../../../lib/domain/catalog"
import { nextAvailableStock, type AdjustmentMode } from "../../../lib/domain/admin-stock-adjustment"

type Adjustment = {
  id: string
  productId: string
  mode: AdjustmentMode
  quantity: number
  expectedAvailable: number
  previousAvailable: number
  availableQuantity: number
  delta: number
  reason: string
  createdAt: string
  replayed?: boolean
}

type Reservation = {
  publicId: string
  paymentStatus: string
  orderStatus: string
  quantity: number
  productCount: number
  expiresAt: string
  review: "active" | "payment_review" | "terminal_cleanup" | "paid_stock_review"
}

type ReservationReport = {
  items: Reservation[]
  active: number
  expiredPending: number
  anomalies: number
  moreResults: boolean
}

const OPTIONS: { id: "all" | "low" | "out" | "healthy"; label: string }[] = [
  { id: "all", label: "All" }, { id: "low", label: "Low stock" },
  { id: "out", label: "Out of stock" }, { id: "healthy", label: "In stock" }
]
const day = (date: string) => {
  const value = new Date(date)
  return Number.isNaN(value.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata"
  }).format(value)
}
function InventoryImage({ product }: { product: GiftProduct }) {
  const image = primaryProductImage(product)?.url
  return <div className="cav3-inv-image">
    {image ? <img src={catalogImageVariant(image, "thumb")} loading="lazy" alt="" referrerPolicy="no-referrer" />
      : <span>◇</span>}
  </div>
}

export function AdminInventoryV3({ catalog, catalogError, onRefresh, onOpenOrder, refreshToken }: {
  catalog: CatalogConfig | null
  catalogError: string
  onRefresh: () => void
  onOpenOrder: (publicId: string) => void
  refreshToken: number
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<(typeof OPTIONS)[number]["id"]>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<AdjustmentMode>("add")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [history, setHistory] = useState<Adjustment[] | null>(null)
  const [reservations, setReservations] = useState<ReservationReport | null>(null)
  const [reportsError, setReportsError] = useState("")
  const pendingRequest = useRef<{ key: string; requestId: string } | null>(null)

  const items = useMemo(() => catalog?.products.filter(p => p.active !== false &&
    p.sellIndividually === true && Number.isInteger(p.stockAvailable)) ?? [], [catalog])
  const selected = selectedId ? items.find(p => p.id === selectedId) : null
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter(p => {
      const stock = p.stockAvailable ?? 0
      const qualifies = filter === "all" || filter === "out" && stock === 0 ||
        filter === "low" && stock > 0 && stock <= 3 ||
        filter === "healthy" && stock > 3
      return qualifies && (!needle || (p.name + " " + p.id + " " + p.category).toLowerCase().includes(needle))
    })
  }, [items, query, filter])

  const totalAvailable = items.reduce((sum, p) => sum + (p.stockAvailable ?? 0), 0)
  const lowCount = items.filter(p => (p.stockAvailable ?? 0) > 0 && (p.stockAvailable ?? 0) <= 3).length
  const outCount = items.filter(p => p.stockAvailable === 0).length

  useEffect(() => {
    const controller = new AbortController()
    setReportsError("")
    setHistory(null)
    setReservations(null)
    void (async () => {
      try {
        const [historical, holds] = await Promise.all([
          fetch("/api/admin/inventory/adjustments?limit=40", { signal: controller.signal, cache: "no-store" }),
          fetch("/api/admin/reservations", { signal: controller.signal, cache: "no-store" })
        ])
        const historyResult = await historical.json() as { ok?: boolean; items?: Adjustment[] }
        const holdsResult = await holds.json() as ReservationReport & { ok?: boolean }
        if (!historical.ok || !historyResult.ok || !Array.isArray(historyResult.items) ||
            !holds.ok || !holdsResult.ok || !Array.isArray(holdsResult.items)) {
          throw new Error("Inventory audit or reservation review is unavailable.")
        }
        if (!controller.signal.aborted) {
          setHistory(historyResult.items)
          setReservations(holdsResult)
        }
      } catch {
        if (!controller.signal.aborted) setReportsError(
          "Inventory audit and reservation review could not be verified. Stock adjustments are disabled. Check staging migrations and retry."
        )
      }
    })()
    return () => controller.abort()
  }, [refreshToken])

  const inputValid = /^\d+$/.test(amount) && Number.isSafeInteger(Number(amount)) &&
    Number(amount) >= 0 && Number(amount) <= 10000
  const value = inputValid ? Number(amount) : NaN
  const previous = selected?.stockAvailable ?? NaN
  let next = NaN
  if (selected && inputValid) {
    try { next = nextAvailableStock(previous, mode, value) } catch { next = NaN }
  }
  const reasonable = Number.isInteger(next)
  const reasonClean = reason.trim().replace(/\s+/g, " ")
  const isReady = Boolean(selected && history && reservations && !busy && inputValid && reasonable &&
    reasonClean.length >= 4 && reasonClean.length <= 240)

  function chooseProduct(id: string) {
    if (busy) return
    setSelectedId(id)
    setMode("add")
    setAmount("")
    setReason("")
    setError("")
    setNotice("")
    pendingRequest.current = null
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !isReady) return
    const fingerprint = JSON.stringify([selected.id, previous, mode, value, reasonClean])
    if (!window.confirm(
      "CONFIRM AVAILABLE-STOCK CHANGE\n\nSKU: " + selected.id +
      "\nAvailable now: " + previous + "\nNew available: " + next +
      "\nChange: " + (next - previous) + "\nReason: " + reasonClean +
      "\n\nThis affects sellable stock immediately in this environment. Existing reservations are NOT released."
    )) return
    const requestId = pendingRequest.current?.key === fingerprint
      ? pendingRequest.current.requestId : crypto.randomUUID()
    pendingRequest.current = { key: fingerprint, requestId }
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/inventory/adjustments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId, productId: selected.id, mode, quantity: value, expectedAvailable: previous, reason: reasonClean
        })
      })
      const result = await response.json() as { ok?: boolean; adjustment?: Adjustment; error?: string }
      if (!response.ok || !result.ok || !result.adjustment) {
        if (response.status === 409) {
          pendingRequest.current = null
          throw new Error("Stock or shared request changed (" + (result.error || "CONFLICT") +
            "). Refresh inventory and verify before retrying.")
        }
        throw new Error(result.error || "STOCK_ADJUSTMENT_FAILED")
      }
      pendingRequest.current = null
      setNotice(result.adjustment.replayed
        ? "Previously submitted adjustment confirmed; stock was not changed again."
        : "Available stock adjustment recorded successfully. Updating the inventory view.")
      setAmount("")
      setReason("")
      onRefresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Stock adjustment failed. Verify the history before retrying.")
    } finally {
      setBusy(false)
    }
  }

  return <div className="cav3-inventory">
    {catalogError && <p className="cav3-error" role="alert">{catalogError}</p>}
    {reportsError && <p className="cav3-error" role="alert">{reportsError}</p>}
    {error && <p className="cav3-error" role="alert">{error}</p>}
    {notice && <p className="cav3-success" role="status">{notice}</p>}
    <p className="cav3-preview-notice">
      These are available-to-sell quantities, not measured physical inventory. Reservations have already reduced
      the displayed available stock. An expired pending-payment hold is NOT automatically releasable.
      The new adjustment workflow requires staging migration 109.
    </p>
    <div className="cav3-inventory-cards">
      <div><span>Tracked retail SKUs</span><b>{catalog ? items.length : "—"}</b><small>Active and individually sellable</small></div>
      <div><span>Available pieces</span><b>{catalog ? totalAvailable : "—"}</b><small>Sellable after reservations</small></div>
      <div><span>Low stock (1–3)</span><b>{catalog ? lowCount : "—"}</b><small>Needs replenishment review</small></div>
      <div><span>Out of stock</span><b>{catalog ? outCount : "—"}</b><small>0 available pieces</small></div>
    </div>
    <div className="cav3-inventory-columns">
      <section className="cav3-panel" aria-label="Available inventory list">
        <div className="cav3-panel-head"><h2>Available inventory</h2><span className="cav3-quiet">{catalog ? visible.length + " SKUs" : "Loading…"}</span></div>
        <div className="cav3-inv-filters">
          <input type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Search SKU, name, category…" aria-label="Search inventory" />
          <div className="cav3-chips">{OPTIONS.map(option =>
            <button key={option.id} type="button" onClick={() => setFilter(option.id)}
              aria-pressed={filter === option.id} className={filter === option.id ? "is-active" : ""}>{option.label}</button>)}</div>
        </div>
        {catalog && visible.length === 0 && <p className="cav3-state">No SKUs match this filter.</p>}
        {!catalog && <p className="cav3-state">Loading live inventory…</p>}
        <div className="cav3-inv-products">
          {visible.map(product => <button type="button" key={product.id}
            aria-pressed={product.id === selectedId}
            onClick={() => chooseProduct(product.id)}
            className={product.id === selectedId ? "is-selected" : ""}>
            <InventoryImage product={product} />
            <span className="cav3-inv-identity"><b>{product.name}</b><small>{product.id}</small></span>
            <span className={"cav3-inv-count " + (product.stockAvailable === 0 ? "is-out" :
              (product.stockAvailable ?? 0) <= 3 ? "is-low" : "")}>{product.stockAvailable} available</span>
          </button>)}
        </div>
      </section>

      <section className="cav3-panel cav3-inv-editor" aria-label="Audited stock adjustment">
        <div className="cav3-panel-head"><h2>Adjust available stock</h2></div>
        {selected ? <form onSubmit={event => void submit(event)}>
          <div className="cav3-inv-selected"><b>{selected.name}</b><small>{selected.id}</small></div>
          <div className="cav3-inv-preview"><span>Currently available</span><strong>{previous}</strong></div>
          <label>Adjustment mode
            <select value={mode} onChange={event => { setMode(event.target.value as AdjustmentMode); pendingRequest.current = null }}>
              <option value="add">Add to available (+)</option>
              <option value="remove">Remove from available (−)</option>
              <option value="set">Set absolute available</option>
            </select>
          </label>
          <label>{mode === "set" ? "New available quantity" : "Pieces to " + (mode === "add" ? "add" : "remove")}
            <input type="number" inputMode="numeric" min={0} max={10000} step={1}
              value={amount} onChange={event => { setAmount(event.target.value); pendingRequest.current = null }} placeholder="Enter whole pieces" />
          </label>
          <label>Reason (audit log)
            <input type="text" maxLength={240} value={reason}
              onChange={event => { setReason(event.target.value); pendingRequest.current = null }}
              placeholder="e.g. Supplier restock verified" />
          </label>
          <div className="cav3-inv-preview"><span>Available after change</span><strong>{reasonable ? next : "—"}</strong></div>
          <p className="cav3-detail-explainer">No inventory changes occur without explicit confirmation.
            A mismatched expected quantity is rejected to prevent overwriting a checkout reservation.</p>
          <button className="cav3-inv-save" type="submit" disabled={!isReady}>
            {busy ? "Checking and saving…" : "Review & confirm adjustment"}
          </button>
          {!history && <p className="cav3-detail-explainer">Adjustment controls locked until audit history loads.</p>}
        </form> : <p className="cav3-state">Select a SKU on the left to adjust available stock. Physical inventory is not measured here.</p>}
      </section>
    </div>

    <div className="cav3-inventory-columns">
      <section className="cav3-panel">
        <div className="cav3-panel-head"><h2>Reservation safety review</h2>
          <span className="cav3-quiet">{reservations ? "First 100 holds maximum" : "Loading…"}</span></div>
        {reservations ? <>
          <div className="cav3-inv-reservation-stats"><span><b>{reservations.active}</b> Active</span>
            <span><b>{reservations.expiredPending}</b> Payment review</span>
            <span><b>{reservations.anomalies}</b> Anomalies</span></div>
          {reservations.items.filter(item => item.review !== "active").slice(0, 12).map(item =>
            <div className="cav3-inv-hold" key={item.publicId}>
              <span><b>{item.publicId}</b><small>{item.review.replaceAll("_", " ")} · {item.quantity} pieces</small></span>
              <button type="button" onClick={() => onOpenOrder(item.publicId)}>View order</button>
            </div>)}
          {!reservations.items.some(item => item.review !== "active") &&
            <p className="cav3-state">No review-required holds in this snapshot.</p>}
          {reservations.moreResults && <p className="cav3-state">More than 100 holds exist; this is a limited review, not a global count.</p>}
        </> : <p className="cav3-state">Checking pending holds…</p>}
        <p className="cav3-inv-footnote">This panel never releases reservations or marks payments failed. Confirm gateway records before changing related order status.</p>
      </section>
      <section className="cav3-panel">
        <div className="cav3-panel-head"><h2>Recent audited adjustments</h2><span className="cav3-quiet">Last 40 records</span></div>
        {history?.length ? history.slice(0, 25).map(adjustment =>
          <div className="cav3-inv-history" key={adjustment.id}>
            <span><b>{adjustment.productId}</b><small>{day(adjustment.createdAt)} · {adjustment.reason}</small></span>
            <span><b>{adjustment.delta > 0 ? "+" : ""}{adjustment.delta}</b><small>{adjustment.previousAvailable} → {adjustment.availableQuantity}</small></span>
          </div>) : <p className="cav3-state">{history ? "No audited adjustments recorded yet." : "Loading audit records…"}</p>}
      </section>
    </div>
  </div>
}
