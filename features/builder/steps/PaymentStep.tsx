"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { publicEnv } from "../../../config/public-env"
import { routes } from "../../../config/routes"
import type { OfferQuote } from "../../../lib/domain/campaign"
import { buildUpiUrl } from "../../../lib/domain/payment"
import { formatMoney, type Tier } from "../../../lib/domain/catalog"
import { storeContent, uiContent } from "../../../lib/domain/content"
import { trackConversion } from "../../analytics/conversion"
import { scrollToUxTarget } from "../../ux/UxMessenger"
import type { CustomerAccountView } from "../../account/useCustomerAccount"
import type { CreatedOrder } from "../../checkout/useOrderSubmit"
import type { CheckoutData } from "../types"
import { validatePaymentReference } from "../validation"

export function PaymentStep({
  tier,
  checkout,
  selectedProductIds,
  selectedNames,
  accepted,
  submitting,
  error,
  created,
  customerAccount,
  accountLoading,
  onAccepted,
  onReference,
  onBack,
  onSubmit,
  onWhatsapp,
  onLogin,
  onNewOrder
}: {
  tier: Tier
  checkout: CheckoutData
  selectedProductIds: string[]
  selectedNames: string[]
  accepted: boolean
  submitting: boolean
  error: string
  created: CreatedOrder | null
  customerAccount: CustomerAccountView | null
  accountLoading: boolean
  onAccepted: (value: boolean) => void
  onReference: (value: string) => void
  onBack: () => void
  onSubmit: (offerQuoteId?: string | null) => void
  onWhatsapp: () => void
  onLogin: () => void
  onNewOrder: () => void
}) {
  const copy = uiContent.builder.payment
  const [paymentStarted, setPaymentStarted] = useState(false)
  const [showPaymentReturn, setShowPaymentReturn] = useState(false)
  const [quote, setQuote] = useState<OfferQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteChecked, setQuoteChecked] = useState(false)
  const [quoteError, setQuoteError] = useState("")
  const [hesitationChecked, setHesitationChecked] = useState(false)
  const utrRef = useRef<HTMLInputElement>(null)
  const paymentReady = Boolean(publicEnv.upiId && publicEnv.upiName)
  const selectedKey = useMemo(() => [...selectedProductIds].sort().join(","), [selectedProductIds])
  const subtotalPaise = Math.round(tier.price * 100)
  const payablePaise = quote?.payablePaise ?? subtotalPaise
  const discountPaise = quote?.discountPaise ?? 0
  const upiUrl = paymentReady ? buildUpiUrl({
    upiId: publicEnv.upiId,
    upiName: publicEnv.upiName,
    amountRupees: payablePaise / 100,
    note: `${storeContent.brand.name} ${tier.name}`
  }) : ""

  function focusUtr() {
    const target = utrRef.current
    if (!target) return
    scrollToUxTarget(target, "center")
    window.setTimeout(() => target.focus({ preventScroll: true }), 240)
  }

  async function loadOffer(trigger: "checkout" | "hesitation") {
    if (!customerAccount) return null
    setQuoteLoading(true)
    setQuoteError("")
    try {
      const response = await fetch(routes.api.offerQuote, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: tier.id, selectedProductIds, trigger })
      })
      const data = await response.json() as { ok?: boolean; quote?: OfferQuote | null; error?: string }
      if (!response.ok || !data.ok) throw new Error(data.error || "OFFER_SERVICE_UNAVAILABLE")
      const next = data.quote || null
      setQuote(next)
      setQuoteChecked(true)
      if (next) trackConversion("offer_shown", { tierId: tier.id, campaignId: next.campaignId })
      return next
    } catch {
      setQuote(null)
      setQuoteChecked(true)
      setQuoteError("Couldn’t check offers right now. Regular price is still available.")
      return null
    } finally {
      setQuoteLoading(false)
    }
  }

  useEffect(() => {
    trackConversion("checkout_reached", { tierId: tier.id })
  }, [tier.id])

  useEffect(() => {
    setQuote(null)
    setQuoteChecked(false)
    setQuoteError("")
    setHesitationChecked(false)
    setPaymentStarted(false)
    setShowPaymentReturn(false)
    if (customerAccount) void loadOffer("checkout")
  }, [customerAccount?.id, tier.id, selectedKey])

  useEffect(() => {
    if (!customerAccount || !quoteChecked || quote || quoteLoading || paymentStarted || hesitationChecked) return
    const timer = window.setTimeout(() => {
      setHesitationChecked(true)
      void loadOffer("hesitation")
    }, 12000)
    return () => window.clearTimeout(timer)
  }, [customerAccount?.id, hesitationChecked, paymentStarted, quote, quoteChecked, quoteLoading, tier.id, selectedKey])

  useEffect(() => {
    if (!paymentStarted) return
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
  }, [paymentStarted])

  useEffect(() => {
    if (!error || !validatePaymentReference(checkout.paymentReference)) return
    focusUtr()
  }, [error])

  const reservedUntil = quote
    ? new Date(quote.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : ""

  function paymentClick() {
    setPaymentStarted(true)
    setShowPaymentReturn(false)
    trackConversion("payment_started", { tierId: tier.id, campaignId: quote?.campaignId })
  }

  return (
    <div className="stepPane active">
      <div className="builderTitle"><div><h3>{copy.title}</h3><p>{copy.body}</p></div><div className="paymentAmount">{formatMoney(payablePaise / 100)}</div></div>
      <div className="paymentGrid">
        <div>
          <div className={`checkoutAccount ${customerAccount ? "ready" : "needed"}`}>
            <div><span>{customerAccount ? "READY TO ORDER" : "SAVE YOUR ORDER"}</span><b>{accountLoading ? "Checking your account…" : customerAccount ? `${customerAccount.displayName} • ${customerAccount.phone}` : "Login to continue to payment"}</b><small>{customerAccount ? "Your best available checkout price is checked automatically." : "Your hamper stays exactly as you built it."}</small></div>
            {!customerAccount && !accountLoading && <button className="primary" type="button" onClick={onLogin}>Login / Create account</button>}
            {customerAccount && <Link className="secondary" href={routes.account}>My Celebration</Link>}
          </div>

          {customerAccount && quoteLoading && <div className="checkoutPriceCheck" role="status">Checking your best available price…</div>}
          {customerAccount && quote && <div className="checkoutOfferCard" role="status">
            <div className="checkoutOfferBadge">{quote.badge}</div>
            <div className="checkoutOfferCopy"><b>{quote.campaignTitle}</b><span>{quote.message}</span><small>Price reserved until {reservedUntil}</small></div>
            <div className="checkoutOfferPrice"><s>{formatMoney(quote.subtotalPaise / 100)}</s><strong>{formatMoney(quote.payablePaise / 100)}</strong><span>You save {formatMoney(quote.discountPaise / 100)}</span></div>
          </div>}
          {customerAccount && quoteError && <div className="checkoutPriceNote">{quoteError}</div>}

          <div className="paymentBox">
            <div className="paymentSticker">{copy.paymentIcon}</div>
            <div><span>{copy.payable}</span><strong>{formatMoney(payablePaise / 100)}</strong>{discountPaise > 0 && <small className="paymentSaving">Saved {formatMoney(discountPaise / 100)} automatically</small>}{paymentReady ? <small>{copy.upiPrefix} {publicEnv.upiId}</small> : <small className="setupPending">{copy.setupPending}</small>}</div>
            {!customerAccount ? <button className="primary payButton" type="button" onClick={onLogin}>Login to continue</button> : quoteLoading ? <button className="secondary payButton" disabled>Checking price…</button> : paymentReady ? <a className="primary payButton" href={upiUrl} onClick={paymentClick}>{copy.payButton}</a> : <button className="secondary payButton" disabled>{copy.setupButton}</button>}
          </div>
          <div className="paymentSteps">{storeContent.checkout.paymentSteps.map((text, index) => <div key={text}><b>{index + 1}</b><span>{text.replace("{amount}", formatMoney(payablePaise / 100))}</span></div>)}</div>
          {showPaymentReturn && !created && <div className="paymentReturnHint" role="status"><span><b>Payment done?</b> Paste your UPI transaction reference below to continue.</span><button className="secondary" type="button" onClick={focusUtr}>Add reference</button></div>}
          <label className="field utrField"><span>{copy.referenceLabel} <b className="requiredMark">*</b></span><input ref={utrRef} className="control" value={checkout.paymentReference} onChange={(e) => onReference(e.target.value)} placeholder={copy.referencePlaceholder} autoComplete="off" inputMode="text" /></label>
          <label className="policyCheck"><input type="checkbox" checked={accepted} onChange={(e) => onAccepted(e.target.checked)} /><span>{storeContent.checkout.policyConsent}</span></label>
          {error && <div className="errorBox" role="alert">{error}</div>}
          {created && <div className="successBox" data-order-success tabIndex={-1}><strong>{copy.successPrefix} {created.orderId}</strong><span>{created.discountPaise > 0 ? `Order saved — you saved ${formatMoney(created.discountPaise / 100)} with ${created.campaignTitle || "your offer"}.` : "Your order is saved."} Follow packing and shipping updates from My Celebration.</span><div className="successActions"><Link className="primary" href={routes.account}>View my order</Link><Link className="secondary" href={created.trackingPath}>{copy.trackingButton}</Link><button className="secondary" type="button" onClick={onWhatsapp}>WhatsApp support</button><button className="secondary" type="button" onClick={onNewOrder}>Build another hamper</button></div></div>}
          <div className="navRow paymentActions"><button className="secondary" type="button" onClick={onBack}>{copy.back}</button><span className="tiny">{customerAccount ? copy.hint : "Login before payment so your order and any eligible offer stay linked"}</span><button className="primary" type="button" disabled={submitting || Boolean(created) || !paymentReady || accountLoading || !customerAccount || quoteLoading} onClick={() => onSubmit(quote?.id)}>{submitting ? copy.submitting : customerAccount ? "Place order" : "Login to continue"}</button></div>
        </div>
        <div className="trustCard"><div className="trustCardIcon">{copy.protectionIcon}</div><div className="kicker">{uiContent.promise.kicker}</div><h3>{uiContent.promise.title}</h3><ul>{storeContent.promiseCards.map((card) => <li key={card.title}>{copy.protectionBullet} {card.title}</li>)}</ul><Link className="policyLink" href={routes.policies}>{uiContent.footer.policy} {copy.policyArrow}</Link></div>
      </div>
    </div>
  )
}
