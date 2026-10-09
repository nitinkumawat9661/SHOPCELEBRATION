"use client"

import { useCallback, useEffect, useState } from "react"

type Hold = {
  publicId: string
  orderStatus: string
  paymentStatus: string
  expiresAt: string
  quantity: number
  productCount: number
  review: "active" | "payment_review" | "terminal_cleanup" | "paid_stock_review"
}
type Report = {
  items: Hold[]
  active: number
  expiredPending: number
  anomalies: number
  moreResults: boolean
}

export function AdminReservationReview({ openOrder }: { openOrder: (publicId: string) => void }) {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/reservations", { cache: "no-store", signal })
      const result = await response.json() as Report & { ok?: boolean }
      if (!response.ok || !result.ok) throw new Error("Could not load inventory holds.")
      if (!signal?.aborted) setReport(result)
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Could not load inventory holds.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void reload(controller.signal)
    return () => controller.abort()
  }, [reload])

  const needsReview = (report?.items || []).filter((item) => item.review !== "active")
  return (
    <section className="adminWorkspaceCard adminReservationReview" aria-label="Payment and inventory reservation review">
      <div className="adminWorkspaceHead">
        <div><div className="kicker">PAYMENT & STOCK SAFETY</div><h2>Pending inventory holds</h2>
          <p>Review uncompleted payments before releasing reserved stock.</p></div>
        <button type="button" className="secondary" onClick={() => void reload()} disabled={loading}>{loading ? "Checking…" : "Refresh holds"}</button>
      </div>
      {error && <p className="errorBox" role="alert">{error}</p>}
      {!report && !error && <p role="status">Checking pending holds…</p>}
      {report && <>
        <div className="adminReservationStats">
          <div><b>{report.active}</b><span>Active reservations</span></div>
          <div className={report.expiredPending ? "attention" : ""}><b>{report.expiredPending}</b><span>Expired, payment unconfirmed</span></div>
          <div className={report.anomalies ? "attention" : ""}><b>{report.anomalies}</b><span>Other stock inconsistencies</span></div>
        </div>
        {needsReview.length === 0
          ? <p className="adminMetricNote">No aged or inconsistent holds found in this snapshot.</p>
          : <div className="adminReservationItems">{needsReview.slice(0, 15).map((item) =>
              <div key={item.publicId}>
                <div><b>{item.publicId}</b><small>{item.paymentStatus.replaceAll("_", " ")} · {item.quantity} piece(s), {item.productCount} item(s)</small>
                  <small>{item.review === "payment_review" ? "Expired hold: verify payment with the gateway first" : item.review === "paid_stock_review" ? "Paid order still has a reservation" : "Terminal order still has a reservation"}</small></div>
                <button type="button" className="secondary" onClick={() => openOrder(item.publicId)}>View order</button>
              </div>)}</div>}
        {(needsReview.length > 15 || report.moreResults) && <p className="adminMetricNote">Showing the first matching holds. More may exist; refresh and review the full payment records separately.</p>}
      </>}
      <p className="adminMetricNote"><strong>Safety:</strong> An expired timer does not prove payment failed. Never increase inventory manually or treat a paid cancellation as refunded without confirming the gateway record. This panel does not change stock or payment status.</p>
    </section>
  )
}
