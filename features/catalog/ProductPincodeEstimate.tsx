"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"

type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "serviceable"; estimatedDeliveryDate: string | null; estimatedTransitDays: number | null }
  | { state: "not-serviceable" }
  | { state: "error"; message: string }

const textDate = (date: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
    .format(new Date(date + "T12:00:00+05:30"))

export function ProductPincodeEstimate({ productId }: { productId: string }) {
  const [pincode, setPincode] = useState("")
  const [result, setResult] = useState<Check>({ state: "idle" })
  const currentRequest = useRef<AbortController | null>(null)

  useEffect(() => () => currentRequest.current?.abort(), [])

  function edit(value: string) {
    currentRequest.current?.abort()
    setPincode(value.replace(/\D/g, "").slice(0, 6))
    setResult({ state: "idle" })
  }

  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^\d{6}$/.test(pincode)) {
      setResult({ state: "error", message: "Enter a valid 6-digit Indian PIN code." })
      return
    }
    currentRequest.current?.abort()
    const controller = new AbortController()
    currentRequest.current = controller
    setResult({ state: "checking" })
    try {
      const response = await fetch("/api/shipping/product-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ pincode, productId }),
        signal: controller.signal
      })
      const data = await response.json() as {
        ok?: boolean; error?: string; serviceable?: boolean
        estimatedDeliveryDate?: string | null; estimatedTransitDays?: number | null
      }
      if (controller.signal.aborted) return
      if (response.ok && data.ok && data.serviceable === true) {
        setResult({
          state: "serviceable",
          estimatedDeliveryDate: typeof data.estimatedDeliveryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.estimatedDeliveryDate) ? data.estimatedDeliveryDate : null,
          estimatedTransitDays: typeof data.estimatedTransitDays === "number" && Number.isInteger(data.estimatedTransitDays) && data.estimatedTransitDays >= 1 && data.estimatedTransitDays <= 30 ? data.estimatedTransitDays : null
        })
        return
      }
      if (data.error === "NOT_SERVICEABLE") {
        setResult({ state: "not-serviceable" })
        return
      }
      if (data.error === "RATE_LIMITED") {
        setResult({ state: "error", message: "Too many checks. Try again shortly." })
        return
      }
      setResult({ state: "error", message: "We couldn’t verify delivery right now. Please try again." })
    } catch {
      if (!controller.signal.aborted) setResult({ state: "error", message: "Couldn’t reach the delivery service. Please try again." })
    }
  }

  return <section className="productPincodeEstimate" aria-labelledby="product-pincode-heading">
    <div className="productPincodeIntro">
      <span aria-hidden="true">⌖</span>
      <div>
        <h2 id="product-pincode-heading">Check delivery to your PIN code</h2>
        <p>Verify availability before adding your address at checkout.</p>
      </div>
    </div>
    <form className="productPincodeForm" onSubmit={(event) => void check(event)}>
      <label className="productPincodeLabel" htmlFor="product-delivery-pincode">Delivery PIN code</label>
      <div className="productPincodeInputs">
        <input
          id="product-delivery-pincode"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          pattern="[0-9]{6}"
          value={pincode}
          placeholder="6-digit PIN code"
          onChange={(event) => edit(event.target.value)}
          aria-describedby="product-pincode-result"
        />
        <button type="submit" disabled={result.state === "checking" || pincode.length !== 6}>
          {result.state === "checking" ? "Checking…" : "Check delivery"}
        </button>
      </div>
    </form>
    <div id="product-pincode-result" className={"productPincodeResult productPincodeResult--" + result.state} role="status" aria-live="polite">
      {result.state === "checking" && "Checking delivery availability…"}
      {result.state === "not-serviceable" && "Delivery isn’t available to this PIN code through our current shipping service."}
      {result.state === "error" && result.message}
      {result.state === "serviceable" && <>
        <strong>✓ Delivery available to {pincode}</strong>
        {result.estimatedDeliveryDate
          ? <p>Courier-estimated delivery: {textDate(result.estimatedDeliveryDate)}. This is an estimate, not a guaranteed date. Dispatch timing may affect it.</p>
          : result.estimatedTransitDays
            ? <p>Courier-estimated transit: {result.estimatedTransitDays} {result.estimatedTransitDays === 1 ? "day" : "days"} after dispatch. The dispatch date is not confirmed yet.</p>
            : <p>A reliable delivery date isn’t available from the courier yet. We’ll show tracking updates once your order ships.</p>}
        <small>Availability is checked again at checkout and may change.</small>
      </>}
    </div>
  </section>
}
