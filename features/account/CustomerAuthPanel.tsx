"use client"

import { useEffect, useState } from "react"
import { supportWhatsappUrl } from "../../lib/domain/support"
import { useStoreSettings } from "../shell/useStoreSettings"
import type { CustomerAccountView } from "./useCustomerAccount"

type Mode = "login" | "signup"
type Screen = "auth" | "forgot-phone" | "forgot-otp" | "forgot-password"

type ResetRequest = { requestId: string; expiresInSeconds: number; resendAfterSeconds: number }

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
  AUTH_FAILED: "We couldn’t continue. Please check your details and try again.",
  SMS_OTP_UNAVAILABLE: "SMS OTP is being configured right now. Please try again shortly.",
  PASSWORD_RESET_UNAVAILABLE: "Password reset is temporarily unavailable. Please try again shortly.",
  INVALID_OTP: "That OTP is incorrect or expired. Check the SMS and try again.",
  RESET_SESSION_EXPIRED: "This reset session has expired. Request a fresh OTP."
}

export function CustomerAuthPanel({
  busy,
  error,
  initialPhone = "",
  initialName = "",
  autoFocusPhone = false,
  onAuthenticate,
  onRequestPasswordReset,
  onVerifyPasswordReset,
  onCompletePasswordReset,
  onSuccess,
  onClearError
}: {
  busy: boolean
  error: string
  initialPhone?: string
  initialName?: string
  autoFocusPhone?: boolean
  onAuthenticate: (mode: Mode, values: { phone: string; password: string; displayName?: string }) => Promise<CustomerAccountView | null>
  onRequestPasswordReset: (phone: string) => Promise<ResetRequest | null>
  onVerifyPasswordReset: (phone: string, requestId: string, otp: string) => Promise<string | null>
  onCompletePasswordReset: (resetToken: string, password: string) => Promise<CustomerAccountView | null>
  onSuccess?: (account: CustomerAccountView) => void
  onClearError?: () => void
}) {
  const settings = useStoreSettings()
  const [mode, setMode] = useState<Mode>("login")
  const [screen, setScreen] = useState<Screen>("auth")
  const [phone, setPhone] = useState(initialPhone)
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState(initialName)
  const [showPassword, setShowPassword] = useState(false)
  const [requestId, setRequestId] = useState("")
  const [otp, setOtp] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [resendIn, setResendIn] = useState(0)
  const [localError, setLocalError] = useState("")

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setInterval(() => setResendIn((value) => Math.max(value - 1, 0)), 1000)
    return () => window.clearInterval(timer)
  }, [resendIn > 0])

  function clearErrors() {
    setLocalError("")
    onClearError?.()
  }

  function changeMode(next: Mode) {
    setMode(next)
    setScreen("auth")
    setPassword("")
    setShowPassword(false)
    clearErrors()
  }

  function startForgotPassword() {
    setScreen("forgot-phone")
    setOtp("")
    setRequestId("")
    setResetToken("")
    setNewPassword("")
    setConfirmPassword("")
    clearErrors()
  }

  function backToLogin() {
    setScreen("auth")
    setMode("login")
    setPassword("")
    clearErrors()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const account = await onAuthenticate(mode, { phone, password, displayName: mode === "signup" ? displayName : undefined })
    if (account) onSuccess?.(account)
  }

  async function sendOtp(event?: React.FormEvent) {
    event?.preventDefault()
    clearErrors()
    const result = await onRequestPasswordReset(phone)
    if (!result) return
    setRequestId(result.requestId)
    setResendIn(result.resendAfterSeconds)
    setOtp("")
    setScreen("forgot-otp")
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault()
    clearErrors()
    const token = await onVerifyPasswordReset(phone, requestId, otp)
    if (!token) return
    setResetToken(token)
    setScreen("forgot-password")
  }

  async function saveNewPassword(event: React.FormEvent) {
    event.preventDefault()
    clearErrors()
    if (newPassword.length < 8) {
      setLocalError("Use at least 8 characters for your new password.")
      return
    }
    if (newPassword !== confirmPassword) {
      setLocalError("New passwords do not match.")
      return
    }
    const account = await onCompletePasswordReset(resetToken, newPassword)
    if (account) onSuccess?.(account)
  }

  const friendlyError = localError || (error ? errorCopy[error] || "We couldn’t continue. Please check your details and try again." : "")

  if (screen === "forgot-phone") {
    return (
      <div className="customerAuthCard customerResetCard">
        <div className="customerAuthIntro"><div className="kicker">PASSWORD RECOVERY</div><h2>Reset your password</h2><p>Enter the mobile number linked to your Celebration account. We’ll send a 6-digit OTP by SMS.</p></div>
        <form className="customerAuthForm" onSubmit={sendOtp}>
          <label className="field"><span>Mobile number <b className="requiredMark">*</b></span><input className="control" inputMode="tel" autoComplete="tel" value={phone} required onChange={(event) => { setPhone(event.target.value.replace(/\D/g, "").slice(0, 13)); clearErrors() }} placeholder="10-digit mobile" /></label>
          {friendlyError && <div className="errorBox" role="alert">{friendlyError}</div>}
          <button className="primary fullWidth" disabled={busy} type="submit">{busy ? "Sending OTP…" : "Send SMS OTP"}</button>
          <button className="authTextButton" type="button" onClick={backToLogin}>← Back to login</button>
        </form>
      </div>
    )
  }

  if (screen === "forgot-otp") {
    return (
      <div className="customerAuthCard customerResetCard">
        <div className="customerAuthIntro"><div className="kicker">VERIFY MOBILE</div><h2>Enter the SMS OTP</h2><p>We sent a 6-digit code to <b>+91 {phone.slice(-10)}</b>. The code expires in 10 minutes.</p></div>
        <form className="customerAuthForm" onSubmit={verifyOtp}>
          <label className="field"><span>6-digit OTP <b className="requiredMark">*</b></span><input className="control otpControl" inputMode="numeric" autoComplete="one-time-code" value={otp} required maxLength={6} pattern="[0-9]{6}" onChange={(event) => { setOtp(event.target.value.replace(/\D/g, "").slice(0, 6)); clearErrors() }} placeholder="••••••" /></label>
          {friendlyError && <div className="errorBox" role="alert">{friendlyError}</div>}
          <button className="primary fullWidth" disabled={busy || otp.length !== 6} type="submit">{busy ? "Verifying…" : "Verify OTP"}</button>
          <div className="resetResendRow"><span>Didn’t get it?</span><button className="authTextButton" type="button" disabled={busy || resendIn > 0} onClick={() => void sendOtp()}>{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}</button></div>
          <button className="authTextButton" type="button" onClick={() => setScreen("forgot-phone")}>← Change mobile number</button>
        </form>
      </div>
    )
  }

  if (screen === "forgot-password") {
    return (
      <div className="customerAuthCard customerResetCard">
        <div className="customerAuthIntro"><div className="kicker">NEW PASSWORD</div><h2>Create a new password</h2><p>Your mobile number is verified. Choose a new password; other logged-in sessions will be signed out.</p></div>
        <form className="customerAuthForm" onSubmit={saveNewPassword}>
          <label className="field"><span>New password <b className="requiredMark">*</b></span><input className="control" type="password" minLength={8} maxLength={72} autoComplete="new-password" value={newPassword} required onChange={(event) => { setNewPassword(event.target.value); clearErrors() }} placeholder="Minimum 8 characters" /></label>
          <label className="field"><span>Confirm new password <b className="requiredMark">*</b></span><input className="control" type="password" minLength={8} maxLength={72} autoComplete="new-password" value={confirmPassword} required onChange={(event) => { setConfirmPassword(event.target.value); clearErrors() }} placeholder="Enter it again" /></label>
          {friendlyError && <div className="errorBox" role="alert">{friendlyError}</div>}
          <button className="primary fullWidth" disabled={busy} type="submit">{busy ? "Resetting password…" : "Reset password & continue"}</button>
        </form>
      </div>
    )
  }

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
        {mode === "signup" && <label className="field"><span>Your name <b className="requiredMark">*</b></span><input className="control" value={displayName} required minLength={2} maxLength={80} autoComplete="name" onChange={(event) => { setDisplayName(event.target.value); clearErrors() }} placeholder="Full name" /></label>}
        <label className="field"><span>Mobile number <b className="requiredMark">*</b></span><input className="control" inputMode="tel" autoComplete="tel" value={phone} required autoFocus={autoFocusPhone} onChange={(event) => { setPhone(event.target.value.replace(/\D/g, "").slice(0, 13)); clearErrors() }} placeholder="10-digit mobile" /></label>
        <label className="field"><span>Password <b className="requiredMark">*</b></span><div className="passwordControlWrap"><input className="control" type={showPassword ? "text" : "password"} minLength={8} maxLength={72} required autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => { setPassword(event.target.value); clearErrors() }} placeholder="Minimum 8 characters" /><button className="passwordToggle" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div></label>
        {mode === "login" && <div className="forgotPasswordRow"><button className="authTextButton" type="button" onClick={startForgotPassword}>Forgot password?</button></div>}
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
