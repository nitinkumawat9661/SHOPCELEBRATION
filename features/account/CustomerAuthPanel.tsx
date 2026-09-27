"use client"

import { useEffect, useState } from "react"
import { routes } from "../../config/routes"
import { supportWhatsappUrl } from "../../lib/domain/support"
import { useStoreSettings } from "../shell/useStoreSettings"
import type { CustomerAccountView } from "./useCustomerAccount"

type Mode = "login" | "signup"
type Screen = "auth" | "forgot-phone" | "forgot-otp" | "forgot-password"
type ResetRequest = { widgetId: string; tokenAuth: string; expiresInSeconds: number; resendAfterSeconds: number }
type Msg91Callback = (value: unknown) => void

declare global {
  interface Window {
    initSendOTP?: (configuration: {
      widgetId: string
      tokenAuth: string
      identifier?: string
      exposeMethods: boolean
      captchaRenderId?: string
      success?: Msg91Callback
      failure?: Msg91Callback
    }) => void
    sendOtp?: (identifier: string, success?: Msg91Callback, failure?: Msg91Callback) => void
    retryOtp?: (channel: string | null, success?: Msg91Callback, failure?: Msg91Callback, reqId?: string) => void
    verifyOtp?: (otp: number | string, success?: Msg91Callback, failure?: Msg91Callback, reqId?: string) => void
    isCaptchaVerified?: () => boolean
  }
}

const errorCopy: Record<string, string> = {
  INVALID_PHONE: "Please check your mobile number.",
  INVALID_PASSWORD: "Use at least 8 characters for your password.",
  INVALID_CREDENTIALS: "Mobile number or password doesn’t match.",
  INVALID_NAME: "Please enter your name.",
  ACCOUNT_EXISTS: "An account already exists with this mobile number. Try login instead.",
  ACCOUNT_NOT_FOUND: "No Celebration account was found for this mobile number. Create an account instead.",
  RATE_LIMITED: "Too many attempts. Please try again shortly.",
  UNSAFE_TEXT: "Please remove unsupported characters and try again.",
  ACCOUNT_SERVICE_UNAVAILABLE: "Login is temporarily unavailable. Please try again.",
  ACCOUNT_LOAD_FAILED: "We couldn’t load your account. Check your connection and try again.",
  AUTH_FAILED: "We couldn’t continue. Please check your details and try again.",
  SMS_OTP_UNAVAILABLE: "SMS OTP is temporarily unavailable. Please try again shortly.",
  PASSWORD_RESET_UNAVAILABLE: "Password reset is temporarily unavailable. Please try again shortly.",
  INVALID_OTP: "That OTP is incorrect or expired. Check the SMS and try again.",
  RESET_SESSION_EXPIRED: "This reset session has expired. Request a fresh OTP."
}

let msg91ScriptPromise: Promise<void> | null = null

function loadMsg91Sdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("SMS_OTP_UNAVAILABLE"))
  if (window.initSendOTP) return Promise.resolve()
  if (msg91ScriptPromise) return msg91ScriptPromise

  msg91ScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("msg91-otp-provider") as HTMLScriptElement | null
    const onReady = () => window.initSendOTP ? resolve() : reject(new Error("SMS_OTP_UNAVAILABLE"))
    const onError = () => reject(new Error("SMS_OTP_UNAVAILABLE"))

    if (existing) {
      existing.addEventListener("load", onReady, { once: true })
      existing.addEventListener("error", onError, { once: true })
      window.setTimeout(onReady, 100)
      return
    }

    const script = document.createElement("script")
    script.id = "msg91-otp-provider"
    script.src = "https://verify.msg91.com/otp-provider.js"
    script.async = true
    script.addEventListener("load", onReady, { once: true })
    script.addEventListener("error", onError, { once: true })
    document.head.appendChild(script)
  }).catch((error) => {
    msg91ScriptPromise = null
    throw error
  })

  return msg91ScriptPromise
}

