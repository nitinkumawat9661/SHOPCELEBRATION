"use client"

import { useCallback, useEffect, useState } from "react"
import { routes } from "../../config/routes"

export type CustomerAccountView = {
  id: string
  phone: string
  displayName: string
  createdAt: string
  phoneVerified: false
}

type Mode = "login" | "signup"

export type PasswordResetRequest = {
  widgetId: string
  tokenAuth: string
  expiresInSeconds: number
  resendAfterSeconds: number
}

export function useCustomerAccount() {
  const [account, setAccount] = useState<CustomerAccountView | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(routes.api.customerMe, { cache: "no-store" })
      const data = await response.json() as { ok?: boolean; account?: CustomerAccountView | null; error?: string }
      if (!response.ok || !data.ok) throw new Error(data.error || "ACCOUNT_LOAD_FAILED")
      setAccount(data.account || null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ACCOUNT_LOAD_FAILED")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function authenticate(mode: Mode, values: { phone: string; password: string; displayName?: string }) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch(mode === "signup" ? routes.api.customerSignup : routes.api.customerLogin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      })
      const data = await response.json() as { ok?: boolean; account?: CustomerAccountView; error?: string }
      if (!response.ok || !data.ok || !data.account) throw new Error(data.error || "AUTH_FAILED")
      setAccount(data.account)
      return data.account
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "AUTH_FAILED"
      setError(message)
      return null
    } finally {
      setBusy(false)
    }
  }

  async function requestPasswordReset(phone: string): Promise<PasswordResetRequest | null> {
    setBusy(true)
    setError("")
    try {
      const response = await fetch(routes.api.customerPasswordResetRequest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      })
      const data = await response.json() as { ok?: boolean; widgetId?: string; tokenAuth?: string; expiresInSeconds?: number; resendAfterSeconds?: number; error?: string }
      if (!response.ok || !data.ok || !data.widgetId || !data.tokenAuth) throw new Error(data.error || "PASSWORD_RESET_UNAVAILABLE")
      return {
        widgetId: data.widgetId,
        tokenAuth: data.tokenAuth,
        expiresInSeconds: Number(data.expiresInSeconds) || 600,
        resendAfterSeconds: Number(data.resendAfterSeconds) || 45
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PASSWORD_RESET_UNAVAILABLE")
      return null
    } finally {
      setBusy(false)
    }
  }

  async function verifyPasswordReset(phone: string, accessToken: string) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch(routes.api.customerPasswordResetVerify, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, accessToken })
      })
      const data = await response.json() as { ok?: boolean; resetToken?: string; error?: string }
      if (!response.ok || !data.ok || !data.resetToken) throw new Error(data.error || "INVALID_OTP")
      return data.resetToken
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "INVALID_OTP")
      return null
    } finally {
      setBusy(false)
    }
  }

  async function completePasswordReset(resetToken: string, password: string) {
    setBusy(true)
    setError("")
    try {
      const response = await fetch(routes.api.customerPasswordResetComplete, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, password })
      })
      const data = await response.json() as { ok?: boolean; account?: CustomerAccountView; error?: string }
      if (!response.ok || !data.ok || !data.account) throw new Error(data.error || "PASSWORD_RESET_UNAVAILABLE")
      setAccount(data.account)
      return data.account
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PASSWORD_RESET_UNAVAILABLE")
      return null
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    setError("")
    try {
      const response = await fetch(routes.api.customerLogout, { method: "POST" })
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!response.ok || !data.ok) throw new Error(data.error || "LOGOUT_FAILED")
      setAccount(null)
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "LOGOUT_FAILED")
      return false
    } finally {
      setBusy(false)
    }
  }

  return {
    account,
    loading,
    busy,
    error,
    setError,
    refresh,
    authenticate,
    requestPasswordReset,
    verifyPasswordReset,
    completePasswordReset,
    logout
  }
}
