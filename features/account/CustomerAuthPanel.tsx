"use client"

import { useState } from "react"
import { supportWhatsappUrl } from "../../lib/domain/support"
import { useStoreSettings } from "../shell/useStoreSettings"
import type { CustomerAccountView } from "./useCustomerAccount"

type Mode = "login" | "signup"

const errorCopy: Record<string, string> = {
  INVALID_PHONE: "Please check your mobile number.",
  INVALID_PASSWORD: "Use at least 8 characters for your password.",
  INVALID_CREDENTIALS: "Mobile number or password doesn’t match.",
  INVALID_NAME: "Please enter your name.",
  ACCOUNT_EXISTS: "An account already exists with this mobile number. Try login instead.",
  RATE_LIMITED: "Too many attempts. Please try again shortly.",
  UNSAFE_TEXT: "Please remove unsupported characters and try again.",
  ACCOUNT_SERVICE_UNAVAILABLE: "Login is temporarily unavailable. Please try again.",
  ACCOUNT_LOAD_FAILED: "We couldn’t load your account. Check your connection and try again.",
  AUTH_FAILED: "We couldn’t continue. Please check your details and try again."
}

export function CustomerAuthPanel({
  busy,
  error,
  initialPhone = "",
  initialName = "",
  autoFocusPhone = false,
  onAuthenticate,
  onSuccess,
  onClearError
}: {
  busy: boolean
  error: string
  initialPhone?: string
  initialName?: string
  autoFocusPhone?: boolean
  onAuthenticate: (mode: Mode, values: { phone: string; password: string; displayName?: string }) => Promise<CustomerAccountView | null>
  onSuccess?: (account: CustomerAccountView) => void
  onClearError?: () => void
}) {
  const settings = useStoreSettings()
  const [mode, setMode] = useState<Mode>("login")
  const [phone, setPhone] = useState(initialPhone)
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState(initialName)
  const [showPassword, setShowPassword] = useState(false)

  function changeMode(next: Mode) {
    setMode(next)
    setPassword("")
    setShowPassword(false)
    onClearError?.()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const account = await onAuthenticate(mode, { phone, password, displayName: mode === "signup" ? displayName : undefined })
    if (account) onSuccess?.(account)
  }

  const friendlyError = error ? errorCopy[error] || "We couldn’t continue. Please check your details and try again." : ""

  return (
    <div className="customerAuthCard">
      <div className="customerAuthIntro">
        <div className="kicker">MY CELEBRATION</div>
        <h2>{mode === "login" ? "Welcome back" : "Create your Celebration account"}</h2>
        <p>{mode === "login" ? "Login to place your order and keep all updates in one place." : "Save your orders, packing updates and shipping details in one simple dashboard."}</p>
      </div>

      <div className="customerAuthTabs" role="tablist" aria-label="Login or create account">
        <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Login</button>
        <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Create account</button>
      </div>

      <form className="customerAuthForm" onSubmit={submit}>
        {mode === "signup" && <label className="field"><span>Your name <b className="requiredMark">*</b></span><input className="control" value={displayName} required minLength={2} maxLength={80} autoComplete="name" onChange={(event) => { setDisplayName(event.target.value); onClearError?.() }} placeholder="Full name" /></label>}
        <label className="field"><span>Mobile number <b className="requiredMark">*</b></span><input className="control" inputMode="tel" autoComplete="tel" value={phone} required autoFocus={autoFocusPhone} onChange={(event) => { setPhone(event.target.value.replace(/\D/g, "").slice(0, 13)); onClearError?.() }} placeholder="10-digit mobile" /></label>
        <label className="field"><span>Password <b className="requiredMark">*</b></span><div className="passwordControlWrap"><input className="control" type={showPassword ? "text" : "password"} minLength={8} maxLength={72} required autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => { setPassword(event.target.value); onClearError?.() }} placeholder="Minimum 8 characters" /><button className="passwordToggle" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div></label>
        {friendlyError && <div className="errorBox" role="alert">{friendlyError}</div>}
        <button className="primary fullWidth" disabled={busy} type="submit">{busy ? (mode === "login" ? "Signing in…" : "Creating account…") : mode === "login" ? "Login & continue" : "Create account & continue"}</button>
      </form>

      <div className="customerAuthHelp">
        <span>Need help?</span>
        <a href={supportWhatsappUrl("Hi Celebration, I need help with my account.", settings.whatsapp)} target="_blank" rel="noreferrer">Chat on WhatsApp</a>
      </div>
      <small className="customerAuthPrivacy">Your order updates stay inside your Celebration account.</small>
    </div>
  )
}
