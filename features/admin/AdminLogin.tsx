"use client"

import { useState } from "react"
import { uiContent } from "../../lib/domain/content"
import { routes } from "../../config/routes"

export function AdminLogin() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const copy = uiContent.admin

  async function login(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setLoading(true)
    try {
      const response = await fetch(routes.api.adminLogin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || "LOGIN_FAILED")
      window.location.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "LOGIN_FAILED")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="adminLoginCard" onSubmit={login}>
      <div className="kicker">{copy.title}</div>
      <h1>{copy.login}</h1>
      <label className="field"><span>{copy.password}</span><input className="control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
      {error && <div className="errorBox">{error}</div>}
      <button className="primary fullWidth" disabled={loading} type="submit">{loading ? "…" : copy.login}</button>
    </form>
  )
}
