import type { Tier } from "../../../lib/domain/catalog"
import { uiContent } from "../../../lib/domain/content"
import { todayForDateInput, type CheckoutFieldErrors } from "../validation"
import { OrderSummary } from "../components/OrderSummary"
import type { CheckoutData } from "../types"

function fieldClass(error?: string, wide = false) {
  return `field ${wide ? "wide " : ""}${error ? "invalid" : ""}`.trim()
}

function FieldError({ text }: { text?: string }) {
  return text ? <small className="fieldError" role="alert">{text}</small> : null
}

function cleanLabel(value: string) {
  return value.replace(/\s*\*+\s*$/, "").trim()
}

function RequiredLabel({ children }: { children: string }) {
  return <span>{cleanLabel(children)} <b className="requiredMark" aria-hidden="true">*</b></span>
}

export function DetailsStep({ tier, checkout, selectedNames, occasions, error, fieldErrors, updateField, onBack, onNext }: {
  tier: Tier
  checkout: CheckoutData
  selectedNames: string[]
  occasions: string[]
  error: string
  fieldErrors: CheckoutFieldErrors
  updateField: <K extends keyof CheckoutData>(key: K, value: CheckoutData[K]) => void
  onBack: () => void
  onNext: () => void
}) {
  const copy = uiContent.builder.details
  const fields = copy.fields

  return (
    <div className="stepPane active">
      <div className="builderTitle"><div><h3>{copy.title}</h3><p>{copy.body}</p></div></div>
      <div className="detailsGrid">
        <div>
          <div className="checkoutSectionStack">
            <section className="checkoutSectionCard" aria-labelledby="checkout-contact-title">
              <div className="checkoutSectionHead"><div><span>CONTACT</span><h4 id="checkout-contact-title">Who is placing the order?</h4></div><small>Used for order updates and support.</small></div>
              <div className="checkoutFormGrid">
                <label className={fieldClass(fieldErrors.customerName)}><RequiredLabel>{fields.customerName[0]}</RequiredLabel><input data-checkout-field="customerName" className="control" value={checkout.customerName} onChange={(e) => updateField("customerName", e.target.value)} placeholder={fields.customerName[1]} autoComplete="name" aria-invalid={Boolean(fieldErrors.customerName)} aria-describedby={fieldErrors.customerName ? "customerName-error" : undefined} /><FieldError text={fieldErrors.customerName} /></label>
                <label className={fieldClass(fieldErrors.phone)}><RequiredLabel>{fields.phone[0]}</RequiredLabel><input data-checkout-field="phone" className="control" inputMode="tel" value={checkout.phone} onChange={(e) => updateField("phone", e.target.value.replace(/[^0-9+]/g, ""))} placeholder={fields.phone[1]} autoComplete="tel" aria-invalid={Boolean(fieldErrors.phone)} /><FieldError text={fieldErrors.phone} /></label>
              </div>
            </section>

            <section className="checkoutSectionCard" aria-labelledby="checkout-gift-title">
              <div className="checkoutSectionHead"><div><span>GIFT DETAILS</span><h4 id="checkout-gift-title">Who is the hamper for?</h4></div><small>Helps us prepare the hamper for the right moment.</small></div>
              <div className="checkoutFormGrid">
                <label className={fieldClass(fieldErrors.receiverName)}><RequiredLabel>{fields.receiverName[0]}</RequiredLabel><input data-checkout-field="receiverName" className="control" value={checkout.receiverName} onChange={(e) => updateField("receiverName", e.target.value)} placeholder={fields.receiverName[1]} autoComplete="off" aria-invalid={Boolean(fieldErrors.receiverName)} /><FieldError text={fieldErrors.receiverName} /></label>
                <label className={fieldClass(fieldErrors.requiredDate)}><RequiredLabel>{fields.requiredDate[0]}</RequiredLabel><input data-checkout-field="requiredDate" className="control" type="date" min={todayForDateInput()} value={checkout.requiredDate} onChange={(e) => updateField("requiredDate", e.target.value)} aria-invalid={Boolean(fieldErrors.requiredDate)} /><FieldError text={fieldErrors.requiredDate} /></label>
                <label className="field wide"><span>{cleanLabel(fields.occasion[0])}</span><select data-checkout-field="occasion" className="control" value={checkout.occasion} onChange={(e) => updateField("occasion", e.target.value)}>{occasions.map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>
            </section>

            <section className="checkoutSectionCard" aria-labelledby="checkout-address-title">
              <div className="checkoutSectionHead"><div><span>DELIVERY</span><h4 id="checkout-address-title">Where should we send it?</h4></div><small>Enter a complete address to reduce delivery issues.</small></div>
              <div className="checkoutFormGrid">
                <label className={fieldClass(fieldErrors.pincode)}><RequiredLabel>{fields.pincode[0]}</RequiredLabel><input data-checkout-field="pincode" className="control" inputMode="numeric" maxLength={6} value={checkout.pincode} onChange={(e) => updateField("pincode", e.target.value.replace(/\D/g, ""))} placeholder={fields.pincode[1]} autoComplete="postal-code" aria-invalid={Boolean(fieldErrors.pincode)} /><FieldError text={fieldErrors.pincode} /></label>
                <label className="field"><span>{cleanLabel(fields.city[0])} <small className="optionalLabel">optional</small></span><input data-checkout-field="city" className="control" value={checkout.city} onChange={(e) => updateField("city", e.target.value)} placeholder={fields.city[1]} autoComplete="address-level2" /></label>
                <label className={fieldClass(fieldErrors.address, true)}><RequiredLabel>{fields.address[0]}</RequiredLabel><textarea data-checkout-field="address" className="control" rows={3} value={checkout.address} onChange={(e) => updateField("address", e.target.value)} placeholder={fields.address[1]} autoComplete="street-address" aria-invalid={Boolean(fieldErrors.address)} /><FieldError text={fieldErrors.address} /></label>
                <label className="field wide"><span>{cleanLabel(fields.state[0])} <small className="optionalLabel">optional</small></span><input data-checkout-field="state" className="control" value={checkout.state} onChange={(e) => updateField("state", e.target.value)} placeholder={fields.state[1]} autoComplete="address-level1" /></label>
              </div>
            </section>

            <section className="checkoutSectionCard" aria-labelledby="checkout-message-title">
              <div className="checkoutSectionHead"><div><span>PERSONAL TOUCH</span><h4 id="checkout-message-title">Add a message</h4></div><small>Optional. We can place this on the message card.</small></div>
              <div className="checkoutFormGrid">
                <label className="field wide"><span>{cleanLabel(fields.message[0])} <small className="optionalLabel">optional</small></span><textarea data-checkout-field="message" className="control" rows={3} value={checkout.message} onChange={(e) => updateField("message", e.target.value)} placeholder={fields.message[1]} /></label>
              </div>
            </section>
          </div>

          {error && <div className="errorBox" role="alert">{error}</div>}
          <div className="checkoutProgressNote"><span>✓</span><span><b>Before payment:</b> we validate the required fields and take you directly to anything that still needs attention.</span></div>
          <div className="navRow detailActions"><button className="secondary" type="button" onClick={onBack}>{copy.back}</button><span className="tiny">{copy.nextHint}</span><button className="primary" type="button" onClick={onNext}>{copy.next}</button></div>
        </div>
        <OrderSummary tier={tier} checkout={checkout} selectedNames={selectedNames} />
      </div>
    </div>
  )
}
