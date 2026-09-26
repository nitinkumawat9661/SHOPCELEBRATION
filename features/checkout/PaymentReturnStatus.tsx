"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { routes } from "../../config/routes"
import { formatMoney } from "../../lib/domain/catalog"

type ReturnResult = {
  ok?: boolean
  error?: string
  paid?: boolean
  orderId?: string
  trackingPath?: string
  payablePaise?: number
  paymentStatus?: string
  status?: string
}

type ReturnPhase = "checking" | "success" | "pending" | "auth" | "error"

const BUILDER_DRAFT_KEY = "celebration:hamper-draft:v1"

function clearFinishedDraft() {
  try { window.localStorage.removeItem(BUILDER_DRAFT_KEY) } catch { /* localStorage is non-critical */ }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function PaymentReturnStatus({ providerOrderId }: { providerOrderId: string }) {
  const [phase, setPhase] = useState<ReturnPhase>(providerOrderId ? "checking" : "error")
  const [result, setResult] = useState<ReturnResult | null>(null)
  const [message, setMessage] = useState(providerOrderId ? "Confirming your payment with Cashfree…" : "Payment return details are missing.")
  const [refreshing, setRefreshing] = useState(false)

  const checkPayment = useCallback(async (manual = false) => {
    if (!providerOrderId) return
    if (manual) setRefreshing(true)
    setPhase("checking")
    setMessage("Confirming your payment with Cashfree…")

    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const response = await fetch(`${routes.api.paymentReturnStatus}?providerOrderId=${encodeURIComponent(providerOrderId)}`, { cache: "no-store" })
        const data = await response.json() as ReturnResult

        if (response.status === 401) {
          setPhase("auth")
          setMessage("Sign in to the same Celebration account to view this payment.")
          return
        }
        if (!response.ok || !data.ok) {
          if (response.status === 404 && attempt < 2) {
            await wait(900 + attempt * 500)
            continue
          }
          setPhase("error")
          setMessage("We couldn’t load this order right now. Your payment record is still safe.")
          return
        }

        setResult(data)
        if (data.paid) {
          clearFinishedDraft()
          setPhase("success")
          setMessage("Payment verified. Your Celebration order is confirmed.")
          return
        }

        if (attempt < 7) {
          setMessage("Payment received. Waiting for final bank confirmation…")
          await wait(1100 + attempt * 250)
        }
      }

      setPhase("pending")
      setMessage("Your payment is still being confirmed. Please don’t pay again.")
    } catch {
      setPhase("error")
      setMessage("We couldn’t refresh the payment status. Please check again in a moment.")
    } finally {
      setRefreshing(false)
    }
  }, [providerOrderId])

  useEffect(() => {
    void checkPayment()
  }, [checkPayment])

  if (phase === "success" && result?.orderId) {
    return (
      <div className="paymentReturnCard paymentReturnSuccess" role="status" aria-live="polite">
        <div className="paymentReturnCheck" aria-hidden="true">✓</div>
        <div className="paymentReturnEyebrow">PAYMENT VERIFIED</div>
        <h1>Your order is confirmed.</h1>
        <p className="paymentReturnLead">{typeof result.payablePaise === "number" ? `${formatMoney(result.payablePaise / 100)} received securely. ` : ""}We’ve saved your order and started the Celebration process.</p>

        <div className="paymentReturnOrderMeta">
          <span>Order ID</span>
          <strong>{result.orderId}</strong>
        </div>

        <div className="paymentReturnTimeline" aria-label="Order progress">
          <div className="done"><b>✓</b><span><strong>Payment verified</strong><small>Securely confirmed by our server</small></span></div>
          <div className="done"><b>✓</b><span><strong>Order received</strong><small>Your hamper details are saved</small></span></div>
          <div><b>3</b><span><strong>Packing comes next</strong><small>Follow preparation and delivery from My Celebration</small></span></div>
        </div>

        <div className="paymentReturnActions">
          <Link className="primary" href={routes.account}>View my order</Link>
          {result.trackingPath && <Link className="secondary" href={result.trackingPath}>Track order</Link>}
          <Link className="secondary" href={routes.home}>Back to Celebration</Link>
        </div>

        <div className="paymentReturnSafeNote">No UTR, screenshot or second payment is needed.</div>
      </div>
    )
  }

  const isChecking = phase === "checking"
  return (
    <div className="paymentReturnCard" role="status" aria-live="polite">
      <div className={`paymentReturnLoader ${isChecking ? "active" : ""}`} aria-hidden="true"><span /></div>
      <div className="paymentReturnEyebrow">SECURE CHECKOUT</div>
      <h1>{phase === "pending" ? "Payment confirmation is taking a little longer." : phase === "auth" ? "Sign in to view your payment." : phase === "error" ? "We’re unable to show the order yet." : "Confirming your payment…"}</h1>
      <p className="paymentReturnLead">{message}</p>
      {result?.orderId && <div className="paymentReturnOrderMeta"><span>Order ID</span><strong>{result.orderId}</strong></div>}

      <div className="paymentReturnActions">
        {(phase === "pending" || phase === "error") && <button className="primary" type="button" disabled={refreshing} onClick={() => void checkPayment(true)}>{refreshing ? "Checking…" : "Check payment again"}</button>}
        {phase === "auth" && <Link className="primary" href={routes.account}>Sign in / My Celebration</Link>}
        <Link className="secondary" href={routes.account}>View My Celebration</Link>
        <Link className="secondary" href={routes.home}>Back to store</Link>
      </div>

      <div className="paymentReturnSafeNote">If money has been debited, do not make another payment while this status is updating.</div>
    </div>
  )
}
