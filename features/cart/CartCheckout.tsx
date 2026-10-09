"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { formatMoney, isIndividuallySellable, productDiscountPercent, type CatalogConfig } from "../../lib/domain/catalog"
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
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const continueDisabled = loading || locked || unavailable || amountTooLarge || !catalog || Boolean(catalogError)
  const continueLabel = loading ? "Checking current prices…" : "Continue to delivery"
  const summary = <aside className="summary individualSummary marketCartSummary" aria-label="Price details and checkout">
    <div className="marketCartSummaryHead">
      <span className="marketCartEyebrow">PRICE DETAILS</span>
      <h2>Order summary</h2>
    </div>
    <div className="marketCartPriceRows">
      <div><span>Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})</span><b>{formatMoney(subtotalPaise / 100)}</b></div>
      <div><span>Delivery charges</span><b className="marketCartIncluded">Included</b></div>
    </div>
    <div className="marketCartSummaryTotal">
      <span>Total payable</span><strong>{formatMoney(shownTotalPaise / 100)}</strong>
    </div>
    {step === 1 && <>
      <button className="primary cartCheckoutButton marketCartCheckoutCta" type="button" disabled={continueDisabled} onClick={() => void beginCheckout()}>
        <span>{continueLabel}</span><span aria-hidden="true">→</span>
      </button>
      <p className="marketCartCheckoutCaption">Next: delivery details. Payment is not charged yet.</p>
    </>}
    {shippingError && <p className="errorBox" role="alert">{shippingError}</p>}
    <div className="marketCartSummaryFoot">
      <span className="marketCartShieldIcon" aria-hidden="true">✓</span>
      <p>Product price and availability are verified before checkout. Pincode serviceability is checked before payment.</p>
    </div>
    <Link className="marketCartPolicyLink" href={routes.policies}>View cancellation, return and refund policy <span aria-hidden="true">↗</span></Link>
  </aside>

  if (!ready) return <section className="wrap cartLoading" role="status">Loading your cart…</section>
  return <section className="wrap cartContents marketCart">
    <div className="marketCartBreadcrumb"><Link href="/jewelry?view=all">Shop</Link><span aria-hidden="true">›</span><span>Shopping cart</span></div>
    <header className="cartHeading marketCartHeading">
      <div><div className="marketCartEyebrow">CELEBRATION CHECKOUT</div>
        <h1>Shopping cart <span className="marketCartCount">({itemCount})</span></h1>
        <p>Review your order, choose a delivery address and complete secure payment.</p>
      </div>
      <div className="marketCartSecureBadge"><span className="marketCartShieldIcon" aria-hidden="true">✓</span><span>Secure checkout<br /><small>Your details stay protected</small></span></div>
    </header>
    {catalogError && <div className="catalogLoadNotice" role="alert"><span>{catalogError}</span><button type="button" className="secondary" disabled={loading || locked} onClick={() => void refreshCatalog()}>{loading ? "Refreshing…" : "Retry catalog"}</button></div>}
    {checkoutError && <div className="errorBox" role="alert">{checkoutError}</div>}
    {addressSaveError && <div className="cartAddressNotice" role="status">{addressSaveError}</div>}
    {!items.length && !order.created ? <div className="marketCartEmpty">
      <span className="marketCartEmptyIcon" aria-hidden="true">♡</span>
      <h2>Your cart is waiting for something special</h2>
      <p>Explore jewelry and gifts, add what you love, and your selections will appear here.</p>
      <Link className="primary marketCartShopLink" href="/jewelry?view=all">Explore the collection <span aria-hidden="true">→</span></Link>
    </div> : <>
      <nav className="cartCheckoutSteps marketCartProgress" aria-label="Checkout progress">
        {["Cart", "Delivery", "Payment"].map((label, index) => {
          const current = index + 1
          return <div className={"marketCartProgressStep" + (step > current ? " complete" : step === current ? " current" : "")} key={label} aria-current={step === current ? "step" : undefined}>
            <span className="marketCartProgressNumber">{step > current ? "✓" : current}</span><span>{label}</span>
          </div>
        })}
      </nav>
      {locked && <div className="cartSavedNotice" role="status">{order.created ? "This order is saved." : order.paymentOrderId ? "Order " + order.paymentOrderId + " is saved." : "Payment is opening."} Its items and delivery details stay fixed while payment is checked. <Link href="/account">My Celebration</Link></div>}
      {step === 1 ? <div className="cartGrid marketCartGrid">
        <section className="cartRows marketCartItems" aria-labelledby="market-cart-items-title">
          <div className="marketCartItemsHead"><h2 id="market-cart-items-title">Items in your cart</h2><span>{itemCount} {itemCount === 1 ? "item" : "items"}</span></div>
          {rows.map((row) => {
            const salePaise = row.product && isIndividuallySellable(row.product) ? row.product.salePricePaise : undefined
            const mrpPaise = row.product?.retail?.mrpPaise
            const discount = row.product && salePaise != null ? productDiscountPercent(row.product) : null
            const available = Boolean(row.product && isIndividuallySellable(row.product) && (row.product.stockAvailable == null || row.quantity <= row.product.stockAvailable))
            return <article className={"cartRow marketCartItem" + (!available ? " unavailable" : "")} key={row.productId}>
              <Link className="cartRowPhoto marketCartImage" href={"/jewelry/" + encodeURIComponent(row.productId)} aria-label={"View " + (row.product?.name || "product")} prefetch={false}>
                {row.product ? <CatalogProductImage product={row.product} /> : <span>Image unavailable</span>}
              </Link>
              <div className="cartRowCopy marketCartItemCopy">
                <span className="marketCartCategory">{row.product?.category || "CATALOG ITEM"}</span>
                <h3><Link href={"/jewelry/" + encodeURIComponent(row.productId)} prefetch={false}>{row.product?.name || "Unavailable item"}</Link></h3>
                <div className="marketCartItemStatus">
                  {available ? <span className="marketCartInStock">✓ Available</span> : <span className="marketCartOutOfStock">Unavailable in selected quantity</span>}
                  {available && row.product?.stockAvailable != null && row.product.stockAvailable <= 3 && <span className="marketCartLowStock">Only {row.product.stockAvailable} left</span>}
                </div>
                <div className="marketCartItemPrice">
                  <strong>{salePaise != null ? formatMoney(salePaise / 100) : "Unavailable"}</strong>
                  {salePaise != null && mrpPaise && mrpPaise > salePaise && <del aria-label="Maximum retail price">{formatMoney(mrpPaise / 100)}</del>}
                  {discount != null && <span className="marketCartDiscount">{discount}% off MRP</span>}
                </div>
                <p className="marketCartItemDelivery">Delivery included · Address checked at next step</p>
                <div className="cartRowControls marketCartItemActions">
                  <div className="cartQuantity" role="group" aria-label={"Quantity for " + (row.product?.name || row.productId)}>
                    <button type="button" aria-label={"Decrease quantity of " + (row.product?.name || row.productId)} disabled={locked || row.quantity <= 1} onClick={() => cart.quantity(row.productId, row.quantity - 1)}>−</button>
                    <output aria-label="Quantity">{row.quantity}</output>
                    <button type="button" aria-label={"Increase quantity of " + (row.product?.name || row.productId)} disabled={locked || row.quantity >= Math.min(MAX_CART_QUANTITY, row.product?.stockAvailable ?? MAX_CART_QUANTITY)} onClick={() => cart.quantity(row.productId, row.quantity + 1)}>+</button>
                  </div>
                  <button className="cartRemove" type="button" aria-label={"Remove " + (row.product?.name || row.productId) + " from cart"} disabled={locked} onClick={() => cart.remove(row.productId)}>Remove</button>
                </div>
              </div>
              <div className="marketCartLineTotal"><span>Item total</span><strong>{salePaise != null ? formatMoney(salePaise * row.quantity / 100) : "Unavailable"}</strong></div>
            </article>
          })}
          <div className="marketCartItemsFoot"><Link className="cartContinueLink" href="/jewelry?view=all"><span aria-hidden="true">←</span> Continue shopping</Link><span>Final price and stock are checked at checkout.</span></div>
          {savedAddress && customer.account && <div className="marketCartSavedHint"><span aria-hidden="true">⌖</span><span>A saved delivery address is available for your account. You can use or change it in the next step.</span></div>}
          <div className="marketCartBenefits" aria-label="Shopping information">
            <div><span className="marketCartBenefitIcon" aria-hidden="true">✓</span><b>Price transparency</b><small>No extra delivery charge at checkout</small></div>
            <div><span className="marketCartBenefitIcon" aria-hidden="true">⌖</span><b>Pincode check</b><small>Availability verified before payment</small></div>
            <div><span className="marketCartBenefitIcon" aria-hidden="true">↗</span><b>Order updates</b><small>Track orders in My Celebration</small></div>
          </div>
        </section>
        <div className="cartCheckoutSidebar marketCartSidebar">
          {summary}
          {catalog && unavailable && <p className="errorBox" role="alert">Some products are unavailable or exceed available stock. Update the quantities to continue.</p>}
          {amountTooLarge && <p className="errorBox" role="alert">The cart exceeds the supported payment limit. Remove items to continue.</p>}
          <p className="cartAccountHint">Already started a payment? <Link href="/account">Check your saved orders</Link> before trying again.</p>
        </div>
      </div> : <section id="builder" className="cartCheckoutBuilder marketCartCheckoutBuilder"><div className="builderCard marketCartBuilderCard">
        {step === 2 && <DetailsStep individual summary={summary} checkout={checkout} occasions={[]} error={detailsError} fieldErrors={fieldErrors} updateField={updateField} savedAddress={savedAddress}
          onUseSavedAddress={() => { if (savedAddress) setCheckout((current) => applyDelivery(current, savedAddress)) }}
          onBack={() => setStep(1)} onNext={continueToPayment} />}
        {step === 3 && <div ref={paymentRef} tabIndex={-1}>
          {showAuth && !customer.account && <div className="cartAuthPanel"><CustomerAuthPanel busy={customer.busy} error={customer.error} initialPhone={checkout.phone} initialName={checkout.customerName} initialMode="signup" passwordlessSignup onAuthenticate={customer.authenticate} onClearError={() => customer.setError("")} onSuccess={() => { setShowAuth(false); paymentRef.current?.focus() }} /><button type="button" className="secondary" onClick={() => setShowAuth(false)}>Back to payment</button></div>}
          <PaymentStep individual={{ subtotalPaise, itemKey: cartKey(items), label: "Individual gifts", items }} orderTotalPaise={order.orderTotalPaise} shippingPaise={shippingPaise} paymentBlocked={unavailable || amountTooLarge || !catalog || Boolean(catalogError) || shippingPaise == null} checkout={checkout} selectedProductIds={[]} selectedNames={names} accepted={accepted} submitting={order.submitting || loading} error={order.error} created={order.created} customerAccount={customer.account} accountLoading={customer.loading} gatewayLoading={order.gatewayLoading} gatewayEnabled={order.gatewayEnabled} paymentState={order.paymentState} paymentOrderId={order.paymentOrderId} onAccepted={(value) => { if (!locked) setAccepted(value) }} onReference={(value) => updateField("paymentReference", value)} onBack={() => { if (!locked) { order.reset(); setStep(2) } }} onSubmit={() => undefined} onPay={(offerQuoteId) => void submit(offerQuoteId)} onRefreshPayment={() => void order.refreshPayment()} onWhatsapp={() => { if (order.created) window.open(order.whatsappUrl(frozenArgs.current || args, order.created, settings.whatsapp), "_blank", "noopener,noreferrer") }} onLogin={() => setShowAuth(true)} onNewOrder={() => { if (order.created) router.push("/jewelry?view=all") }} />
        </div>}
      </div></section>}
    </>}

  </section>
}
