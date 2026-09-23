"use client"

import { FormEvent, useState } from "react"
import { supportWhatsappUrl } from "../../lib/domain/support"
import { useStoreSettings } from "../shell/useStoreSettings"
import { notifyUx, scrollToUxTarget } from "../ux/UxMessenger"

export function CustomRequestSection() {
  const settings = useStoreSettings()
  const [customerName, setCustomerName] = useState("")
  const [phone, setPhone] = useState("")
  const [budget, setBudget] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setNotice("")
    setError("")
    try {
      const response = await fetch("/api/custom-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, phone, budget: Number(budget), message })
      })
      const data = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !data.ok) throw new Error(data.error || "REQUEST_FAILED")
      const success = "Got it. We’ll review your budget and preferences and contact you with a suitable option."
      setNotice(success)
      setCustomerName("")
      setPhone("")
      setBudget("")
      setMessage("")
      notifyUx({ title: "Request received ✓", body: "We’ll help you find a hamper that fits your budget.", tone: "success", durationMs: 4200 })
      window.setTimeout(() => scrollToUxTarget(document.querySelector("#custom-request .successBox"), "center"), 80)
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "REQUEST_FAILED"
      const failure = code === "RATE_LIMITED" ? "Too many requests. Please try again shortly." : "We couldn’t send your request. Check the details and try again."
      setError(failure)
      notifyUx({ title: "Request not sent", body: failure, tone: "error" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="customRequestSection" id="custom-request">
      <div className="wrap">
        <div className="centerHead">
          <div className="kicker">YOUR BUDGET • YOUR STYLE</div>
          <h2>Have a budget in mind? We’ll help you build around it.</h2>
          <p>Tell us the occasion, budget and the kind of gifts you want. We’ll suggest a mix that feels right before you decide.</p>
        </div>
        <form className="customRequestCard" onSubmit={submit}>
          <div className="customRequestGrid">
            <label>Your name <b className="requiredMark">*</b><input required minLength={2} maxLength={80} value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" /></label>
            <label>Mobile / WhatsApp <b className="requiredMark">*</b><input required inputMode="numeric" minLength={10} maxLength={13} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} autoComplete="tel" /></label>
            <label>Your budget (₹) <b className="requiredMark">*</b><input required type="number" min={0} max={1000000} step={1} value={budget} onChange={(event) => setBudget(event.target.value)} /></label>
          </div>
          <label>What should the hamper feel like? <b className="requiredMark">*</b><textarea required minLength={10} maxLength={1200} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Example: ₹1200, birthday, blue theme, chocolates + mug + photo item, no perfume." /></label>
          <div className="customRequestFooter">
            <span className="tiny">We’ll confirm the final mix, price and delivery before you commit.</span>
            <div className="customRequestActions"><a className="secondary" href={supportWhatsappUrl("Hi Celebration, I need help building a hamper within my budget.", settings.whatsapp)} target="_blank" rel="noreferrer">Ask on WhatsApp</a><button className="primary" disabled={busy}>{busy ? "Sending…" : "Get a suggestion"}</button></div>
          </div>
          {notice && <div className="successBox" role="status">{notice}</div>}
          {error && <div className="errorBox" role="alert">{error}</div>}
        </form>
      </div>
    </section>
  )
}
