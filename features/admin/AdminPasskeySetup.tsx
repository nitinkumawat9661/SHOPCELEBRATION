"use client"

import { useState } from "react"
import { routes } from "../../config/routes"
import { createAdminPasskey } from "./passkey-client"

function message(code: string) {
  if (code === "PASSKEY_NOT_SUPPORTED") return "This browser does not support passkeys. Open /admin in current Chrome, Safari or Edge on your phone."
  if (code.includes("CANCEL")) return "Passkey setup was cancelled. Try again when your phone is ready."
  return "Passkey setup could not be completed. Try again."
}

export function AdminPasskeySetup() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function enroll() {
    setBusy(true)
    setError("")
    try {
      const optionsResponse = await fetch(routes.api.adminPasskeyRegisterOptions, { method: "POST" })
      const optionsData = await optionsResponse.json() as { ok?: boolean; options?: Parameters<typeof createAdminPasskey>[0]; error?: string }
      if (!optionsResponse.ok || !optionsData.ok || !optionsData.options) throw new Error(optionsData.error || "PASSKEY_SETUP_UNAVAILABLE")

      const credential = await createAdminPasskey(optionsData.options)
      const verifyResponse = await fetch(routes.api.adminPasskeyRegisterVerify, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential)
      })
      const verified = await verifyResponse.json() as { ok?: boolean; error?: string }
      if (!verifyResponse.ok || !verified.ok) throw new Error(verified.error || "PASSKEY_REGISTRATION_FAILED")
      window.location.reload()
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "PASSKEY_REGISTRATION_FAILED"
      setError(message(code))
    } finally {
      setBusy(false)
    }
  }

  return <div className="adminLoginCard">
    <div className="kicker">ADMIN SECURITY</div>
    <h1>Create your phone passkey</h1>
    <p>Open this page on your phone for the cleanest setup. Your fingerprint, face unlock or phone PIN will protect the Celebration admin. After this succeeds, password login is disabled.</p>
    <div className="policyNotice"><strong>No password fallback after setup</strong><span>If you lose every registered passkey, recovery requires a deliberate server-side reset. This prevents a public “forgot password” route from becoming a bypass.</span></div>
    {error && <div className="errorBox" role="alert">{error}</div>}
    <button className="primary fullWidth" type="button" disabled={busy} onClick={enroll}>{busy ? "Creating passkey…" : "Create phone passkey"}</button>
  </div>
}
