"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { routes } from "../../config/routes"
import { formatMoney } from "../../lib/domain/catalog"

type PaymentCheckout =
  | { provider: "cashfree"; mode: "test" | "live"; providerOrderId: string; paymentSessionId: string; amountPaise: number; currency: "INR" }
  | { provider: "razorpay"; mode: "test" | "live"; providerOrderId: string; keyId: string; amountPaise: number; currency: "INR" }

type ReturnResult = {
  ok?: boolean
  error?: string
  paid?: boolean
  orderId?: string
  trackingPath?: string
  payablePaise?: number
  paymentStatus?: string
  status?: string
  checkout?: PaymentCheckout
}

type ReturnPhase = "checking" | "success" | "pending" | "failed" | "auth" | "error"

type GatewayWindow = Window & {
  Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  Cashfree?: (options: { mode: "sandbox" | "production" }) => {
    checkout: (options: { paymentSessionId: string; redirectTarget: "_modal" | "_self" }) => Promise<unknown>
  }
}

const BUILDER_DRAFT_KEY = "celebration:hamper-draft:v1"

function clearFinishedDraft() {
  try { window.localStorage.removeItem(BUILDER_DRAFT_KEY) } catch { /* localStorage is non-critical */ }
}

function cashfreeRedirectTarget(): "_modal" | "_self" {
  if (typeof window === "undefined") return "_modal"
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches ? "_self" : "_modal"
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing?.dataset.loaded === "true") return resolve()
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("PAYMENT_SDK_LOAD_FAILED")), { once: true })
      return
    }
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.addEventListener("load", () => {
      script.dataset.loaded = "true"
      resolve()
    }, { once: true })
    script.addEventListener("error", () => {
      script.remove()
      reject(new Error("PAYMENT_SDK_LOAD_FAILED"))
    }, { once: true })
    document.head.appendChild(script)
  })
}

