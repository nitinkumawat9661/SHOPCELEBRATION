import type { Tier } from "../../../lib/domain/catalog"
import { uiContent } from "../../../lib/domain/content"
import { todayForDateInput, type CheckoutFieldErrors } from "../validation"
import { OrderSummary } from "../components/OrderSummary"
import type { CheckoutData } from "../types"

function fieldClass(error?: string, wide = false) {
  return `field ${wide ? "wide " : ""}${error ? "invalid" : ""}`.trim()
}

function FieldError({ text }: { text?: string }) {
  return text ? <small className="fieldError">{text}</small> : null
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
          <div className="formGrid oldUiForm">
            <label className={fieldClass(fieldErrors.customerName)}><span>{fields.customerName[0]} <b className="requiredMark">*</b></span><input data-checkout-field="customerName" className="control" value={checkout.customerName} onChange={(e) => updateField("customerName", e.target.value)} placeholder={fields.customerName[1]} autoComplete="name" aria-invalid={Boolean(fieldErrors.customerName)} /><FieldError text={fieldErrors.customerName} /></label>
            <label className={fieldClass(fieldErrors.phone)}><span>{fields.phone[0]} <b className="requiredMark">*</b></span><input data-checkout-field="phone" className="control" inputMode="tel" value={checkout.phone} onChange={(e) => updateField("phone", e.target.value.replace(/[^0-9+]/g, ""))} placeholder={fields.phone[1]} autoComplete="tel" aria-invalid={Boolean(fieldErrors.phone)} /><FieldError text={fieldErrors.phone} /></label>
            <label className={fieldClass(fieldErrors.receiverName)}><span>{fields.receiverName[0]} <b className="requiredMark">*</b></span><input data-checkout-field="receiverName" className="control" value={checkout.receiverName} onChange={(e) => updateField("receiverName", e.target.value)} placeholder={fields.receiverName[1]} aria-invalid={Boolean(fieldErrors.receiverName)} /><FieldError text={fieldErrors.receiverName} /></label>
            <label className={fieldClass(fieldErrors.requiredDate)}><span>{fields.requiredDate[0]} <b className="requiredMark">*</b></span><input data-checkout-field="requiredDate" className="control" type="date" min={todayForDateInput()} value={checkout.requiredDate} onChange={(e) => updateField("requiredDate", e.target.value)} aria-invalid={Boolean(fieldErrors.requiredDate)} /><FieldError text={fieldErrors.requiredDate} /></label>
            <label className="field"><span>{fields.occasion[0]}</span><select data-checkout-field="occasion" className="control" value={checkout.occasion} onChange={(e) => updateField("occasion", e.target.value)}>{occasions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className={fieldClass(fieldErrors.pincode)}><span>{fields.pincode[0]} <b className="requiredMark">*</b></span><input data-checkout-field="pincode" className="control" inputMode="numeric" maxLength={6} value={checkout.pincode} onChange={(e) => updateField("pincode", e.target.value.replace(/\D/g, ""))} placeholder={fields.pincode[1]} autoComplete="postal-code" aria-invalid={Boolean(fieldErrors.pincode)} /><FieldError text={fieldErrors.pincode} /></label>
            <label className={fieldClass(fieldErrors.address, true)}><span>{fields.address[0]} <b className="requiredMark">*</b></span><textarea data-checkout-field="address" className="control" rows={3} value={checkout.address} onChange={(e) => updateField("address", e.target.value)} placeholder={fields.address[1]} autoComplete="street-address" aria-invalid={Boolean(fieldErrors.address)} /><FieldError text={fieldErrors.address} /></label>
            <label className="field"><span>{fields.city[0]}</span><input data-checkout-field="city" className="control" value={checkout.city} onChange={(e) => updateField("city", e.target.value)} placeholder={fields.city[1]} autoComplete="address-level2" /></label>
            <label className="field"><span>{fields.state[0]}</span><input data-checkout-field="state" className="control" value={checkout.state} onChange={(e) => updateField("state", e.target.value)} placeholder={fields.state[1]} autoComplete="address-level1" /></label>
            <label className="field wide"><span>{fields.message[0]} <small className="optionalLabel">optional</small></span><textarea data-checkout-field="message" className="control" rows={2} value={checkout.message} onChange={(e) => updateField("message", e.target.value)} placeholder={fields.message[1]} /></label>
          </div>
          {error && <div className="errorBox" role="alert">{error}</div>}
          <div className="checkoutProgressNote"><span>✓</span><span><b>Next:</b> delivery details verify karke payment screen khulega. Galat ya missing field hua to hum wahi field automatically dikha denge.</span></div>
          <div className="navRow detailActions"><button className="secondary" type="button" onClick={onBack}>{copy.back}</button><span className="tiny">{copy.nextHint}</span><button className="primary" type="button" onClick={onNext}>{copy.next}</button></div>
        </div>
        <OrderSummary tier={tier} checkout={checkout} selectedNames={selectedNames} />
      </div>
    </div>
  )
}