async function waitForMsg91Methods() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (window.sendOtp && window.retryOtp && window.verifyOtp) return
    await new Promise((resolve) => window.setTimeout(resolve, 50))
  }
  throw new Error("SMS_OTP_UNAVAILABLE")
}

function normalizeIndianMobile(value: string) {
  const digits = value.replace(/\D/g, "")
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits
  if (!/^\d{10}$/.test(local)) throw new Error("INVALID_PHONE")
  return local
}

function nestedString(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return ""
  let current: unknown = value
  for (const key of keys) {
    if (!current || typeof current !== "object") return ""
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === "string" ? current.trim() : ""
}

function directString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function extractReqId(value: unknown) {
  return nestedString(value, ["reqId"]) ||
    nestedString(value, ["req_id"]) ||
    nestedString(value, ["requestId"]) ||
    nestedString(value, ["data", "reqId"]) ||
    nestedString(value, ["data", "req_id"]) ||
    nestedString(value, ["data", "requestId"]) ||
    nestedString(value, ["message"]) ||
    nestedString(value, ["data", "message"]) ||
    directString(value)
}

function extractAccessToken(value: unknown) {
  const token = nestedString(value, ["access-token"]) ||
    nestedString(value, ["accessToken"]) ||
    nestedString(value, ["access_token"]) ||
    nestedString(value, ["token"]) ||
    nestedString(value, ["data", "access-token"]) ||
    nestedString(value, ["data", "accessToken"]) ||
    nestedString(value, ["data", "access_token"]) ||
    nestedString(value, ["data", "token"]) ||
    nestedString(value, ["message"]) ||
    nestedString(value, ["data", "message"]) ||
    directString(value)
  return token.length >= 20 && token.length <= 8000 ? token : ""
}

function safeProviderReason(value: unknown) {
  const candidates = [
    typeof value === "string" ? value : "",
    nestedString(value, ["code"]),
    nestedString(value, ["errorCode"]),
    nestedString(value, ["message"]),
    nestedString(value, ["error"]),
    nestedString(value, ["data", "code"]),
    nestedString(value, ["data", "errorCode"]),
    nestedString(value, ["data", "message"]),
    nestedString(value, ["data", "error"])
  ]

  for (const candidate of candidates) {
    if (!candidate || /token|auth(?:orization|key)?|jwt|access[-_ ]?token/i.test(candidate)) continue
    const safe = candidate.replace(/[^a-zA-Z0-9 .:_-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 96)
    if (safe) return safe
  }
  return ""
}

function providerCall(register: (success: Msg91Callback, failure: Msg91Callback) => void, failureCode: string) {
  return new Promise<unknown>((resolve, reject) => {
    try {
      register(resolve, (error) => {
        const reason = error instanceof Error ? safeProviderReason({ message: error.message }) : safeProviderReason(error)
        reject(new Error(reason ? `${failureCode}:${reason}` : failureCode))
      })
    } catch (error) {
      reject(error)
    }
  })
}

function providerSendError(code: string) {
  if (!code.startsWith("SMS_OTP_PROVIDER_FAILED")) return ""
  const reason = code.slice("SMS_OTP_PROVIDER_FAILED".length + 1).trim()
  return reason ? `MSG91 couldn’t send the OTP (${reason}).` : errorCopy.SMS_OTP_UNAVAILABLE
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
  const [screen, setScreen] = useState<Screen>("auth")
  const [phone, setPhone] = useState(initialPhone)
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState(initialName)
  const [showPassword, setShowPassword] = useState(false)
  const [requestId, setRequestId] = useState("")
  const [otp, setOtp] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [verifiedAccessToken, setVerifiedAccessToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [resendIn, setResendIn] = useState(0)
  const [localError, setLocalError] = useState("")
  const [resetBusy, setResetBusy] = useState(false)
  const [widgetReady, setWidgetReady] = useState(false)
  const [captchaVerified, setCaptchaVerified] = useState(false)
  const [resetConfig, setResetConfig] = useState<ResetRequest | null>(null)
  const actionBusy = busy || resetBusy

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setInterval(() => setResendIn((value) => Math.max(value - 1, 0)), 1000)
    return () => window.clearInterval(timer)
  }, [resendIn > 0])

  useEffect(() => {
    if (screen !== "forgot-phone" || !widgetReady) {
      setCaptchaVerified(false)
      return
    }
    const syncCaptchaState = () => setCaptchaVerified(window.isCaptchaVerified?.() === true)
    syncCaptchaState()
    const timer = window.setInterval(syncCaptchaState, 250)
    return () => window.clearInterval(timer)
  }, [screen, widgetReady])

  function clearErrors() {
    setLocalError("")
    onClearError?.()
  }

  function showApiError(code: string) {
    setLocalError(errorCopy[code] || "We couldn’t continue. Please try again.")
  }

  function resetOtpWidget() {
    setWidgetReady(false)
    setCaptchaVerified(false)
    setResetConfig(null)
    setRequestId("")
    setVerifiedAccessToken("")
    if (typeof document !== "undefined") document.getElementById("celebration-msg91-captcha")?.replaceChildren()
  }

  async function fetchResetConfig(targetPhone: string): Promise<ResetRequest | null> {
    const response = await fetch(routes.api.customerPasswordResetRequest, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: targetPhone })
    })
    const data = await response.json() as { ok?: boolean; widgetId?: string; tokenAuth?: string; expiresInSeconds?: number; resendAfterSeconds?: number; error?: string }
    if (!response.ok || !data.ok || !data.widgetId || !data.tokenAuth) {
      showApiError(data.error || "PASSWORD_RESET_UNAVAILABLE")
      return null
    }
    return {
      widgetId: data.widgetId,
      tokenAuth: data.tokenAuth,
      expiresInSeconds: Number(data.expiresInSeconds) || 600,
      resendAfterSeconds: Number(data.resendAfterSeconds) || 45
    }
  }

  async function initializeWidget(config: ResetRequest, targetPhone: string) {
    await loadMsg91Sdk()
    if (!window.initSendOTP) throw new Error("SMS_OTP_UNAVAILABLE")
    window.initSendOTP({
      widgetId: config.widgetId,
      tokenAuth: config.tokenAuth,
      identifier: `91${targetPhone}`,
      exposeMethods: true,
      captchaRenderId: "celebration-msg91-captcha",
      success: () => undefined,
      failure: () => undefined
    })
    await waitForMsg91Methods()
    setCaptchaVerified(false)
    setWidgetReady(true)
  }

  async function verifyAccessToken(targetPhone: string, accessToken: string) {
    const response = await fetch(routes.api.customerPasswordResetVerify, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: targetPhone, accessToken })
    })
    const data = await response.json() as { ok?: boolean; resetToken?: string; error?: string }
    if (!response.ok || !data.ok || !data.resetToken) {
      if (data.error === "INVALID_OTP") {
        setLocalError("OTP was verified, but the secure reset handoff could not finish. Tap Continue securely to retry.")
      } else {
        showApiError(data.error || "PASSWORD_RESET_UNAVAILABLE")
      }
      return null
    }
    return data.resetToken
  }

  async function completeReset(targetToken: string, targetPassword: string) {
    const response = await fetch(routes.api.customerPasswordResetComplete, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetToken: targetToken, password: targetPassword })
    })
    const data = await response.json() as { ok?: boolean; account?: CustomerAccountView; error?: string }
    if (!response.ok || !data.ok || !data.account) {
      showApiError(data.error || "PASSWORD_RESET_UNAVAILABLE")
      return null
    }
    return data.account
  }

  function changeMode(next: Mode) {
    setMode(next)
    setScreen("auth")
    setPassword("")
    setShowPassword(false)
    resetOtpWidget()
    clearErrors()
  }

  function startForgotPassword() {
    setScreen("forgot-phone")
    setOtp("")
    setResetToken("")
    setNewPassword("")
    setConfirmPassword("")
    resetOtpWidget()
    clearErrors()
  }

  function backToLogin() {
    setScreen("auth")
    setMode("login")
    setPassword("")
    resetOtpWidget()
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
    setResetBusy(true)
    try {
      const localPhone = normalizeIndianMobile(phone)
      setPhone(localPhone)

      if (!widgetReady) {
        const config = await fetchResetConfig(localPhone)
        if (!config) return
        setResetConfig(config)
        await initializeWidget(config, localPhone)
        return
      }

      if (!captchaVerified || window.isCaptchaVerified?.() !== true) {
        setCaptchaVerified(false)
        return
      }

      if (!window.sendOtp) throw new Error("SMS_OTP_UNAVAILABLE")
      const result = await providerCall((success, failure) => window.sendOtp?.(`91${localPhone}`, success, failure), "SMS_OTP_PROVIDER_FAILED")
      setRequestId(extractReqId(result))
      setVerifiedAccessToken("")
      setResendIn(resetConfig?.resendAfterSeconds || 45)
      setOtp("")
      setScreen("forgot-otp")
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "SMS_OTP_UNAVAILABLE"
      if (code === "INVALID_PHONE") showApiError(code)
      else setLocalError(providerSendError(code) || errorCopy.SMS_OTP_UNAVAILABLE)
    } finally {
      setResetBusy(false)
    }
  }

  async function resendOtp() {
    clearErrors()
    if (verifiedAccessToken) {
      setLocalError("Your OTP is already verified. Tap Continue securely to finish the reset.")
      return
    }
    setResetBusy(true)
    try {
      if (!widgetReady || !window.retryOtp) throw new Error("SMS_OTP_UNAVAILABLE")
      const result = await providerCall((success, failure) => window.retryOtp?.("11", success, failure, requestId || undefined), "SMS_OTP_PROVIDER_FAILED")
      const nextRequestId = extractReqId(result)
      if (nextRequestId) setRequestId(nextRequestId)
      setResendIn(resetConfig?.resendAfterSeconds || 45)
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "SMS_OTP_UNAVAILABLE"
      setLocalError(providerSendError(code) || errorCopy.SMS_OTP_UNAVAILABLE)
    } finally {
      setResetBusy(false)
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault()
    clearErrors()
    setResetBusy(true)
    try {
      let accessToken = verifiedAccessToken
      if (!accessToken) {
        if (!widgetReady || !window.verifyOtp) throw new Error("INVALID_OTP")
        const result = await providerCall((success, failure) => window.verifyOtp?.(otp, success, failure, requestId || undefined), "INVALID_OTP")
        accessToken = extractAccessToken(result)
        if (!accessToken) throw new Error("INVALID_OTP")
        setVerifiedAccessToken(accessToken)
      }

      const token = await verifyAccessToken(phone, accessToken)
      if (!token) return
      setResetToken(token)
      setScreen("forgot-password")
    } catch (cause) {
      if (verifiedAccessToken) {
        setLocalError("OTP is already verified. Tap Continue securely to finish the reset.")
      } else {
        const reason = cause instanceof Error ? safeProviderReason({ message: cause.message }) : ""
        setLocalError(reason && !/^INVALID_OTP$/i.test(reason) ? `OTP verification failed (${reason}).` : errorCopy.INVALID_OTP)
      }
    } finally {
      setResetBusy(false)
    }
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
    setResetBusy(true)
    try {
      const account = await completeReset(resetToken, newPassword)
      if (account) onSuccess?.(account)
    } finally {
      setResetBusy(false)
    }
  }

  const friendlyError = localError || (error ? errorCopy[error] || "We couldn’t continue. Please check your details and try again." : "")
  let resetPhoneReady = false
  try { normalizeIndianMobile(phone); resetPhoneReady = true } catch { resetPhoneReady = false }

  if (screen === "forgot-phone") {
    return (
      <div className="customerAuthCard customerResetCard">
        <div className="customerAuthIntro"><div className="kicker">PASSWORD RECOVERY</div><h2>Reset your password</h2><p>Enter the mobile number linked to your Celebration account. We’ll send a 6-digit OTP by SMS.</p></div>
        <form className="customerAuthForm" onSubmit={sendOtp}>
          <label className="field"><span>Mobile number <b className="requiredMark">*</b></span><input className="control" inputMode="tel" autoComplete="tel" value={phone} required onChange={(event) => { setPhone(event.target.value.replace(/\D/g, "").slice(0, 13)); resetOtpWidget(); clearErrors() }} placeholder="10-digit mobile" /></label>
          <div className={`resetSecurityCard ${captchaVerified ? "verified" : widgetReady ? "pending" : "idle"}`}>
            <div className="resetSecurityHead">
              <span className="resetSecurityMark" aria-hidden="true">{captchaVerified ? "✓" : "•"}</span>
              <div><b>{captchaVerified ? "Security check complete" : widgetReady ? "Confirm you’re human" : "Secure verification"}</b><small>{captchaVerified ? "Verified — OTP sending is now enabled." : widgetReady ? "Complete the check below to enable OTP." : "Continue once to load the protected check."}</small></div>
            </div>
            <div className={`resetCaptchaViewport ${widgetReady ? "ready" : ""}`}><div id="celebration-msg91-captcha" className="resetCaptcha" aria-live="polite" /></div>
          </div>
          {friendlyError && <div className="errorBox" role="alert">{friendlyError}</div>}
          <button className="primary fullWidth resetOtpButton" disabled={actionBusy || (!widgetReady && !resetPhoneReady) || (widgetReady && !captchaVerified)} type="submit">{actionBusy ? (widgetReady ? "Sending OTP…" : "Preparing security…") : widgetReady ? "Send SMS OTP" : "Continue securely"}</button>
          <button className="authTextButton" type="button" onClick={backToLogin}>← Back to login</button>
        </form>
      </div>
    )
  }

  if (screen === "forgot-otp") {
    return (
      <div className="customerAuthCard customerResetCard">
        <div className="customerAuthIntro"><div className="kicker">VERIFY MOBILE</div><h2>{verifiedAccessToken ? "Mobile verified" : "Enter the SMS OTP"}</h2><p>{verifiedAccessToken ? "Your OTP is verified. Finish the secure handoff to choose a new password." : <>We sent a 6-digit code to <b>+91 {phone.slice(-10)}</b>.</>}</p></div>
        <form className="customerAuthForm" onSubmit={verifyOtp}>
          {!verifiedAccessToken && <label className="field"><span>6-digit OTP <b className="requiredMark">*</b></span><input className="control otpControl" inputMode="numeric" autoComplete="one-time-code" value={otp} required maxLength={6} pattern="[0-9]{6}" onChange={(event) => { setOtp(event.target.value.replace(/\D/g, "").slice(0, 6)); clearErrors() }} placeholder="••••••" /></label>}
          {verifiedAccessToken && <div className="resetVerifiedNotice"><span aria-hidden="true">✓</span><div><b>OTP verified</b><small>No need to enter or resend the OTP again.</small></div></div>}
          {friendlyError && <div className="errorBox" role="alert">{friendlyError}</div>}
          <button className="primary fullWidth" disabled={actionBusy || (!verifiedAccessToken && otp.length !== 6)} type="submit">{actionBusy ? (verifiedAccessToken ? "Finishing verification…" : "Verifying…") : verifiedAccessToken ? "Continue securely" : "Verify OTP"}</button>
          {!verifiedAccessToken && <div className="resetResendRow"><span>Didn’t get it?</span><button className="authTextButton" type="button" disabled={actionBusy || resendIn > 0} onClick={() => void resendOtp()}>{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}</button></div>}
          <button className="authTextButton" type="button" onClick={() => { setScreen("forgot-phone"); resetOtpWidget() }}>← Change mobile number</button>
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
          <button className="primary fullWidth" disabled={actionBusy} type="submit">{actionBusy ? "Resetting password…" : "Reset password & continue"}</button>
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