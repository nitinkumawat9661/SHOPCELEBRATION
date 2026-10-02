"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { formatMoney, isIndividuallySellable, type CatalogConfig } from "../../lib/domain/catalog"
import { storeContent } from "../../lib/domain/content"
import { CustomerAuthPanel } from "../account/CustomerAuthPanel"
import { useCustomerAccount } from "../account/useCustomerAccount"
import type { CheckoutData } from "../builder/types"
import { DetailsStep } from "../builder/steps/DetailsStep"
import { PaymentStep } from "../builder/steps/PaymentStep"
import { validateCheckoutFields, type CheckoutFieldErrors } from "../builder/validation"
import { CatalogProductImage } from "../catalog/CatalogCard"
import { useOrderSubmit, type SubmitArgs } from "../checkout/useOrderSubmit"
import { useStoreSettings } from "../shell/useStoreSettings"
import { cartKey, MAX_CART_QUANTITY, type CartItem } from "./cart"
import { useCart } from "./useCart"

function blankCheckout(): CheckoutData {
  return { customerName: "", phone: "", receiverName: "", address: "", city: "", state: storeContent.checkout.defaultState, pincode: "", requiredDate: "", occasion: "Individual purchase", message: "", paymentReference: "" }
}

export function CartCheckout({ initialCatalog }: { initialCatalog: CatalogConfig | null }) {
  const cart = useCart()
  const customer = useCustomerAccount()
  const order = useOrderSubmit()
  const settings = useStoreSettings()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [catalog, setCatalog] = useState(initialCatalog)
  const [loading, setLoading] = useState(false)
  const [catalogError, setCatalogError] = useState(initialCatalog ? "" : "We couldn’t load the current catalog. Checkout is paused until it is available.")
  const [step, setStep] = useState(1)
  const [checkout, setCheckout] = useState<CheckoutData>(blankCheckout)
  const [accepted, setAccepted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({})
  const [detailsError, setDetailsError] = useState("")
  const [showAuth, setShowAuth] = useState(false)
  const [checkoutError, setCheckoutError] = useState("")
  const [frozenItems, setFrozenItems] = useState<CartItem[] | null>(null)
  const frozenArgs = useRef<SubmitArgs | null>(null)
  const previousCart = useRef("")
  const preparingPayment = useRef(false)
  const latestCartKey = useRef("")
  const paymentRef = useRef<HTMLDivElement>(null)

  useEffect(() => setReady(true), [])
  useEffect(() => {
    if (!customer.account || order.paymentOrderId || order.created) return
    setCheckout((current) => ({ ...current, phone: customer.account!.phone, customerName: current.customerName.trim() || customer.account!.displayName }))
  }, [customer.account?.id])

  const locked = loading || order.submitting || Boolean(order.paymentOrderId || order.created)
  const items = frozenItems || cart.items
  const rows = items.map((item) => ({ ...item, product: catalog?.products.find((product) => product.id === item.productId) }))
  const unavailable = rows.some((row) => !row.product || !isIndividuallySellable(row.product))
  const subtotalPaise = rows.reduce((total, row) => total + (row.product && isIndividuallySellable(row.product) ? (row.product.salePricePaise || 0) * row.quantity : 0), 0)
  const amountTooLarge = subtotalPaise > 2_147_483_647
  const activeKey = cartKey(cart.items)
  latestCartKey.current = activeKey
  const names = rows.map((row) => `${row.product?.name || row.productId} × ${row.quantity}`)
  const args: SubmitArgs = { orderType: "individual", items, expectedSubtotalPaise: subtotalPaise, selectedNames: names, checkout: { ...checkout, phone: customer.account?.phone || checkout.phone }, accepted }

  useEffect(() => {
    if (!ready) return
    if (previousCart.current && previousCart.current !== activeKey) {
      if (locked) return
      setStep(1)
      setAccepted(false)
      setCheckoutError("")
      frozenArgs.current = null
      setFrozenItems(null)
      order.reset()
    }
    previousCart.current = activeKey
  }, [activeKey, ready, locked])

  useEffect(() => {
    if (!order.submitting && !order.paymentOrderId && !order.created) {
      frozenArgs.current = null
      setFrozenItems(null)
    }
  }, [order.submitting, order.paymentOrderId, order.created?.orderId])

  useEffect(() => {
    if (!order.created) return
    if (order.paymentState === "paid") cart.removePurchased(items)
    const target = paymentRef.current?.querySelector<HTMLElement>("[data-order-success]")
    target?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
    target?.focus({ preventScroll: true })
  }, [order.created?.orderId])

  useEffect(() => {
    if (order.errorCode !== "CART_PRICE_CHANGED" || order.submitting || order.paymentOrderId) return
    setAccepted(false)
    setStep(1)
    frozenArgs.current = null
    setFrozenItems(null)
    order.reset()
    setCheckoutError("A product price changed before payment. Review the refreshed cart and continue when you are ready.")
    void refreshCatalog()
  }, [order.errorCode, order.submitting])

  async function refreshCatalog() {
    setLoading(true)
    setCatalogError("")
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" })
      const result = await response.json() as { ok?: boolean; catalog?: CatalogConfig }
      if (!response.ok || !result.ok || !result.catalog) throw new Error("unavailable")
      setCatalog(result.catalog)
      return result.catalog
    } catch {
      setCatalogError("We couldn’t refresh product availability and prices. Try again before checkout.")
      return null
    } finally { setLoading(false) }
  }

  async function beginCheckout() {
    if (loading || locked) return
    const latest = await refreshCatalog()
    if (!latest) return
    if (cart.items.some((item) => {
      const product = latest.products.find((product) => product.id === item.productId)
      return !product || !isIndividuallySellable(product)
    })) return
    if (cart.items.reduce((total, item) => total + latest.products.find((product) => product.id === item.productId)!.salePricePaise! * item.quantity, 0) > 2_147_483_647) return
    setCheckoutError("")
    order.reset()
    setStep(2)
  }

  function updateField<K extends keyof CheckoutData>(key: K, value: CheckoutData[K]) {
    if (locked) return
    setCheckout((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
    setDetailsError("")
  }

  function continueToPayment() {
    const errors = validateCheckoutFields(checkout)
    if (checkout.city.trim().length < 2) errors.city = "Enter your delivery city."
    if (checkout.state.trim().length < 2) errors.state = "Enter your delivery state."
    setFieldErrors(errors)
    const first = Object.keys(errors)[0] as keyof CheckoutData | undefined
    setDetailsError(first ? errors[first] || "" : "")
    if (first) {
      document.querySelector<HTMLInputElement>(`[data-checkout-field="${first}"]`)?.focus()
      return
    }
    setAccepted(false)
    order.reset()
    setStep(3)
  }

  async function submit() {
    if (preparingPayment.current || loading || order.submitting || unavailable || amountTooLarge || !catalog || catalogError || !items.length) return
    if (!customer.account) { setShowAuth(true); return }
    preparingPayment.current = true
    setCheckoutError("")
    try {
      if (!frozenArgs.current) {
        const latest = await refreshCatalog()
        if (!latest) return
        if (latestCartKey.current !== activeKey) { setCheckoutError("Your cart changed. Return to your cart and review it before payment."); return }
        const latestRows = items.map((item) => ({ ...item, product: latest.products.find((product) => product.id === item.productId) }))
        if (latestRows.some((row) => !row.product || !isIndividuallySellable(row.product))) { setCheckoutError("An item is no longer available. Return to your cart and remove it before payment."); return }
        const latestTotal = latestRows.reduce((total, row) => total + row.product!.salePricePaise! * row.quantity, 0)
        if (latestTotal !== subtotalPaise || latestRows.some((row, index) => row.product!.salePricePaise !== rows[index].product?.salePricePaise)) {
          setAccepted(false)
          setCheckoutError("A product price changed. Review the updated total and accept the terms again before payment.")
          return
        }
      }
      const submission = frozenArgs.current || args
      frozenArgs.current = submission
      setFrozenItems(submission.orderType === "individual" ? submission.items.map((item) => ({ ...item })) : null)
      await order.pay(submission)
    } finally { preparingPayment.current = false }
  }

  const summary = <aside className="summary individualSummary">
    <div className="kicker">YOUR ITEMS</div><div className="sumPrice">{formatMoney((order.orderTotalPaise ?? order.created?.payablePaise ?? subtotalPaise) / 100)}</div>
    {rows.map((row) => <div className="sumRow" key={row.productId}><span>{row.product?.name || "Unavailable item"} × {row.quantity}</span><b>{row.product && isIndividuallySellable(row.product) ? formatMoney((row.product.salePricePaise || 0) * row.quantity / 100) : "Unavailable"}</b></div>)}
    <p className="note">Individual products only. Prices and eligibility are checked again on the server before payment. No additional shipping fee is added at checkout.</p>
  </aside>

  if (!ready) return <section className="wrap cartLoading" role="status">Loading your cart…</section>
  return <section className="wrap cartContents">
    <div className="cartHeading"><div className="kicker">CELEBRATION, YOUR WAY</div><h1>Your shopping cart</h1><p>Buy available jewelry and gifts individually, without a hamper.</p></div>
    {catalogError && <div className="catalogLoadNotice" role="alert"><span>{catalogError}</span><button type="button" className="secondary" disabled={loading || locked} onClick={() => void refreshCatalog()}>{loading ? "Refreshing…" : "Retry catalog"}</button></div>}
    {checkoutError && <div className="errorBox" role="alert">{checkoutError}</div>}
    {!items.length && !order.created ? <div className="cartEmpty"><span aria-hidden="true">♡</span><h2>A little something is waiting.</h2><p>Your cart is empty. Add an item that is available for individual purchase.</p><Link className="primary" href="/jewelry?view=all">Explore gifts</Link></div> : <>
      <div className="cartCheckoutSteps" aria-label="Checkout progress"><span aria-current={step === 1 ? "step" : undefined}>1. Cart</span><span aria-current={step === 2 ? "step" : undefined}>2. Delivery</span><span aria-current={step === 3 ? "step" : undefined}>3. Payment</span></div>
      {locked && <div className="cartSavedNotice" role="status">{order.created ? "This order is saved." : order.paymentOrderId ? `Order ${order.paymentOrderId} is saved.` : "Payment is opening."} Its items and delivery details stay fixed while payment is checked. <Link href="/account">My Celebration</Link></div>}
      {step === 1 ? <div className="cartGrid">
        <div className="cartRows">{rows.map((row) => <article className="cartRow" key={row.productId}>
          <div className="cartRowPhoto">{row.product ? <CatalogProductImage product={row.product} /> : <span>Unavailable item</span>}</div>
          <div className="cartRowCopy"><span className="kicker">{row.product?.category || "CATALOG ITEM"}</span><h2>{row.product ? <Link href={`/jewelry/${encodeURIComponent(row.productId)}`}>{row.product.name}</Link> : row.productId}</h2>
            <p>{row.product && isIndividuallySellable(row.product) ? `${formatMoney((row.product.salePricePaise || 0) / 100)} each` : !catalog ? "Availability cannot be checked until the catalog loads. Try again shortly." : "This item is no longer available for individual purchase. Remove it to continue."}</p>
            <div className="cartRowControls"><div className="cartQuantity"><button type="button" aria-label={`Reduce quantity of ${row.product?.name || row.productId}`} disabled={locked || row.quantity <= 1} onClick={() => cart.quantity(row.productId, row.quantity - 1)}>−</button><output aria-label="Quantity">{row.quantity}</output><button type="button" aria-label={`Increase quantity of ${row.product?.name || row.productId}`} disabled={locked || row.quantity >= MAX_CART_QUANTITY} onClick={() => cart.quantity(row.productId, row.quantity + 1)}>+</button></div><button className="cartRemove" type="button" disabled={locked} onClick={() => cart.remove(row.productId)}>Remove</button></div>
          </div><strong className="cartRowTotal">{row.product && isIndividuallySellable(row.product) ? formatMoney((row.product.salePricePaise || 0) * row.quantity / 100) : "—"}</strong>
        </article>)}<Link className="cartContinueLink" href="/jewelry?view=all">← Continue shopping</Link></div>
        <div>{summary}{catalog && unavailable && <p className="errorBox" role="alert">Remove unavailable items to continue.</p>}{amountTooLarge && <p className="errorBox" role="alert">This cart exceeds the supported order amount. Remove some items to continue.</p>}<button className="primary cartCheckoutButton" type="button" disabled={loading || locked || unavailable || amountTooLarge || !catalog || Boolean(catalogError)} onClick={() => void beginCheckout()}>{loading ? "Checking current prices…" : "Continue to delivery"}</button><p className="cartAccountHint">Started a payment earlier? <Link href="/account">Check your saved orders</Link> before paying again.</p></div>
      </div> : <section id="builder" className="cartCheckoutBuilder"><div className="builderCard">
        {step === 2 && <DetailsStep individual summary={summary} checkout={checkout} occasions={[]} error={detailsError} fieldErrors={fieldErrors} updateField={updateField} onBack={() => setStep(1)} onNext={continueToPayment} />}
        {step === 3 && <div ref={paymentRef} tabIndex={-1}>
          {showAuth && !customer.account && <div className="cartAuthPanel"><CustomerAuthPanel busy={customer.busy} error={customer.error} initialPhone={checkout.phone} initialName={checkout.customerName} onAuthenticate={customer.authenticate} onClearError={() => customer.setError("")} onSuccess={() => { setShowAuth(false); paymentRef.current?.focus() }} /><button type="button" className="secondary" onClick={() => setShowAuth(false)}>Back to payment</button></div>}
          <PaymentStep individual={{ subtotalPaise, itemKey: cartKey(items), label: "Individual gifts", items }} orderTotalPaise={order.orderTotalPaise} paymentBlocked={unavailable || amountTooLarge || !catalog || Boolean(catalogError)} checkout={checkout} selectedProductIds={[]} selectedNames={names} accepted={accepted} submitting={order.submitting || loading} error={order.error} created={order.created} customerAccount={customer.account} accountLoading={customer.loading} gatewayLoading={order.gatewayLoading} gatewayEnabled={order.gatewayEnabled} gatewayProvider={order.gatewayProvider} paymentState={order.paymentState} paymentOrderId={order.paymentOrderId} onAccepted={(value) => { if (!locked) setAccepted(value) }} onReference={(value) => updateField("paymentReference", value)} onBack={() => { if (!locked) { order.reset(); setStep(2) } }} onSubmit={() => undefined} onPay={() => void submit()} onRefreshPayment={() => void order.refreshPayment()} onWhatsapp={() => { if (order.created) window.open(order.whatsappUrl(frozenArgs.current || args, order.created, settings.whatsapp), "_blank", "noopener,noreferrer") }} onLogin={() => setShowAuth(true)} onNewOrder={() => { if (order.created) router.push("/jewelry?view=all") }} />
          {summary}
        </div>}
      </div></section>}
    </>}
  </section>
}
