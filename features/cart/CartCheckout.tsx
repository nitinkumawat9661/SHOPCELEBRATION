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
import { routes } from "../../config/routes"
import { cartKey, MAX_CART_QUANTITY, type CartItem } from "./cart"
import { useCart } from "./useCart"
import { trackGa4BeginCheckout } from "../analytics/ga4"
import { applyDelivery, deliveryHasInput, type DeliveryAddress } from "../../lib/domain/delivery-address"
import { clearCheckoutDraft, loadDefaultAddress, readCheckoutDraft, saveDefaultAddress, writeCheckoutDraft } from "../checkout/delivery-preferences"

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
  const [shippingPaise, setShippingPaise] = useState<number | null>(null)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shippingError, setShippingError] = useState("")
  const [frozenItems, setFrozenItems] = useState<CartItem[] | null>(null)
  const frozenArgs = useRef<SubmitArgs | null>(null)
  const previousCart = useRef("")
  const preparingPayment = useRef(false)
  const latestCartKey = useRef("")
  const paymentRef = useRef<HTMLDivElement>(null)
  const [draftOwner, setDraftOwner] = useState<string | null>(null)
  const [savedAddress, setSavedAddress] = useState<DeliveryAddress | null>(null)
  const [addressSaveError, setAddressSaveError] = useState("")
  const renderedStep = useRef(1)

  useEffect(() => setReady(true), [])

  useEffect(() => {
    if (!ready || customer.loading || draftOwner !== null) return
    const owner = customer.account?.id || "guest"
    const draft = readCheckoutDraft("cart", owner)
    if (draft) {
      setCheckout((current) => ({ ...current, ...draft.checkout, phone: customer.account?.phone || draft.checkout.phone || current.phone, paymentReference: "" }))
      setStep(draft.step)
    }
    setDraftOwner(owner)
  }, [ready, customer.loading, customer.account?.id, draftOwner])

  useEffect(() => {
    if (draftOwner !== "guest" || !customer.account?.id) return
    clearCheckoutDraft("cart", "guest")
    setDraftOwner(customer.account.id)
  }, [draftOwner, customer.account?.id])

  useEffect(() => {
    if (!draftOwner || order.created || order.paymentOrderId) return
    writeCheckoutDraft("cart", draftOwner, checkout, step)
  }, [draftOwner, checkout, step, order.created?.orderId, order.paymentOrderId])

  useEffect(() => {
    if (!ready || renderedStep.current === step) return
    renderedStep.current = step
    const timer = window.setTimeout(() => {
      const target = step === 1 ? document.querySelector(".cartHeading") : document.getElementById("builder")
      target?.scrollIntoView({ block: "start", behavior: "auto" })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [ready, step])

  useEffect(() => {
    const accountId = customer.account?.id
    if (!accountId) { setSavedAddress(null); return }
    let cancelled = false
    void loadDefaultAddress().then((address) => {
      if (cancelled) return
      setSavedAddress(address)
      if (address) setCheckout((current) => deliveryHasInput(current) ? current : applyDelivery(current, address))
    }).catch(() => { if (!cancelled) setAddressSaveError("Saved address is unavailable right now. You can still enter an address.") })
    return () => { cancelled = true }
  }, [customer.account?.id])

  useEffect(() => {
    if (!customer.account || step !== 3 || Object.keys(validateCheckoutFields(checkout)).length || !checkout.city.trim() || !checkout.state.trim()) return
    void saveDefaultAddress(checkout).then(setSavedAddress).catch(() => setAddressSaveError("We could not save this address to your account. Your checkout details are still here."))
  }, [customer.account?.id, step])
  useEffect(() => {
    if (!customer.account || order.paymentOrderId || order.created) return
    setCheckout((current) => ({ ...current, phone: customer.account!.phone, customerName: current.customerName.trim() || customer.account!.displayName }))
  }, [customer.account?.id])

  const locked = loading || order.submitting || Boolean(order.paymentOrderId || order.created)
  const items = frozenItems || cart.items
  const rows = items.map((item) => ({ ...item, product: catalog?.products.find((product) => product.id === item.productId) }))
  const unavailable = rows.some((row) => !row.product || !isIndividuallySellable(row.product) || (row.product.stockAvailable != null && row.quantity > row.product.stockAvailable))
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
      setShippingPaise(null)
      setShippingError("")
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
    if (order.paymentState === "paid") {
      if (draftOwner) clearCheckoutDraft("cart", draftOwner)
      cart.removePurchased(items)
    }
    const target = paymentRef.current?.querySelector<HTMLElement>("[data-order-success]")
    target?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
    target?.focus({ preventScroll: true })
  }, [order.created?.orderId, order.paymentState])

  useEffect(() => {
    if (!["CART_PRICE_CHANGED", "OUT_OF_STOCK"].includes(order.errorCode || "") || order.submitting || order.paymentOrderId) return
    setAccepted(false)
    setStep(1)
    frozenArgs.current = null
    setFrozenItems(null)
    order.reset()
    setCheckoutError(order.errorCode === "OUT_OF_STOCK" ? "A piece in your cart has just sold out. Review the refreshed cart before paying." : "A product price changed before payment. Review the refreshed cart and continue when you are ready.")
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
      return !product || !isIndividuallySellable(product) || (product.stockAvailable != null && item.quantity > product.stockAvailable)
    })) {
      setCheckoutError("A product in your cart is no longer available in the selected quantity. Review your cart before continuing.")
      return
    }
    if (cart.items.reduce((total, item) => total + latest.products.find((product) => product.id === item.productId)!.salePricePaise! * item.quantity, 0) > 2_147_483_647) {
      setCheckoutError("The cart amount exceeds the supported checkout limit. Remove items and try again.")
      return
    }
    const gaRows = cart.items.map((item) => ({ item, product: latest.products.find((product) => product.id === item.productId) }))
    const gaItems = gaRows.flatMap(({ item, product }) => product && isIndividuallySellable(product) ? [{
      item_id: product.id,
      item_name: product.name,
      item_category: product.category,
      price: (product.salePricePaise || 0) / 100,
      quantity: item.quantity
    }] : [])
    const gaValue = gaItems.reduce((total, item) => total + (item.price || 0) * (item.quantity || 1), 0)
    trackGa4BeginCheckout(gaItems, gaValue)
    setCheckoutError("")
    order.reset()
    setStep(2)
  }

  function updateField<K extends keyof CheckoutData>(key: K, value: CheckoutData[K]) {
    if (locked) return
    setCheckout((current) => ({ ...current, [key]: value }))
    if (["pincode", "address", "city", "state", "receiverName"].includes(key)) setAddressSaveError("")
    if (key === "pincode") {
      setShippingPaise(null)
      setShippingError("")
    }
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
    setDetailsError("")
  }

  async function continueToPayment() {
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

    setShippingLoading(true)
    setShippingError("")
    try {
      const response = await fetch(routes.api.shippingQuote, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pincode: checkout.pincode,
          quantity: items.reduce((total, item) => total + item.quantity, 0)
        })
      })
      const result = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "SHIPWAY_RATE_UNAVAILABLE")
      }
      setShippingPaise(0)
      if (customer.account) {
        try { setSavedAddress(await saveDefaultAddress(checkout)); setAddressSaveError("") }
        catch { setAddressSaveError("Delivery will work, but your default address could not be saved. Try again later.") }
      }
      setAccepted(false)
      order.reset()
      setStep(3)
    } catch {
      setShippingPaise(null)
      setShippingError("Delivery availability could not be confirmed for this pincode. Please try again.")
      setDetailsError("Delivery availability could not be confirmed for this pincode. Please try again.")
    } finally {
      setShippingLoading(false)
    }
  }

  async function submit(offerQuoteId?: string | null) {
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
        if (latestRows.some((row) => !row.product || !isIndividuallySellable(row.product) || (row.product.stockAvailable != null && row.quantity > row.product.stockAvailable))) { setCheckoutError("An item is no longer available. Return to your cart and remove it before payment."); return }
        const latestTotal = latestRows.reduce((total, row) => total + row.product!.salePricePaise! * row.quantity, 0)
        if (latestTotal !== subtotalPaise || latestRows.some((row, index) => row.product!.salePricePaise !== rows[index].product?.salePricePaise)) {
          setAccepted(false)
          setCheckoutError("A product price changed. Review the updated total and accept the terms again before payment.")
          return
        }
      }
      const submission = frozenArgs.current || { ...args, offerQuoteId: offerQuoteId || undefined }
      frozenArgs.current = submission
      setFrozenItems(submission.orderType === "individual" ? submission.items.map((item) => ({ ...item })) : null)
      await order.pay(submission)
    } finally { preparingPayment.current = false }
  }

  const shownTotalPaise = order.orderTotalPaise ?? order.created?.payablePaise ?? subtotalPaise
  const continueDisabled = loading || locked || unavailable || amountTooLarge || !catalog || Boolean(catalogError)
  const continueLabel = loading ? "Checking current prices…" : "Continue to delivery"

  const summary = <aside className="summary individualSummary">
    <div className="kicker">YOUR ITEMS</div><div className="sumPrice">{formatMoney(shownTotalPaise / 100)}</div>
    {step === 1 && <button className="primary cartCheckoutButton" type="button" disabled={continueDisabled} onClick={() => void beginCheckout()}>{continueLabel}</button>}
    {rows.map((row) => <div className="sumRow" key={row.productId}><span>{row.product?.name || "Unavailable item"} × {row.quantity}</span><b>{row.product && isIndividuallySellable(row.product) ? formatMoney((row.product.salePricePaise || 0) * row.quantity / 100) : "Unavailable"}</b></div>)}
    <div className="sumRow"><span>Delivery</span><b>{shippingLoading ? "Checking availability…" : "Included"}</b></div>
    {shippingError && <p className="errorBox" role="alert">{shippingError}</p>}
    <p className="note">Delivery is included in the listed product price. No extra delivery charge is added at checkout; your pincode is checked only for delivery availability.</p>
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
            <div className="cartRowControls"><div className="cartQuantity"><button type="button" aria-label={`Reduce quantity of ${row.product?.name || row.productId}`} disabled={locked || row.quantity <= 1} onClick={() => cart.quantity(row.productId, row.quantity - 1)}>−</button><output aria-label="Quantity">{row.quantity}</output><button type="button" aria-label={`Increase quantity of ${row.product?.name || row.productId}`} disabled={locked || row.quantity >= Math.min(MAX_CART_QUANTITY, row.product?.stockAvailable ?? MAX_CART_QUANTITY)} onClick={() => cart.quantity(row.productId, row.quantity + 1)}>+</button></div><button className="cartRemove" type="button" disabled={locked} onClick={() => cart.remove(row.productId)}>Remove</button></div>
          </div><strong className="cartRowTotal">{row.product && isIndividuallySellable(row.product) ? formatMoney((row.product.salePricePaise || 0) * row.quantity / 100) : "—"}</strong>
        </article>)}<Link className="cartContinueLink" href="/jewelry?view=all">← Continue shopping</Link></div>
        <div className="cartCheckoutSidebar">{summary}{catalog && unavailable && <p className="errorBox" role="alert">One or more items are sold out or exceed the available stock. Adjust your cart to continue.</p>}{amountTooLarge && <p className="errorBox" role="alert">This cart exceeds the supported order amount. Remove items to continue.</p>}<p className="cartAccountHint">Started a payment earlier? <Link href="/account">Check your saved orders</Link> before paying again.</p></div>
      </div> : <section id="builder" className="cartCheckoutBuilder"><div className="builderCard">
        {step === 2 && <DetailsStep individual summary={summary} checkout={checkout} occasions={[]} error={detailsError} fieldErrors={fieldErrors} updateField={updateField} savedAddress={savedAddress}
          onUseSavedAddress={() => { if (savedAddress) setCheckout((current) => applyDelivery(current, savedAddress)) }}
          onBack={() => setStep(1)} onNext={continueToPayment} />}
        {step === 3 && <div ref={paymentRef} tabIndex={-1}>
          {showAuth && !customer.account && <div className="cartAuthPanel"><CustomerAuthPanel busy={customer.busy} error={customer.error} initialPhone={checkout.phone} initialName={checkout.customerName} initialMode="signup" passwordlessSignup onAuthenticate={customer.authenticate} onClearError={() => customer.setError("")} onSuccess={() => { setShowAuth(false); paymentRef.current?.focus() }} /><button type="button" className="secondary" onClick={() => setShowAuth(false)}>Back to payment</button></div>}
          <PaymentStep individual={{ subtotalPaise, itemKey: cartKey(items), label: "Individual gifts", items }} orderTotalPaise={order.orderTotalPaise} shippingPaise={shippingPaise} paymentBlocked={unavailable || amountTooLarge || !catalog || Boolean(catalogError) || shippingPaise == null} checkout={checkout} selectedProductIds={[]} selectedNames={names} accepted={accepted} submitting={order.submitting || loading} error={order.error} created={order.created} customerAccount={customer.account} accountLoading={customer.loading} gatewayLoading={order.gatewayLoading} gatewayEnabled={order.gatewayEnabled} paymentState={order.paymentState} paymentOrderId={order.paymentOrderId} onAccepted={(value) => { if (!locked) setAccepted(value) }} onReference={(value) => updateField("paymentReference", value)} onBack={() => { if (!locked) { order.reset(); setStep(2) } }} onSubmit={() => undefined} onPay={(offerQuoteId) => void submit(offerQuoteId)} onRefreshPayment={() => void order.refreshPayment()} onWhatsapp={() => { if (order.created) window.open(order.whatsappUrl(frozenArgs.current || args, order.created, settings.whatsapp), "_blank", "noopener,noreferrer") }} onLogin={() => setShowAuth(true)} onNewOrder={() => { if (order.created) router.push("/jewelry?view=all") }} />
          {summary}
        </div>}
      </div></section>}
    </>}

  </section>
}
