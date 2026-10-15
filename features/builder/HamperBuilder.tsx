"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { uiContent } from "../../lib/domain/content"
import { formatMoney } from "../../lib/domain/money"
import { hamperFinalPriceRupees } from "../../config/self-build-delivery"
import { BudgetStep } from "./steps/BudgetStep"
import { DetailsStep } from "./steps/DetailsStep"
import { PaymentStep } from "./steps/PaymentStep"
import { useOrderSubmit } from "../checkout/useOrderSubmit"
import { useHamperBuilder } from "./useHamperBuilder"
import { useCustomerAccount } from "../account/useCustomerAccount"
import { CustomerAuthPanel } from "../account/CustomerAuthPanel"
import { useStoreSettings } from "../shell/useStoreSettings"
import { focusCheckoutField, notifyUx, scrollToUxTarget } from "../ux/UxMessenger"
import { trackGa4BeginCheckout } from "../analytics/ga4"
import type { DeliveryAddress } from "../../lib/domain/delivery-address"
import { deliveryHasInput } from "../../lib/domain/delivery-address"
import { loadDefaultAddress, saveDefaultAddress } from "../checkout/delivery-preferences"

function builderStepUrl(step: number) {
  const url = new URL(window.location.href)
  url.hash = `builder-step-${step}`
  return `${url.pathname}${url.search}${url.hash}`
}

function historyBuilderStep(value: unknown) {
  const step = Number(value)
  return Number.isInteger(step) && step >= 1 && step <= 3 ? step : null
}

