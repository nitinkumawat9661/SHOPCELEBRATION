"use client"

import { useEffect, useMemo, useState } from "react"
import type { StoreSettings } from "../../lib/server/store-settings"
import { legalProfileReady } from "../../lib/server/store-settings"
import { storeContent } from "../../lib/domain/content"
import { supportWhatsappUrl } from "../../lib/domain/support"

const fallback: StoreSettings = {
  whatsapp: storeContent.support.whatsapp,
  assistTitle: storeContent.support.assistTitle,
  assistBody: storeContent.support.assistBody,
  supportMessage: storeContent.support.supportMessage,
  legalName: "",
  businessAddress: "",
  supportEmail: "",
  grievanceOfficerName: "",
  grievanceOfficerDesignation: "Grievance Officer",
  grievanceEmail: "",
  grievancePhone: storeContent.support.whatsapp
}

export function AdminStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(fallback)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const complianceReady = useMemo(() => legalProfileReady(settings), [settings])

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
      setNotice("Store support and legal settings publish ho gayi.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SETTINGS_SAVE_FAILED")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="adminWorkspaceCard">
      <div className="adminWorkspaceHead">
        <div><div className="kicker">STORE SETTINGS</div><h2>Support, legal & grievance</h2><p>Customer support aur public compliance profile yahin se control hota hai.</p></div>
        <div className="adminActions"><button className="secondary" type="button" onClick={() => load().catch((cause) => setError(String(cause)))}>Reload</button><button className="primary" type="button" disabled={busy || !dirty} onClick={save}>{busy ? "Publishing…" : `Publish v${version + 1}`}</button></div>
      </div>

      {!complianceReady && <div className="errorBox adminFeedback"><b>Pre-launch legal profile incomplete.</b> Legal name, principal business address, customer-care email and grievance-officer details fill karna required hai before public launch.</div>}
      {dirty && <div className="adminDraftNotice">Unpublished changes • Public site par abhi purani settings hi live hain.</div>}
      {notice && <div className="successBox adminFeedback">{notice}</div>}
      {error && <div className="errorBox adminFeedback">{error}</div>}

      <div className="adminSettingsGrid">
        <label>WhatsApp support number<input value={settings.whatsapp} inputMode="tel" onChange={(event) => patch("whatsapp", event.target.value.replace(/\D/g, ""))} /><small>Default: {storeContent.support.whatsappDisplay}</small></label>
        <label>Customer-care email<input value={settings.supportEmail} type="email" maxLength={254} onChange={(event) => patch("supportEmail", event.target.value)} placeholder="support@yourdomain.in" /></label>
        <label>Top helper heading<input value={settings.assistTitle} maxLength={160} onChange={(event) => patch("assistTitle", event.target.value)} /></label>
        <label className="adminWide">Top helper line<input value={settings.assistBody} maxLength={160} onChange={(event) => patch("assistBody", event.target.value)} /></label>
        <label className="adminWide">Default WhatsApp message<textarea rows={3} value={settings.supportMessage} maxLength={500} onChange={(event) => patch("supportMessage", event.target.value)} /></label>

        <div className="adminWide adminPanelHeading"><b>Legal business identity</b><span>Exactly wahi details use karein jo invoices/registrations me use hoti hain. Brand name ko legal entity assume na karein.</span></div>
        <label>Legal / proprietor entity name<input value={settings.legalName} maxLength={160} onChange={(event) => patch("legalName", event.target.value)} placeholder="Exact legal name" /></label>
        <label className="adminWide">Principal business address<textarea rows={3} value={settings.businessAddress} maxLength={500} onChange={(event) => patch("businessAddress", event.target.value)} placeholder="Full postal address" /></label>

        <div className="adminWide adminPanelHeading"><b>Consumer grievance officer</b><span>Consumer complaints acknowledge within 48 hours; target redressal within one month.</span></div>
        <label>Officer name<input value={settings.grievanceOfficerName} maxLength={160} onChange={(event) => patch("grievanceOfficerName", event.target.value)} placeholder="Full name" /></label>
        <label>Designation<input value={settings.grievanceOfficerDesignation} maxLength={160} onChange={(event) => patch("grievanceOfficerDesignation", event.target.value)} /></label>
        <label>Grievance email<input value={settings.grievanceEmail} type="email" maxLength={254} onChange={(event) => patch("grievanceEmail", event.target.value)} placeholder="grievance@yourdomain.in" /></label>
        <label>Grievance phone<input value={settings.grievancePhone} inputMode="tel" onChange={(event) => patch("grievancePhone", event.target.value.replace(/\D/g, ""))} /></label>
      </div>

      <div className="adminSettingsPreview"><span>Support preview</span><b>{settings.assistTitle}</b><p>{settings.assistBody}</p><a className="secondary" target="_blank" rel="noreferrer" href={supportWhatsappUrl(settings.supportMessage, settings.whatsapp)}>Test WhatsApp</a></div>
    </section>
  )
}
