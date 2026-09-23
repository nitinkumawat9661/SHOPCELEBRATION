"use client"

import { useEffect, useState } from "react"
import type { StoreSettings } from "../../lib/server/store-settings"
import { storeContent } from "../../lib/domain/content"
import { supportWhatsappUrl } from "../../lib/domain/support"

const fallback: StoreSettings = {
  whatsapp: storeContent.support.whatsapp,
  assistTitle: storeContent.support.assistTitle,
  assistBody: storeContent.support.assistBody,
  supportMessage: storeContent.support.supportMessage
}

export function AdminStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(fallback)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  async function load() {
    setError("")
    const response = await fetch("/api/admin/store-settings", { cache: "no-store" })
    const data = await response.json() as { ok?: boolean; settings?: StoreSettings; version?: number; error?: string }
    if (!response.ok || !data.ok || !data.settings) throw new Error(data.error || "SETTINGS_LOAD_FAILED")
    setSettings(data.settings)
    setVersion(data.version || 0)
    setDirty(false)
  }

  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : "SETTINGS_LOAD_FAILED")) }, [])

  function patch<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }

  async function save() {
    setBusy(true)
    setNotice("")
    setError("")
    try {
      const response = await fetch("/api/admin/store-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings })
      })
      const data = await response.json() as { ok?: boolean; settings?: StoreSettings; version?: number; error?: string }
      if (!response.ok || !data.ok || !data.settings) throw new Error(data.error || "SETTINGS_SAVE_FAILED")
      setSettings(data.settings)
      setVersion(data.version || version + 1)
      setDirty(false)
      setNotice("Store support settings publish ho gayi.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SETTINGS_SAVE_FAILED")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="adminWorkspaceCard">
      <div className="adminWorkspaceHead">
        <div><div className="kicker">STORE SETTINGS</div><h2>Support & convenience</h2><p>Site-wide budget helper aur WhatsApp support yahin se control hota hai.</p></div>
        <div className="adminActions"><button className="secondary" type="button" onClick={() => load().catch((cause) => setError(String(cause)))}>Reload</button><button className="primary" type="button" disabled={busy || !dirty} onClick={save}>{busy ? "Publishing…" : `Publish v${version + 1}`}</button></div>
      </div>
      {dirty && <div className="adminDraftNotice">Unpublished changes • Public site par abhi purani settings hi live hain.</div>}
      {notice && <div className="successBox adminFeedback">{notice}</div>}
      {error && <div className="errorBox adminFeedback">{error}</div>}
      <div className="adminSettingsGrid">
        <label>WhatsApp support number<input value={settings.whatsapp} inputMode="tel" onChange={(event) => patch("whatsapp", event.target.value.replace(/\D/g, ""))} /><small>Default: {storeContent.support.whatsappDisplay}</small></label>
        <label>Top helper heading<input value={settings.assistTitle} maxLength={160} onChange={(event) => patch("assistTitle", event.target.value)} /></label>
        <label className="adminWide">Top helper line<input value={settings.assistBody} maxLength={160} onChange={(event) => patch("assistBody", event.target.value)} /></label>
        <label className="adminWide">Default WhatsApp message<textarea rows={4} value={settings.supportMessage} maxLength={500} onChange={(event) => patch("supportMessage", event.target.value)} /></label>
      </div>
      <div className="adminSettingsPreview"><span>Preview</span><b>{settings.assistTitle}</b><p>{settings.assistBody}</p><a className="secondary" target="_blank" rel="noreferrer" href={supportWhatsappUrl(settings.supportMessage, settings.whatsapp)}>Test WhatsApp</a></div>
    </section>
  )
}
