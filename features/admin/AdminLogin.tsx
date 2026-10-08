"use client"

import { useEffect, useState } from "react"
import { uiContent } from "../../lib/domain/content"
import { routes } from "../../config/routes"
import { authenticateAdminPasskey } from "./passkey-client"

type LoginMode = "loading" | "passkey" | "bootstrap-password" | "error"

function friendlyPasskeyError(code: string) {
  if (code === "PASSKEY_NOT_SUPPORTED") return "This browser does not support passkeys. Use current Chrome, Safari or Edge."
  if (code.includes("CANCEL") || code === "NotAllowedError") return "Passkey sign-in was cancelled or timed out."
  if (code === "RATE_LIMITED") return "Too many sign-in attempts. Try again later."
  return "Passkey sign-in failed. Use the registered phone/passkey and try again."
}

export function AdminLogin() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<LoginMode>("loading")
  const copy = uiContent.admin

  useEffect(() => {
    let active = true
    fetch(routes.api.adminPasskeyStatus, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { ok?: boolean; enabled?: boolean }
        if (!active) return
        if (!response.ok || !data.ok || typeof data.enabled !== "boolean") {
          setMode("error")
          return
        }
        setMode(data.enabled ? "passkey" : "bootstrap-password")
      })
      .catch(() => { if (active) setMode("error") })
    return () => { active = false }
  }, [])

  async function passwordLogin(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setLoading(true)
    try {
      const response = await fetch(routes.api.adminLogin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      })
      const result = await response.json() as { ok?: boolean; error?: string }
      if (result.error === "PASSKEY_REQUIRED") {
        setMode("passkey")
        throw new Error("PASSKEY_REQUIRED")
      }
      if (!response.ok || !result.ok) throw new Error(result.error || "LOGIN_FAILED")
      window.location.reload()
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "LOGIN_FAILED"
      setError(code === "PASSKEY_REQUIRED" ? "Password login is disabled. Use your registered passkey." : "Invalid admin password.")
    } finally {
      setLoading(false)
    }
  }

  async function passkeyLogin() {
    setLoading(true)
    setError("")
    try {
      const optionsResponse = await fetch(routes.api.adminPasskeyAuthOptions, { method: "POST" })
      const optionsData = await optionsResponse.json() as { ok?: boolean; options?: Parameters<typeof authenticateAdminPasskey>[0]; error?: string }
      if (!optionsResponse.ok || !optionsData.ok || !optionsData.options) throw new Error(optionsData.error || "PASSKEY_LOGIN_UNAVAILABLE")

      const credential = await authenticateAdminPasskey(optionsData.options)
      const verifyResponse = await fetch(routes.api.adminPasskeyAuthVerify, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential)
      })
      const verified = await verifyResponse.json() as { ok?: boolean; error?: string }
      if (!verifyResponse.ok || !verified.ok) throw new Error(verified.error || "PASSKEY_LOGIN_FAILED")
      window.location.reload()
    } catch (cause) {
      const code = cause instanceof DOMException ? cause.name : cause instanceof Error ? cause.message : "PASSKEY_LOGIN_FAILED"
      setError(friendlyPasskeyError(code))
    } finally {
      setLoading(false)
    }
  }

  if (mode === "loading") {
    return <div className="adminLoginCard"><div className="kicker">{copy.title}</div><h1>Checking admin security…</h1></div>
  }

  if (mode === "error") {
    return <div className="adminLoginCard"><div className="kicker">ADMIN SECURITY</div><h1>Admin sign-in unavailable</h1><div className="errorBox">Security status could not be verified, so login is fail-closed. Refresh and try again.</div></div>
  }

  if (mode === "passkey") {
    return <div className="adminLoginCard">
      <div className="kicker">PASSKEY PROTECTED</div>
      <h1>Celebration Admin</h1>
      <p>Use the registered phone passkey. Your phone will require fingerprint, face unlock or device PIN before the cryptographic sign-in can complete.</p>
      {error && <div className="errorBox" role="alert">{error}</div>}
      <button className="primary fullWidth" disabled={loading} type="button" onClick={passkeyLogin}>{loading ? "Verifying…" : "Use phone passkey"}</button>
      <small>No password fallback is available after passkey enrollment.</small>
    </div>
  }

  return (
    <form className="adminLoginCard" onSubmit={passwordLogin}>
      <div className="kicker">FIRST-TIME ADMIN SETUP</div>
      <h1>{copy.login}</h1>
      <p>Enter the existing admin password once. The next screen will require you to create the first phone passkey; after that, password login is permanently disabled until a server-side recovery reset.</p>
      <label className="field"><span>{copy.password}</span><input className="control" required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
      {error && <div className="errorBox" role="alert">{error}</div>}
      <button className="primary fullWidth" disabled={loading} type="submit">{loading ? "…" : "Continue to passkey setup"}</button>
    </form>
  )
}
