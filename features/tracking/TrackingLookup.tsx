"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import { routes } from "../../config/routes"
import { validation } from "../../config/validation"
import { uiContent } from "../../lib/domain/content"
import { notifyUx } from "../ux/UxMessenger"

export function TrackingLookup() {
  const copy = uiContent.tracking
  const [orderId, setOrderId] = useState("")
  const [phoneLastDigits, setPhoneLastDigits] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const cleanOrderId = orderId.trim().toUpperCase()
    const cleanDigits = phoneLastDigits.replace(/\D/g, "").slice(-validation.trackingLookupPhoneDigits)

    if (!cleanOrderId || cleanDigits.length !== validation.trackingLookupPhoneDigits) {
      setError(copy.lookupValidation)
      notifyUx({ title: "Tracking details check karein", body: copy.lookupValidation, tone: "error" })
      return
    }

    setBusy(true)
    try {
      const response = await fetch(routes.api.trackingLookup, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: cleanOrderId, phoneLastDigits: cleanDigits })
      })
      const result = await response.json() as { ok?: boolean; error?: string; trackingPath?: string }
      if (!response.ok || !result.ok || !result.trackingPath) throw new Error(copy.lookupFailed)
      notifyUx({ title: "Order mil gaya ✓", body: "Latest tracking status khul raha hai.", tone: "success", durationMs: 1800 })
      window.location.assign(result.trackingPath)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : copy.lookupFailed
      setError(message)
      notifyUx({ title: "Order track nahi hua", body: message, tone: "error" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="trackingLookup" onSubmit={submit}>
      <div className="trackingLookupHead">
        <h1>{copy.lookupTitle}</h1>
        <p>{copy.lookupBody}</p>
      </div>
      <div className="trackingLookupGrid">
        <label className="field">
          <span>{copy.lookupOrderId} <b className="requiredMark">*</b></span>
          <input
            value={orderId}
            onChange={(event) => { setOrderId(event.target.value); setError("") }}
            placeholder={copy.lookupOrderPlaceholder}
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={validation.publicOrderIdMax}
          />
        </label>
        <label className="field">
          <span>{copy.lookupPhonePrefix} {validation.trackingLookupPhoneDigits} {copy.lookupPhoneSuffix} <b className="requiredMark">*</b></span>
          <input
            value={phoneLastDigits}
            onChange={(event) => { setPhoneLastDigits(event.target.value.replace(/\D/g, "").slice(0, validation.trackingLookupPhoneDigits)); setError("") }}
            placeholder={"•".repeat(validation.trackingLookupPhoneDigits)}
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={validation.trackingLookupPhoneDigits}
          />
        </label>
      </div>
      {error && <div className="errorBox" role="alert">{error}</div>}
      <button className="primary fullWidth" type="submit" disabled={busy}>
        {busy ? copy.lookupBusy : copy.lookupButton}
      </button>
      <p className="trackingLookupPrivacy">{copy.lookupPrivacy}</p>
    </form>
  )
}