export function PaymentReturnStatus({ providerOrderId, publicOrderId = "" }: { providerOrderId: string; publicOrderId?: string }) {
  const hasOrder = Boolean(publicOrderId || providerOrderId)
  const requestBusy = useRef(false)
  const [phase, setPhase] = useState<ReturnPhase>(hasOrder ? "checking" : "error")
  const [result, setResult] = useState<ReturnResult | null>(null)
  const [message, setMessage] = useState(hasOrder ? "Confirming your payment securely…" : "Payment return details are missing.")
  const [refreshing, setRefreshing] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const checkPayment = useCallback(async (manual = false) => {
    if (!publicOrderId && !providerOrderId) return
    if (manual) setRefreshing(true)
    setPhase("checking")
    setMessage("Confirming your payment securely…")

    try {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch(publicOrderId ? `${routes.api.paymentStatus}?orderId=${encodeURIComponent(publicOrderId)}` : `${routes.api.paymentReturnStatus}?providerOrderId=${encodeURIComponent(providerOrderId)}`, { cache: "no-store" })
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
        if (data.status === "cancelled") {
          setPhase("error")
          setMessage("This order was cancelled. Payment cannot be reopened. Contact Celebration if money was debited.")
          return
        }
        if (data.paid) {
          if (!publicOrderId) clearFinishedDraft()
          setPhase("success")
          setMessage("Payment verified. Opening your order…")
          return
        }

        if (data.paymentStatus === "failed") {
          setPhase("failed")
          setMessage("This payment attempt was not completed. Your order is saved and you can retry safely.")
          return
        }

        if (attempt < 5) {
          setMessage("Waiting for final bank confirmation…")
          await wait(1100 + attempt * 300)
        }
      }

      setPhase("pending")
      setMessage("Your payment is still being confirmed. If money was debited, do not pay again—check the status first.")
    } catch {
      setPhase("error")
      setMessage("We couldn’t refresh the payment status. Please check again in a moment.")
    } finally {
      setRefreshing(false)
    }
  }, [providerOrderId, publicOrderId])

  useEffect(() => {
    void checkPayment()
  }, [checkPayment])

  useEffect(() => {
    if (phase !== "success" || !result?.orderId) return
    const target = result.trackingPath || routes.account
    const timer = window.setTimeout(() => window.location.replace(target), 350)
    return () => window.clearTimeout(timer)
  }, [phase, result?.orderId, result?.trackingPath])

  async function verifyRazorpay(publicOrderId: string, confirmation: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
    const response = await fetch(routes.api.paymentVerify, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicOrderId,
        provider: "razorpay",
        providerOrderId: confirmation.razorpay_order_id,
        providerPaymentId: confirmation.razorpay_payment_id,
        signature: confirmation.razorpay_signature
      })
    })
    const data = await response.json() as ReturnResult
    if (!response.ok || !data.ok) throw new Error(data.error || "PAYMENT_CONFIRMATION_FAILED")
    setResult(data)
    if (data.paid) {
      if (!publicOrderId) clearFinishedDraft()
      setPhase("success")
      setMessage("Payment verified. Opening your order…")
      return true
    }
    return false
  }

  async function retryPayment() {
    if (!result?.orderId || requestBusy.current) return
    requestBusy.current = true
    setRetrying(true)
    setMessage("Preparing a secure payment attempt…")
    try {
      const response = await fetch(routes.api.paymentRetry, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicOrderId: result.orderId })
      })
      const data = await response.json() as ReturnResult
      if (response.status === 401) {
        setPhase("auth")
        setMessage("Sign in to the same Celebration account to continue payment.")
        return
      }
      if (!response.ok || !data.ok) throw new Error(data.error || "PAYMENT_RETRY_FAILED")
      if (data.paid) {
        setResult(data)
        if (!publicOrderId) clearFinishedDraft()
        setPhase("success")
        setMessage("Payment verified. Opening your order…")
        return
      }
      if (!data.checkout) throw new Error("PAYMENT_CHECKOUT_MISSING")

      setResult((current) => ({ ...current, ...data }))

      if (data.checkout.provider === "cashfree") {
        await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js")
        const factory = (window as GatewayWindow).Cashfree
        if (!factory) throw new Error("PAYMENT_SDK_LOAD_FAILED")
        const cashfree = factory({ mode: data.checkout.mode === "live" ? "production" : "sandbox" })
        await cashfree.checkout({ paymentSessionId: data.checkout.paymentSessionId, redirectTarget: cashfreeRedirectTarget() })
        await fetch(routes.api.paymentVerify, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicOrderId: result.orderId, provider: "cashfree", providerOrderId: data.checkout.providerOrderId }) })
        await checkPayment(true)
        return
      }

      await loadScript("https://checkout.razorpay.com/v1/checkout.js")
      const Razorpay = (window as GatewayWindow).Razorpay
      if (!Razorpay) throw new Error("PAYMENT_SDK_LOAD_FAILED")
      const confirmation = await new Promise<{ razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string } | null>((resolve) => {
        let settled = false
        const finish = (value: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string } | null) => {
          if (settled) return
          settled = true
          resolve(value)
        }
        const instance = new Razorpay({
          key: data.checkout?.provider === "razorpay" ? data.checkout.keyId : "",
          amount: data.checkout?.amountPaise,
          currency: "INR",
          name: "Celebration",
          description: `Retry ${result.orderId}`,
          order_id: data.checkout?.providerOrderId,
          handler: (value: unknown) => finish(value as { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }),
          modal: { ondismiss: () => finish(null) }
        })
        instance.open()
      })
      if (confirmation && await verifyRazorpay(result.orderId, confirmation)) return
      await checkPayment(true)
    } catch (cause) {
      setPhase("error")
      setMessage(cause instanceof Error && cause.message === "PAYMENT_GATEWAY_NOT_CONFIGURED" ? "Online payment is currently unavailable. Your order stays saved. Contact Celebration for help." : "We couldn’t reopen payment right now. Your order is still saved; try again in a moment.")
    } finally {
      requestBusy.current = false
      setRetrying(false)
    }
  }

  if (phase === "success" && result?.orderId) {
    return (
      <div className="paymentReturnCard paymentReturnSuccess" role="status" aria-live="polite">
        <div className="paymentReturnIcon success" aria-hidden="true">✓</div>
        <div className="paymentReturnEyebrow">PAYMENT VERIFIED</div>
        <h1>Order confirmed.</h1>
        <p className="paymentReturnLead">{typeof result.payablePaise === "number" ? `${formatMoney(result.payablePaise / 100)} received securely. ` : ""}Opening your order now…</p>

        <div className="paymentReturnOrderMeta">
          <span>Order ID</span>
          <strong>{result.orderId}</strong>
        </div>

        <div className="paymentReturnActions">
          {result.trackingPath && <Link className="primary" href={result.trackingPath}>Open order</Link>}
          <Link className="secondary" href={routes.account}>My Celebration</Link>
        </div>
      </div>
    )
  }

  if (phase === "failed") {
    return (
      <div className="paymentReturnCard paymentReturnFailed" role="alert" aria-live="polite">
        <div className="paymentReturnIcon failed" aria-hidden="true">!</div>
        <div className="paymentReturnEyebrow">PAYMENT NOT COMPLETED</div>
        <h1>Your order is safe. Payment needs another try.</h1>
        <p className="paymentReturnLead">{message}</p>
        {typeof result?.payablePaise === "number" && <p className="paymentReturnLead">Saved order total: <strong>{formatMoney(result.payablePaise / 100)}</strong></p>}
        {result?.orderId && <div className="paymentReturnOrderMeta"><span>Order ID</span><strong>{result.orderId}</strong></div>}
        <div className="paymentReturnStateList">
          <div><b>1</b><span><strong>Order saved</strong><small>Your items and delivery details stay saved.</small></span></div>
          <div><b>2</b><span><strong>No processing started</strong><small>We start processing only after a verified payment.</small></span></div>
          <div><b>3</b><span><strong>Try again securely</strong><small>Trying again continues with this same order.</small></span></div>
        </div>
        <div className="paymentReturnActions">
          {result?.orderId && <button className="primary" type="button" disabled={retrying} onClick={() => void retryPayment()}>{retrying ? "Opening payment…" : "Try payment again"}</button>}
          <button className="secondary" type="button" disabled={refreshing} onClick={() => void checkPayment(true)}>{refreshing ? "Checking…" : "Check status"}</button>
          <Link className="secondary" href={routes.account}>My Celebration</Link>
        </div>
        <div className="paymentReturnSafeNote">If your bank shows a debit despite this screen, check status before retrying.</div>
      </div>
    )
  }

  if (phase === "pending") {
    return (
      <div className="paymentReturnCard paymentReturnPending" role="status" aria-live="polite">
        <div className="paymentReturnIcon pending" aria-hidden="true">…</div>
        <div className="paymentReturnEyebrow">PAYMENT PENDING</div>
        <h1>We’re waiting for final confirmation.</h1>
        <p className="paymentReturnLead">{message}</p>
        {typeof result?.payablePaise === "number" && <p className="paymentReturnLead">Saved order total: <strong>{formatMoney(result.payablePaise / 100)}</strong></p>}
        {result?.orderId && <div className="paymentReturnOrderMeta"><span>Order ID</span><strong>{result.orderId}</strong></div>}
        <div className="paymentReturnActions">
          <button className="primary" type="button" disabled={refreshing} onClick={() => void checkPayment(true)}>{refreshing ? "Checking…" : "Check payment status"}</button>
          {result?.orderId && <button className="secondary" type="button" disabled={retrying} onClick={() => void retryPayment()}>{retrying ? "Opening…" : "No debit? Continue payment"}</button>}
          <Link className="secondary" href={routes.account}>My Celebration</Link>
        </div>
        <div className="paymentReturnSafeNote warning"><strong>Money debited?</strong> Do not retry. Use “Check payment status” while the payment confirmation catches up.</div>
      </div>
    )
  }

  const isChecking = phase === "checking"
  return (
    <div className="paymentReturnCard" role="status" aria-live="polite">
      <div className={`paymentReturnLoader ${isChecking ? "active" : ""}`} aria-hidden="true"><span /></div>
      <div className="paymentReturnEyebrow">SECURE CHECKOUT</div>
      <h1>{phase === "auth" ? "Sign in to view your payment." : phase === "error" ? "We can’t show the payment yet." : "Confirming your payment…"}</h1>
      <p className="paymentReturnLead">{message}</p>
      {result?.orderId && <div className="paymentReturnOrderMeta"><span>Order ID</span><strong>{result.orderId}</strong></div>}

      <div className="paymentReturnActions">
        {phase === "error" && <button className="primary" type="button" disabled={refreshing} onClick={() => void checkPayment(true)}>{refreshing ? "Checking…" : "Check again"}</button>}
        {phase === "auth" && <Link className="primary" href={routes.account}>Sign in / My Celebration</Link>}
        <Link className="secondary" href={routes.account}>View My Celebration</Link>
        <Link className="secondary" href={routes.home}>Back to store</Link>
      </div>

      <div className="paymentReturnSafeNote">Your order and payment details stay linked securely. Avoid making a second payment until the current status is clear.</div>
    </div>
  )
}
