"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { publicEnv } from "../../../config/public-env"
import { routes } from "../../../config/routes"
import { HAMPER_DELIVERY_FEE_PAISE } from "../../../config/self-build-delivery"
import type { OfferQuote } from "../../../lib/domain/campaign"
import { buildUpiUrl } from "../../../lib/domain/payment"
import { formatMoney, type Tier } from "../../../lib/domain/catalog"
import { storeContent, uiContent } from "../../../lib/domain/content"
import { trackConversion } from "../../analytics/conversion"
import { scrollToUxTarget } from "../../ux/UxMessenger"
import type { CustomerAccountView } from "../../account/useCustomerAccount"
import type { CreatedOrder, PaymentUiState } from "../../checkout/useOrderSubmit"
import type { CheckoutData } from "../types"
import { validatePaymentReference } from "../validation"

export function PaymentStep({
  tier,
  individual,
  orderTotalPaise,
  shippingPaise,
  paymentBlocked = false,
  checkout,
  selectedProductIds,
  accepted,
  submitting,
  error,
  created,
  customerAccount,
  accountLoading,
  gatewayLoading,
  gatewayEnabled,
  paymentState,
  paymentOrderId,
  onAccepted,
  onReference,
  onBack,
  onSubmit,
  onPay,
  onRefreshPayment,
  onWhatsapp,
  onLogin,
  onNewOrder
}: {
  tier?: Tier
  individual?: { subtotalPaise: number; itemKey: string; label: string; items: { productId: string; quantity: number }[] }
  orderTotalPaise?: number | null
  shippingPaise?: number | null
  paymentBlocked?: boolean
  checkout: CheckoutData
  selectedProductIds: string[]
  selectedNames: string[]
  accepted: boolean
  submitting: boolean
  error: string
  created: CreatedOrder | null
  customerAccount: CustomerAccountView | null
  accountLoading: boolean
  gatewayLoading: boolean
  gatewayEnabled: boolean
  paymentState: PaymentUiState
  paymentOrderId: string | null
  onAccepted: (value: boolean) => void
  onReference: (value: string) => void
  onBack: () => void
  onSubmit: (offerQuoteId?: string | null) => void
  onPay: (offerQuoteId?: string | null) => void
  onRefreshPayment: () => void
  onWhatsapp: () => void
  onLogin: () => void
  onNewOrder: () => void
}) {
  const copy = uiContent.builder.payment
  const checkoutId = tier?.id || "individual"
  const checkoutName = individual?.label || tier?.name || "Order"
  const [paymentStarted, setPaymentStarted] = useState(false)
  const [showPaymentReturn, setShowPaymentReturn] = useState(false)
  const [quote, setQuote] = useState<OfferQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState("")
  const [couponInput, setCouponInput] = useState("")
  const [couponMessage, setCouponMessage] = useState("")
  const utrRef = useRef<HTMLInputElement>(null)
  const manualPaymentReady = Boolean(!individual && publicEnv.upiId && publicEnv.upiName)
  const selectedKey = useMemo(() => individual?.itemKey || [...selectedProductIds].sort().join(","), [selectedProductIds, individual?.itemKey])
  const subtotalPaise = individual?.subtotalPaise ?? Math.round((tier?.price || 0) * 100)
  const productPayablePaise = quote?.payablePaise ?? subtotalPaise
  // All hamper amounts shown to buyers are inclusive. Internal base tier
  // and coupon calculation remain unchanged; delivery is added exactly once.
  const deliveryPaise = individual ? (shippingPaise ?? 0) : HAMPER_DELIVERY_FEE_PAISE
  const payablePaise = created?.payablePaise ?? orderTotalPaise ?? (productPayablePaise + deliveryPaise)
  const discountPaise = quote?.discountPaise ?? 0
  const upiUrl = manualPaymentReady ? buildUpiUrl({
    upiId: publicEnv.upiId,
    upiName: publicEnv.upiName,
    amountRupees: payablePaise / 100,
    note: `${storeContent.brand.name} ${checkoutName}`
  }) : ""

  function focusUtr() {
    const target = utrRef.current
    if (!target) return
    scrollToUxTarget(target, "center")
    window.setTimeout(() => target.focus({ preventScroll: true }), 240)
  }

  async function loadOffer(trigger: "checkout", enteredCoupon = "") {
    if (!customerAccount || (!individual && !tier)) return null
    const code = enteredCoupon.trim().toUpperCase()
    setQuoteLoading(true)
    if (!code) setQuoteError("")
    try {
      const body = individual
        ? { orderType: "individual", items: individual.items, trigger, ...(code ? { couponCode: code } : {}) }
        : { orderType: "hamper", tierId: tier!.id, selectedProductIds, trigger, ...(code ? { couponCode: code } : {}) }
      const response = await fetch(routes.api.offerQuote, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
      const data = await response.json() as { ok?: boolean; quote?: OfferQuote | null; error?: string }
      if (!response.ok || !data.ok) throw new Error(data.error || "OFFER_SERVICE_UNAVAILABLE")
      const next = data.quote || null
      setQuote(next)
      if (code) setCouponMessage(next ? `Coupon ${code} applied.` : "This coupon is not available for this order.")
      if (next) trackConversion("offer_shown", { ...(tier ? { tierId: tier.id } : {}), campaignId: next.campaignId })
      return next
    } catch {
      if (code) {
        setCouponMessage("Coupon is invalid, expired, or not applicable to this order.")
      } else {
        setQuote(null)
        setQuoteError("Couldn’t check offers right now. Regular price is still available.")
      }
      return null
    } finally {
      setQuoteLoading(false)
    }
  }

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase()
    setCouponInput(code)
    setCouponMessage("")
    if (!code) {
      setCouponMessage("Enter a coupon code.")
      return
    }
    await loadOffer("checkout", code)
  }

  async function clearCoupon() {
    setCouponInput("")
    setCouponMessage("")
    setQuote(null)
    await loadOffer("checkout")
  }

  useEffect(() => {
    if (individual || tier) trackConversion("checkout_reached", tier ? { tierId: tier.id } : {})
  }, [checkoutId])

  useEffect(() => {
    setQuote(null)
    setQuoteError("")
    setCouponInput("")
    setCouponMessage("")
    setPaymentStarted(false)
    setShowPaymentReturn(false)
    if (customerAccount) void loadOffer("checkout")
  }, [customerAccount?.id, checkoutId, selectedKey])

  useEffect(() => {
    if (gatewayEnabled || !paymentStarted) return
    function onVisible() {
      if (document.visibilityState !== "visible") return
      setShowPaymentReturn(true)
      window.setTimeout(focusUtr, 180)
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [gatewayEnabled, paymentStarted])

  useEffect(() => {
    if (gatewayEnabled || !error || !validatePaymentReference(checkout.paymentReference)) return
    focusUtr()
  }, [error, gatewayEnabled])

  useEffect(() => {
    if (paymentState !== "paid" || !created?.trackingPath) return
    const timer = window.setTimeout(() => window.location.replace(created.trackingPath), 350)
    return () => window.clearTimeout(timer)
  }, [created?.trackingPath, paymentState])

  const reservedUntil = quote
    ? new Date(quote.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : ""

  function paymentClick() {
    setPaymentStarted(true)
    setShowPaymentReturn(false)
    trackConversion("payment_started", { ...(tier ? { tierId: tier.id } : {}), campaignId: quote?.campaignId })
  }

  function automatedPaymentClick() {
    setPaymentStarted(true)
    setShowPaymentReturn(false)
    trackConversion("payment_started", { ...(tier ? { tierId: tier.id } : {}), campaignId: quote?.campaignId })
    onPay(quote?.id)
  }

  const automatedSteps = [
    "Pay securely",
    "Payment is confirmed for you",
    "Your order opens after payment"
  ]

  const paymentBusy = submitting || paymentState === "processing"
  const paymentPending = paymentState === "pending"
  const paymentFailed = paymentState === "failed"

  return (
    <div className="stepPane active">
      <div className="builderTitle"><div><h3>{individual ? "3. Payment" : copy.title}</h3><p>{gatewayEnabled ? "Pay securely without sending a screenshot or waiting for manual confirmation." : individual ? "Your cart stays saved. Individual purchases use verified online checkout." : copy.body}</p></div><div className="paymentAmount">{formatMoney(payablePaise / 100)}</div></div>
      <div className="paymentGrid">
        <div>
          <div className={`checkoutAccount ${customerAccount ? "ready" : "needed"}`}>
            <div><span>{customerAccount ? "READY TO ORDER" : "SAVE YOUR ORDER"}</span><b>{accountLoading ? "Checking your account…" : customerAccount ? `${customerAccount.displayName} • ${customerAccount.phone}` : "Login to continue to payment"}</b><small>{customerAccount ? "Your order, payment status and tracking stay linked to this account." : individual ? "Your cart stays saved while you sign in." : "Your hamper stays exactly as you built it."}</small></div>
            {!customerAccount && !accountLoading && <button className="primary" type="button" onClick={onLogin}>Login / Create account</button>}
            {customerAccount && <Link className="secondary" href={routes.account}>My Celebration</Link>}
          </div>

          {customerAccount && quoteLoading && <div className="checkoutPriceCheck" role="status">Checking your best available price…</div>}
          {customerAccount && quote && <div className="checkoutOfferCard" role="status">
            <div className="checkoutOfferBadge">{quote.badge}</div>
            <div className="checkoutOfferCopy"><b>{quote.campaignTitle}</b><span>{quote.message}</span><small>Offer quote valid until {reservedUntil}</small></div>
            <div className="checkoutOfferPrice"><span>Regular price {formatMoney((quote.subtotalPaise + (individual ? 0 : HAMPER_DELIVERY_FEE_PAISE)) / 100)}</span><strong>{formatMoney((quote.payablePaise + (individual ? 0 : HAMPER_DELIVERY_FEE_PAISE)) / 100)}</strong><span>Applied discount {formatMoney(quote.discountPaise / 100)}</span>{individual ? <span>Delivery included</span> : null}</div>
          </div>}
          {!individual && tier && <div className="checkoutPriceNote" aria-label="Hamper final price">
            <strong>Final hamper price: {formatMoney(payablePaise / 100)}</strong>
          </div>}
          {customerAccount && quoteError && <div className="checkoutPriceNote">{quoteError}</div>}
          {customerAccount && <div className="checkoutCoupon">
            <div><b>Have a coupon?</b><small>Enter the code exactly as shared by Celebration.</small></div>
            <div className="checkoutCouponForm">
              <input value={couponInput} disabled={quoteLoading || paymentBusy || Boolean(paymentOrderId) || Boolean(created)} maxLength={32} placeholder="WELCOME10" autoCapitalize="characters" autoComplete="off" onChange={(event) => { setCouponInput(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "")); setCouponMessage("") }} />
              <button className="secondary" type="button" disabled={quoteLoading || paymentBusy || Boolean(paymentOrderId) || Boolean(created)} onClick={() => void applyCoupon()}>Apply</button>
              {quote?.mode === "coupon" && <button className="secondary" type="button" disabled={quoteLoading || paymentBusy || Boolean(paymentOrderId) || Boolean(created)} onClick={() => void clearCoupon()}>Remove</button>}
            </div>
            {couponMessage && <small className={quote?.mode === "coupon" ? "couponSuccess" : "couponError"}>{couponMessage}</small>}
          </div>}

          <label className="policyCheck"><input type="checkbox" checked={accepted} disabled={submitting || Boolean(created) || Boolean(individual && paymentOrderId)} onChange={(e) => onAccepted(e.target.checked)} /><span>I agree to the <Link href={routes.policies} target="_blank">Order, Cancellation, Return &amp; Refund Policy</Link> and <Link href={routes.terms} target="_blank">Terms &amp; Legal</Link>, and acknowledge the <Link href={routes.privacy} target="_blank">Privacy Policy</Link>.</span></label>
          <div className="paymentPolicyHint">Check once, then pay. Never share your UPI PIN, card PIN or OTP with Celebration.</div>
          {gatewayEnabled && !accepted && customerAccount && <div className="checkoutPriceNote">Tick the checkbox above to enable secure payment.</div>}

          <div className={`paymentBox ${gatewayEnabled ? "automatedPaymentBox" : ""}`}>
            <div className="paymentSticker">{gatewayEnabled ? "✓" : copy.paymentIcon}</div>
            <div>
              <span>{gatewayEnabled ? "SECURE ONLINE PAYMENT" : copy.payable}</span>
              <strong>{formatMoney(payablePaise / 100)}</strong>
              {discountPaise > 0 && <small className="paymentSaving">Saved {formatMoney(discountPaise / 100)} automatically</small>}
              {gatewayEnabled
                ? <small>UPI, cards and supported payment apps • secure payment confirmation</small>
                : manualPaymentReady
                  ? <small>{copy.upiPrefix} {publicEnv.upiId}</small>
                  : <small className="setupPending">{individual ? "Online payment is currently unavailable. Your items remain saved in your cart. Contact Celebration for help or return when online payments are enabled." : copy.setupPending}</small>}
            </div>
            {!customerAccount
              ? <button className="primary payButton" type="button" onClick={onLogin}>Login to continue</button>
              : quoteLoading || gatewayLoading
                ? <button className="secondary payButton" disabled>Checking payment…</button>
                : gatewayEnabled
                  ? <button className="primary payButton" type="button" disabled={paymentBusy || paymentPending || Boolean(created) || !accepted || paymentBlocked} onClick={automatedPaymentClick}>{paymentBusy ? "Verifying…" : paymentBlocked ? "Review your cart first" : paymentFailed ? "Try payment again" : paymentPending ? "Payment pending" : `Pay ${formatMoney(payablePaise / 100)}`}</button>
                  : manualPaymentReady
                    ? accepted && !created && !paymentBusy ? <a className="primary payButton" href={upiUrl} onClick={paymentClick}>{copy.payButton}</a> : <button className="primary payButton" type="button" disabled>{created ? "Order saved" : "Accept terms to pay"}</button>
                    : <button className="secondary payButton" disabled>{individual ? "Online payment unavailable" : copy.setupButton}</button>}
          </div>

          {(gatewayEnabled || !individual) && <div className="paymentSteps">
            {(gatewayEnabled ? automatedSteps : storeContent.checkout.paymentSteps.map((text) => text.replace("{amount}", formatMoney(payablePaise / 100)))).map((text, index) => <div key={text}><b>{index + 1}</b><span>{text}</span></div>)}
          </div>}

          {gatewayEnabled && paymentPending && <div className="paymentStateCard pending" role="status">
            <div className="paymentStateIcon">…</div>
            <div className="paymentStateCopy"><strong>Payment pending</strong><span>{paymentOrderId ? `Order ${paymentOrderId} is saved. ` : ""}If money was debited, do not pay again. Check the status while the payment confirmation completes.</span></div>
            <div className="paymentStateActions"><button className="primary" type="button" disabled={submitting} onClick={onRefreshPayment}>{submitting ? "Checking…" : "Check payment status"}</button><button className="secondary" type="button" disabled={submitting} onClick={automatedPaymentClick}>No debit? Continue payment</button></div>
          </div>}

          {gatewayEnabled && paymentFailed && <div className="paymentStateCard failed" role="alert">
            <div className="paymentStateIcon">!</div>
            <div className="paymentStateCopy"><strong>Payment not completed</strong><span>{paymentOrderId ? `Order ${paymentOrderId} is still saved. ` : ""}No order processing starts until payment is verified. You can retry {individual ? "this order safely." : "without rebuilding your hamper."}</span></div>
            <div className="paymentStateActions"><button className="primary" type="button" disabled={submitting} onClick={automatedPaymentClick}>{submitting ? "Opening…" : "Try payment again"}</button><button className="secondary" type="button" disabled={submitting} onClick={onRefreshPayment}>Check status</button></div>
          </div>}

          {!gatewayEnabled && !individual && showPaymentReturn && !created && <div className="paymentReturnHint" role="status"><span><b>Payment done?</b> Enter the payment number shown in your UPI app to continue.</span><button className="secondary" type="button" onClick={focusUtr}>Add reference</button></div>}
          {!gatewayEnabled && !individual && <label className="field utrField"><span>{copy.referenceLabel} <b className="requiredMark">*</b></span><input ref={utrRef} className="control" value={checkout.paymentReference} disabled={submitting || Boolean(created)} onChange={(e) => onReference(e.target.value)} placeholder={copy.referencePlaceholder} autoComplete="off" inputMode="text" /></label>}

          {error && !paymentPending && <div className="errorBox" role="alert">{error}</div>}
          {created && <div className="successBox" data-order-success tabIndex={-1}><strong>{copy.successPrefix} {created.orderId}</strong><span>{created.discountPaise > 0 ? `Payment verified and order saved — you saved ${formatMoney(created.discountPaise / 100)} with ${created.campaignTitle || "your offer"}.` : paymentState === "paid" ? "Payment confirmed. Opening your order…" : "Your order is saved. We’re checking your UPI payment."} Follow packing and shipping updates from My Celebration.</span><div className="successActions"><Link className="primary" href={created.trackingPath}>Open order</Link><Link className="secondary" href={routes.account}>My Celebration</Link><button className="secondary" type="button" onClick={onWhatsapp}>WhatsApp support</button><button className="secondary" type="button" onClick={onNewOrder}>{individual ? "Continue shopping" : "Build another hamper"}</button></div></div>}

          <div className="navRow paymentActions">
            <button className="secondary" type="button" disabled={submitting || Boolean(individual && (created || paymentOrderId))} onClick={onBack}>{copy.back}</button>
            <span className="tiny">{gatewayEnabled || individual ? "We start preparing your order only after payment is confirmed." : customerAccount ? copy.hint : "Login before payment so your order and any eligible offer stay linked"}</span>
            {!gatewayEnabled && !individual && <button className="primary" type="button" disabled={submitting || Boolean(created) || !accepted || !manualPaymentReady || accountLoading || !customerAccount || quoteLoading} onClick={() => onSubmit(quote?.id)}>{submitting ? copy.submitting : customerAccount ? "Place order" : "Login to continue"}</button>}
          </div>
        </div>
        <div className="trustCard"><div className="trustCardIcon">{copy.protectionIcon}</div><div className="kicker">{uiContent.promise.kicker}</div><h3>{uiContent.promise.title}</h3><ul>{storeContent.promiseCards.map((card) => <li key={card.title}>{copy.protectionBullet} {card.title}</li>)}</ul><Link className="policyLink" href={routes.policies}>{uiContent.footer.policy} {copy.policyArrow}</Link></div>
      </div>
    </div>
  )
}
