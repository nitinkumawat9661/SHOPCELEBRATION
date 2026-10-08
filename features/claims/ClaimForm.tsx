"use client"

import { useState } from "react"
import { routes } from "../../config/routes"
import { supportWhatsappUrl } from "../../lib/domain/support"
import { useStoreSettings } from "../shell/useStoreSettings"

type VerifiedOrder = {
  publicId: string
  delivered: boolean
  deliveredAt: string | null
  sixMonthGuaranteeActive: boolean
  guaranteeEndsAt: string | null
}

export function ClaimForm() {
  const settings = useStoreSettings()
  const [orderId, setOrderId] = useState("")
  const [phone, setPhone] = useState("")
  const [claimType, setClaimType] = useState("6-month anti-tarnish guarantee")
  const [details, setDetails] = useState("")
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [verified, setVerified] = useState<VerifiedOrder | null>(null)

  async function continueClaim(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setVerified(null)
    if (!consent) {
      setError("Confirm the declaration before continuing to WhatsApp.")
      return
    }
    setBusy(true)
    try {
      const response = await fetch(routes.api.claimVerify, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderId.trim().toUpperCase(), phone })
      })
      const data = await response.json() as { ok?: boolean; order?: VerifiedOrder; error?: string }
      if (!response.ok || !data.ok || !data.order) {
        throw new Error(data.error === "RATE_LIMITED" ? "Too many attempts. Try again shortly." : "Order ID and mobile number could not be matched.")
      }
      setVerified(data.order)
      const guaranteeLine = data.order.delivered
        ? data.order.sixMonthGuaranteeActive
          ? `6-month guarantee window: active until ${new Date(data.order.guaranteeEndsAt!).toLocaleDateString("en-IN")}`
          : "6-month commercial guarantee window appears to have ended; please review any other applicable product/consumer remedy."
        : "Order is not marked delivered yet; please review the claim manually."
      const message = [
        "Hi Celebration, I want to raise a product claim.",
        `Order ID: ${data.order.publicId}`,
        `Registered mobile: +91 ${phone.replace(/\D/g, "").slice(-10)}`,
        `Claim type: ${claimType}`,
        guaranteeLine,
        details.trim() ? `Details: ${details.trim()}` : "",
        "I confirm I am the buyer/authorised recipient and consent to sharing these claim details with Celebration on WhatsApp."
      ].filter(Boolean).join("\n")
      window.open(supportWhatsappUrl(message, settings.whatsapp), "_blank", "noopener,noreferrer")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Claim verification is temporarily unavailable.")
    } finally {
      setBusy(false)
    }
  }

  return <div className="customerAuthCard">
    <div className="customerAuthIntro">
      <div className="kicker">RAISE A CLAIM</div>
      <h2>Verify your order, then continue on WhatsApp</h2>
      <p>Use this for anti-tarnish, finish or other product-quality claims. We verify the order first so support receives the correct reference.</p>
    </div>
    <form className="customerAuthForm" onSubmit={continueClaim}>
      <label className="field"><span>Order ID <b className="requiredMark">*</b></span><input className="control" value={orderId} required maxLength={80} onChange={(event) => setOrderId(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} placeholder="Your Celebration order number" /></label>
      <label className="field"><span>Mobile number used for the order <b className="requiredMark">*</b></span><input className="control" inputMode="tel" value={phone} required onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 13))} placeholder="10-digit mobile" /></label>
      <label className="field"><span>Claim type</span><select className="control" value={claimType} onChange={(event) => setClaimType(event.target.value)}><option>6-month anti-tarnish guarantee</option><option>Product defect / finish issue</option><option>Other product-quality concern</option></select></label>
      <label className="field"><span>What happened? <small className="optionalLabel">optional</small></span><textarea className="control" rows={4} maxLength={500} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Briefly describe the issue. You can send photos/video on WhatsApp next." /></label>
      <label className="policyCheck"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I confirm that I am the buyer or authorised recipient for this order, and I consent to opening WhatsApp with my order number, mobile number and claim details prefilled for Celebration support.</span></label>
      {error && <div className="errorBox" role="alert">{error}</div>}
      {verified && <div className="successBox"><b>Order verified ✓</b><span>{verified.delivered && verified.sixMonthGuaranteeActive ? "The six-month guarantee window is currently active." : "WhatsApp support has been opened for manual review."}</span></div>}
      <button className="primary fullWidth" type="submit" disabled={busy || !consent}>{busy ? "Verifying order…" : "Verify & continue on WhatsApp"}</button>
    </form>
  </div>
}