export function HamperBuilder({ state, quickStart = false, hideTierSize = false, onBackToCurated, onNewCuratedOrder }: {
  state: ReturnType<typeof useHamperBuilder>
  quickStart?: boolean
  hideTierSize?: boolean
  onBackToCurated?: () => void
  onNewCuratedOrder?: () => void
}) {
  const order = useOrderSubmit()
  const customer = useCustomerAccount()
  const storeSettings = useStoreSettings()
  const [showAuth, setShowAuth] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const [savedAddress, setSavedAddress] = useState<DeliveryAddress | null>(null)
  const initialStep = useRef(true)
  const previousStep = useRef(state.step)
  const historyInitialized = useRef(false)
  const applyingHistory = useRef(false)
  const authSheetRef = useRef<HTMLDivElement>(null)
  const authReturnFocus = useRef<HTMLElement | null>(null)
  const gaCheckoutKey = useRef("")
  const copy = uiContent.builder
  const submitArgs = {
    tier: state.tier,
    selectedProductIds: state.selected,
    selectedNames: state.selectedNames,
    checkout: state.checkout,
    accepted: state.accepted
  }

  useEffect(() => setPortalReady(true), [])

  useEffect(() => {
    if (state.step < 2) return
    const key = `${state.tier.id}:${state.checkout.occasion}`
    if (gaCheckoutKey.current === key) return
    gaCheckoutKey.current = key
    trackGa4BeginCheckout([{
      item_id: `hamper:${state.tier.id}`,
      item_name: state.tier.name,
      item_category: "Gift Hamper",
      price: state.tier.price,
      quantity: 1
    }], state.tier.price)
  }, [state.step, state.tier.id, state.tier.name, state.tier.price, state.checkout.occasion])

  useEffect(() => {
    if (!customer.account) { setSavedAddress(null); return }
    state.updateField("phone", customer.account.phone)
    if (!state.checkout.customerName.trim()) state.updateField("customerName", customer.account.displayName)
    let cancelled = false
    void loadDefaultAddress().then((address) => {
      if (cancelled) return
      setSavedAddress(address)
      if (address && !deliveryHasInput(state.checkout)) useSavedAddress(address)
    }).catch(() => { /* Guest-entered address and browser autofill remain available. */ })
    return () => { cancelled = true }
  }, [customer.account?.id])

  function useSavedAddress(address: DeliveryAddress) {
    if (!state.checkout.receiverName.trim()) state.updateField("receiverName", address.receiverName)
    state.updateField("address", address.address)
    state.updateField("city", address.city)
    state.updateField("state", address.state)
    state.updateField("pincode", address.pincode)
  }

  function rememberAddress() {
    if (!customer.account || !state.checkout.address.trim() || !state.checkout.city.trim()
      || !state.checkout.state.trim() || !/^\d{6}$/.test(state.checkout.pincode)) return
    void saveDefaultAddress(state.checkout).then(setSavedAddress).catch(() => {
      notifyUx({ title: "Address not saved", body: "Your delivery details remain in this checkout, but your account default could not be updated.", tone: "info" })
    })
  }

  useEffect(() => {
    if (!state.draftRestored) return
    notifyUx({
      title: "Your hamper is back ✓",
      body: "We restored your budget, occasion and checkout progress so you can continue where you left off.",
      tone: "success",
      durationMs: 4200
    })
    state.dismissDraftRestored()
  }, [state.draftRestored])

  useEffect(() => {
    if (initialStep.current) {
      initialStep.current = false
      previousStep.current = state.step
      return
    }

    window.setTimeout(() => scrollToUxTarget(document.querySelector("[data-builder-step-shell]"), "start"), 40)

    if (applyingHistory.current) {
      previousStep.current = state.step
      applyingHistory.current = false
      return
    }

    if (previousStep.current === state.step) return

    if (!historyInitialized.current) {
      window.history.replaceState(
        { ...(window.history.state || {}), celebrationBuilder: true, celebrationBuilderStep: quickStart ? 2 : 1 },
        "",
        builderStepUrl(quickStart ? 2 : 1)
      )
      historyInitialized.current = true
    }

    window.history.pushState(
      { ...(window.history.state || {}), celebrationBuilder: true, celebrationBuilderStep: state.step },
      "",
      builderStepUrl(state.step)
    )
    previousStep.current = state.step
  }, [state.step])

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const eventState = event.state as { celebrationBuilder?: boolean; celebrationBuilderStep?: number } | null
      if (!eventState?.celebrationBuilder) return
      const nextStep = historyBuilderStep(eventState.celebrationBuilderStep)
      if (!nextStep) return
      historyInitialized.current = true
      applyingHistory.current = true
      previousStep.current = nextStep
      state.setStep(nextStep)
      window.setTimeout(() => scrollToUxTarget(document.querySelector("[data-builder-step-shell]"), "start"), 40)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [state.setStep])

  function changeBudget() {
    document.getElementById("budgets")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start"
    })
  }

  function openAuth() {
    authReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    customer.setError("")
    setShowAuth(true)
    window.setTimeout(() => {
      if (!window.matchMedia("(min-width: 760px)").matches) return
      authSheetRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true })
    }, 180)
  }

  function closeAuth(restoreFocus = true) {
    setShowAuth(false)
    if (!restoreFocus) return
    window.setTimeout(() => authReturnFocus.current?.focus({ preventScroll: true }), 40)
  }

  useEffect(() => {
    if (!showAuth) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function handleDialogKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        closeAuth()
        return
      }
      if (event.key !== "Tab") return

      const sheet = authSheetRef.current
      if (!sheet) return
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter((item) => item.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", handleDialogKeyboard)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleDialogKeyboard)
    }
  }, [showAuth])

  useEffect(() => {
    if (!order.error) return
    notifyUx({ title: "Payment update", body: order.error, tone: "error", durationMs: 4200 })
  }, [order.error])

  useEffect(() => {
    if (!order.created) return
    state.clearDraft()
    notifyUx({ title: "Order placed ✓", body: `${order.created.orderId} is now in My Celebration.`, tone: "success", durationMs: 4500 })
    window.setTimeout(() => {
      const success = document.querySelector<HTMLElement>("[data-order-success]")
      scrollToUxTarget(success, "center")
      window.setTimeout(() => success?.focus({ preventScroll: true }), 280)
    }, 100)
  }, [order.created?.orderId])

  function moveToStep(nextStep: number) {
    if (onBackToCurated && nextStep === 2 && state.step === 3) {
      state.goToStep(2)
      onBackToCurated()
      return
    }
    const currentHistory = window.history.state as { celebrationBuilder?: boolean; celebrationBuilderStep?: number } | null
    if (nextStep === state.step - 1 && currentHistory?.celebrationBuilder && currentHistory.celebrationBuilderStep === state.step) {
      window.history.back()
      return
    }

    const invalidField = state.goToStep(nextStep)
    if (invalidField) {
      notifyUx({ title: "One detail is missing", body: "Complete the highlighted field to continue.", tone: "error" })
      window.setTimeout(() => focusCheckoutField(invalidField), 80)
    }
  }

  function moveToPayment() {
    const invalidField = state.goToPayment()
    if (!invalidField) rememberAddress()
    if (invalidField) {
      notifyUx({ title: "Complete this field", body: "We’ve highlighted the detail that needs attention.", tone: "error" })
      window.setTimeout(() => focusCheckoutField(invalidField), 80)
    }
  }

  async function submit(offerQuoteId?: string | null) {
    if (!customer.account) {
      notifyUx({ title: "Almost there", body: "Login or create your account, then continue without losing your hamper details.", tone: "info" })
      openAuth()
      return
    }
    rememberAddress()
    await order.submit({ ...submitArgs, offerQuoteId, checkout: { ...state.checkout, phone: customer.account.phone } })
  }

  async function pay(offerQuoteId?: string | null) {
    if (!customer.account) {
      notifyUx({ title: "Almost there", body: "Login or create your account, then continue to secure payment without losing your hamper details.", tone: "info" })
      openAuth()
      return
    }
    rememberAddress()
    await order.pay({ ...submitArgs, offerQuoteId, checkout: { ...state.checkout, phone: customer.account.phone } })
  }

  async function authenticated(account: NonNullable<typeof customer.account>) {
    const customerName = state.checkout.customerName.trim() || account.displayName
    state.updateField("phone", account.phone)
    state.updateField("customerName", customerName)
    closeAuth(false)
    if (state.checkout.address.trim() && state.checkout.city.trim() && state.checkout.state.trim() && /^\d{6}$/.test(state.checkout.pincode)) {
      void saveDefaultAddress({ ...state.checkout, phone: account.phone }).then(setSavedAddress).catch(() => {
        notifyUx({ title: "Address not saved", body: "You can still finish checkout. Your account address was not saved.", tone: "info" })
      })
    }
    notifyUx({ title: "You’re signed in ✓", body: "Your hamper is saved. Continue to secure payment.", tone: "success", durationMs: 2400 })
    window.setTimeout(() => scrollToUxTarget(document.querySelector("[data-payment-checkout]"), "center"), 120)
  }

  function openWhatsapp() {
    if (!order.created) return
    const url = order.whatsappUrl(submitArgs, order.created, storeSettings.whatsapp)
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function startAnotherOrder() {
    order.reset()
    state.resetForNewOrder(customer.account ? { customerName: customer.account.displayName, phone: customer.account.phone } : undefined)
    onNewCuratedOrder?.()
    notifyUx({ title: "Ready for another one", body: "Choose a new budget and start your next hamper.", tone: "info" })
    window.setTimeout(() => scrollToUxTarget(document.getElementById("builder"), "start"), 80)
  }

  const authDialog = portalReady && showAuth ? createPortal(
    <div className="customerAuthOverlay" role="dialog" aria-modal="true" aria-label="Login to continue">
      <button className="customerAuthBackdrop" type="button" aria-label="Close login" onClick={() => closeAuth()} />
      <div className="customerAuthSheet" ref={authSheetRef}>
        <button className="customerAuthClose" type="button" onClick={() => closeAuth()} aria-label="Close">×</button>
        <CustomerAuthPanel busy={customer.busy} error={customer.error} initialPhone={state.checkout.phone} initialName={state.checkout.customerName} autoFocusPhone={false} onAuthenticate={customer.authenticate} onClearError={() => customer.setError("")} onSuccess={authenticated} />
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <section id="builder" className={`builder ${quickStart ? "quickBuilder" : ""}`}>
        <div className="wrap">
          <div className="centerHead quickBuilderHead"><div className="kicker">{quickStart ? "COMPLETE YOUR HAMPER" : copy.kicker}</div><h2>{quickStart ? "Just delivery, then payment." : copy.title}</h2><p>{quickStart ? "Your budget is already selected. Add the delivery details and you’re ready to pay." : copy.body}</p></div>
          {quickStart && <section className="quickHamperSummary quickHamperSummary--premium" aria-label="Your selected hamper">
            <div className="quickHamperSummaryMain">
              <span className="quickHamperSummaryEyebrow">YOUR SELECTED HAMPER</span>
              <b className="quickHamperSummaryName">{state.tier.name}</b>
              <p className="quickHamperSummaryNote">Complete hamper price, not just the box.</p>
            </div>
            <dl className="quickHamperFacts">
              <div><dt>Final price</dt><dd>{formatMoney(hamperFinalPriceRupees(state.tier.price))}</dd></div>
              <div><dt>Occasion</dt><dd>{state.checkout.occasion}</dd></div>
              {!hideTierSize && <div><dt>Size</dt><dd>{state.tier.size}</dd></div>}
            </dl>
            <button className="secondary quickHamperChange" type="button" onClick={changeBudget}>Change budget <span aria-hidden="true">↗</span></button>
          </section>}
          {state.catalogLoading && <div className="trackingState">Loading the latest hamper options…</div>}
          {state.catalogError && <div className="catalogLoadNotice" role="alert"><span>{state.catalogError}</span><button className="secondary" type="button" disabled={state.catalogLoading} onClick={state.retryCatalog}>{state.catalogLoading ? "Retrying…" : "Retry"}</button></div>}
          <div className={`steps ${quickStart ? "quickSteps quickSteps--premium" : "fourSteps"}`} aria-label="Hamper checkout progress">{(quickStart ? [{ step: 2, label: "Delivery" }, { step: 3, label: "Payment" }] : copy.stepLabels.map((label, index) => ({ step: index + 1, label }))).map(({ step, label }) => <button type="button" key={label} className={`stepBtn ${state.step === step ? "active" : state.step > step ? "done" : ""}`} aria-current={state.step === step ? "step" : undefined} onClick={() => quickStart && step === 2 && state.step === 2 ? undefined : moveToStep(step)}>{quickStart && <span className="quickStepNumber" aria-hidden="true">{step === 2 ? "01" : "02"}</span>}<span className="quickStepLabel">{label}</span></button>)}</div>
          <div className="builderCard" data-builder-step-shell>
            {state.step === 1 && <BudgetStep tierId={state.tierId} occasion={state.checkout.occasion} tiers={state.tiers} occasions={state.occasions} onTier={state.selectTier} onOccasion={(value) => state.updateField("occasion", value)} onNext={() => moveToStep(2)} />}
            {state.step === 2 && <DetailsStep tier={state.tier} checkout={state.checkout} occasions={state.occasions} error={state.detailsError} fieldErrors={state.detailsFieldErrors} updateField={state.updateField} savedAddress={savedAddress} onUseSavedAddress={() => { if (savedAddress) useSavedAddress(savedAddress) }} onBack={quickStart ? changeBudget : () => moveToStep(1)} backLabel={quickStart ? "Change budget" : undefined} onNext={moveToPayment} />}
            {state.step === 3 && <div data-payment-checkout><PaymentStep tier={state.tier} checkout={state.checkout} selectedProductIds={state.selected} selectedNames={state.selectedNames} accepted={state.accepted} submitting={order.submitting} error={order.error} created={order.created} customerAccount={customer.account} accountLoading={customer.loading} gatewayLoading={order.gatewayLoading} gatewayEnabled={order.gatewayEnabled} paymentState={order.paymentState} paymentOrderId={order.paymentOrderId} onAccepted={state.setAccepted} onReference={(value) => state.updateField("paymentReference", value)} onBack={() => moveToStep(2)} onSubmit={submit} onPay={pay} onRefreshPayment={() => void order.refreshPayment()} onWhatsapp={openWhatsapp} onLogin={openAuth} onNewOrder={startAnotherOrder} /></div>}
          </div>
        </div>
      </section>
      {authDialog}
    </>
  )
}
