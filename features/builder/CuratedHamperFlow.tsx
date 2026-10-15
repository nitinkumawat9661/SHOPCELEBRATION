"use client"

import { useEffect, useState } from "react"
import type { CatalogConfig } from "../../lib/domain/catalog"
import { formatMoney } from "../../lib/domain/money"
import { hamperFinalPriceRupees } from "../../config/self-build-delivery"
import { useCustomerAccount } from "../account/useCustomerAccount"
import { deliveryHasInput, type DeliveryAddress } from "../../lib/domain/delivery-address"
import { loadDefaultAddress, saveDefaultAddress } from "../checkout/delivery-preferences"
import { DetailsStep } from "../builder/steps/DetailsStep"
import { useHamperBuilder } from "../builder/useHamperBuilder"
import { HamperBuilder } from "../builder/HamperBuilder"
import { focusCheckoutField, notifyUx } from "../ux/UxMessenger"

type Screen = 1 | 2 | 3 | 4

export function CuratedHamperFlow({ catalog }: { catalog: CatalogConfig }) {
  const state = useHamperBuilder({ catalog })
  const account = useCustomerAccount()
  const [screen, setScreen] = useState<Screen>(1)
  const [hasChosenBudget, setHasChosenBudget] = useState(false)
  const [savedAddress, setSavedAddress] = useState<DeliveryAddress | null>(null)
  const tier = state.tier
  const payable = hamperFinalPriceRupees(tier.price)
  const delivery = Math.max(0, payable - tier.price)

  useEffect(() => {
    if (!account.account) return
    if (!state.checkout.customerName.trim()) state.updateField("customerName", account.account.displayName)
    state.updateField("phone", account.account.phone)
    let cancelled = false
    void loadDefaultAddress().then((address) => {
      if (cancelled || !address) return
      setSavedAddress(address)
      if (!deliveryHasInput(state.checkout)) {
        state.updateField("receiverName", address.receiverName || state.checkout.receiverName)
        state.updateField("address", address.address)
        state.updateField("city", address.city)
        state.updateField("state", address.state)
        state.updateField("pincode", address.pincode)
      }
    }).catch(() => { /* Manual delivery entry remains available. */ })
    return () => { cancelled = true }
    // Re-run only when the authenticated account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.account?.id])

  function chooseBudget(id: string) {
    state.selectTier(id)
    setHasChosenBudget(true)
    setScreen(2)
  }

  function useSavedAddress() {
    if (!savedAddress) return
    state.updateField("receiverName", savedAddress.receiverName || state.checkout.receiverName)
    state.updateField("address", savedAddress.address)
    state.updateField("city", savedAddress.city)
    state.updateField("state", savedAddress.state)
    state.updateField("pincode", savedAddress.pincode)
  }

  function reviewAndPay() {
    const invalid = state.goToPayment()
    if (invalid) {
      notifyUx({ title: "Check your details", body: "Please complete the highlighted field before payment.", tone: "error" })
      window.setTimeout(() => focusCheckoutField(invalid), 60)
      return
    }
    if (account.account && state.checkout.address.trim() && state.checkout.city.trim() &&
      state.checkout.state.trim() && /^\d{6}$/.test(state.checkout.pincode)) {
      void saveDefaultAddress(state.checkout).catch(() => {
        /* The checkout remains valid even if saving the address fails. */
      })
    }
    setScreen(4)
    window.scrollTo({ top: 0, behavior: "instant" })
  }

  function changeScreen(next: Screen) {
    if (next === 3) state.setStep(2)
    setScreen(next)
    window.scrollTo({ top: 0, behavior: "instant" })
  }

  if (screen === 4) {
    return <div className="curatedCheckout">
      <HamperBuilder
        state={state}
        quickStart
        onBackToCurated={() => changeScreen(3)}
        onNewCuratedOrder={() => { setHasChosenBudget(false); changeScreen(1) }}
      />
    </div>
  }

  return (
    <section className="curatedFlow wrap" aria-label="Celebration curated hamper checkout">
      {screen === 1 && (
        <div className="curatedScreen curatedBudgetScreen">
          <div className="curatedScreenHead">
            <h1>Choose your budget</h1>
            <p>You choose the budget. We curate the perfect gift.</p>
          </div>
          <div className="curatedBudgetGrid">
            {state.tiers.map((item) => {
              const chosen = hasChosenBudget && state.tierId === item.id
              const recommended = item.id === state.catalog.settings.defaultTierId
              return <article className={`curatedBudgetCard ${chosen ? "selected" : ""}`} key={item.id}>
                <div className="curatedBudgetCardTop">
                  <span className="curatedBudgetSmall">CELEBRATION CURATED</span>
                  {recommended && <span className="curatedRecommended">Recommended</span>}
                </div>
                <div className="curatedBudgetPrice">{formatMoney(hamperFinalPriceRupees(item.price))}</div>
                <h3>{item.name}</h3>
                <p>Size: {item.size}</p>
                <span className="curatedPriceHint">Complete hamper · delivery included</span>
                <button type="button" className="curatedPrimary" onClick={() => chooseBudget(item.id)}>
                  {chosen ? "Selected · Continue" : "Choose this hamper"} <span aria-hidden="true">→</span>
                </button>
              </article>
            })}
          </div>
        </div>
      )}

      {screen === 2 && (
        <div className="curatedScreen curatedOccasionScreen">
          <div className="curatedScreenHead">
            <h1>What are we celebrating?</h1>
            <p>A little context helps us choose the right gifts and presentation.</p>
          </div>
          <div className="curatedOccasionPanel">
            <div className="curatedSelectionLine">
              <span>YOUR HAMPER</span>
              <strong>{tier.name} · {formatMoney(payable)}</strong>
              <button type="button" onClick={() => changeScreen(1)}>Change budget</button>
            </div>
            <div className="curatedOccasionGrid" role="group" aria-label="Choose gift occasion">
              {state.occasions.map((occasion) => (
                <button
                  className={`curatedOccasionChip ${state.checkout.occasion === occasion ? "selected" : ""}`}
                  type="button"
                  key={occasion}
                  aria-pressed={state.checkout.occasion === occasion}
                  onClick={() => state.updateField("occasion", occasion)}
                >
                  <span>{occasion}</span>
                  <span className="curatedOccasionCheck" aria-hidden="true">{state.checkout.occasion === occasion ? "✓" : "↗"}</span>
                </button>
              ))}
            </div>
            <p className="curatedOccasionHelp">Every hamper is curated by Celebration for your selected budget and occasion.</p>
            <div className="curatedNavButtons">
              <button type="button" className="curatedSecondary" onClick={() => changeScreen(1)}>← Back</button>
              <button type="button" className="curatedPrimary" onClick={() => changeScreen(3)}>Continue to details <span aria-hidden="true">→</span></button>
            </div>
          </div>
        </div>
      )}

      {screen === 3 && (
        <div className="curatedScreen curatedDetailsScreen">
          <div className="curatedScreenHead">
            <h1>Add details & review</h1>
            <p>Everything in one place before your secure checkout.</p>
          </div>
          <div className="curatedDetailsShell">
            <DetailsStep
              tier={tier}
              checkout={state.checkout}
              occasions={state.occasions}
              error={state.detailsError}
              fieldErrors={state.detailsFieldErrors}
              updateField={state.updateField}
              savedAddress={savedAddress}
              onUseSavedAddress={useSavedAddress}
              onBack={() => changeScreen(2)}
              backLabel="← Back to occasion"
              titleOverride="A few details for your gift"
              nextLabel="Review & Pay →"
              onNext={reviewAndPay}
              summary={
                <aside className="curatedOrderSummary" aria-label="Your hamper order summary">
                  <span className="curatedFlowKicker">YOUR CELEBRATION HAMPER</span>
                  <div className="curatedSummaryPrice">{formatMoney(payable)}</div>
                  <p className="curatedSummaryCaption">Complete curated hamper</p>
                  <dl>
                    <div><dt>Budget</dt><dd>{formatMoney(tier.price)}</dd></div>
                    {delivery > 0 && <div><dt>Delivery included</dt><dd>{formatMoney(delivery)}</dd></div>}
                    <div><dt>Hamper</dt><dd>{tier.name}</dd></div>
                    <div><dt>Size</dt><dd>{tier.size}</dd></div>
                    <div><dt>Occasion</dt><dd>{state.checkout.occasion}</dd></div>
                    <div><dt>Selected gifts</dt><dd>Curated by Celebration</dd></div>
                  </dl>
                  <div className="curatedSummarySignature">Mharo Surprise, Thari Smile</div>
                  <p className="curatedSummaryNote">Preferred dates are requests, not guaranteed delivery dates. Final contents depend on availability; we’ll confirm major substitutions.</p>
                </aside>
              }
            />
          </div>
        </div>
      )}
    </section>
  )
}
