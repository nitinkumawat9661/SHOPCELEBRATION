"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { StoreSettings } from "../../../lib/server/store-settings"
import { supportWhatsappUrl } from "../../../lib/domain/support"
import { createAdminPasskey } from "../passkey-client"

type Tab = "store" | "legal" | "security"
type SettingsResponse = { ok?: boolean; settings?: StoreSettings; version?: number; error?: string }
type SecurityResponse = {
  ok?: boolean
  sessionMethod?: "passkey"
  passkeyCount?: number
  passwordFallbackAllowed?: boolean
  credentialManagementAvailable?: boolean
  selfServicePasskeyRecoveryAvailable?: boolean
  error?: string
}

const contactFields: { field: keyof StoreSettings; label: string; note: string; kind?: string; multiline?: boolean }[] = [
  { field: "whatsapp", label: "WhatsApp support number", note: "Digits only; existing server validates country code", kind: "tel" },
  { field: "supportEmail", label: "Customer-care email", note: "Public customer contact", kind: "email" },
  { field: "assistTitle", label: "Support helper title", note: "Shown in customer-facing helper strip" },
  { field: "assistBody", label: "Support helper description", note: "Brief assistance message", multiline: true },
  { field: "supportMessage", label: "Default WhatsApp message", note: "Text included in the generated WhatsApp support link", multiline: true }
]
const legalFields: { field: keyof StoreSettings; label: string; note: string; kind?: string; multiline?: boolean }[] = [
  { field: "legalName", label: "Registered legal/proprietor entity", note: "Enter the legally correct person/entity, not an assumed trading brand." },
  { field: "businessAddress", label: "Principal business address", note: "Customer-facing postal address; verify details before publishing", multiline: true },
  { field: "grievanceOfficerName", label: "Grievance officer name", note: "Complete legal-compliance contact" },
  { field: "grievanceOfficerDesignation", label: "Grievance officer designation", note: "Published designation" },
  { field: "grievanceEmail", label: "Grievance email", note: "Published contact", kind: "email" },
  { field: "grievancePhone", label: "Grievance phone", note: "Published contact number", kind: "tel" }
]

function Field({ field, value, update }: {
  field: (typeof contactFields)[number]
  value: string
  update: (key: keyof StoreSettings, next: string) => void
}) {
  const maxLength = field.field === "businessAddress" || field.field === "supportMessage" ? 500 :
    field.kind === "email" ? 254 : field.kind === "tel" ? 15 : 160
  return <label className={"cav3-settings-field" + (field.multiline ? " is-wide" : "")}>
    <span>{field.label}</span>
    {field.multiline ? <textarea rows={3} maxLength={maxLength} value={value}
      onChange={event => update(field.field, event.target.value)} />
      : <input value={value} maxLength={maxLength} type={field.kind || "text"}
        inputMode={field.kind === "tel" ? "tel" : "text"}
        onChange={event => update(field.field, field.kind === "tel" ? event.target.value.replace(/\D/g, "") : event.target.value)} />}
    <small>{field.note}</small>
  </label>
}

/**
 * Admin V3 settings deliberately excludes operational secrets and integrations:
 * Cashfree, Shipway, R2, Telegram, database, password hashes and env settings
 * remain outside the editable storefront profile.
 */
export function AdminSettingsV3({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [tab, setTab] = useState<Tab>("store")
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [original, setOriginal] = useState<StoreSettings | null>(null)
  const [version, setVersion] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [security, setSecurity] = useState<SecurityResponse | null>(null)
  const [securityLoading, setSecurityLoading] = useState(true)
  const [securityError, setSecurityError] = useState("")
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyNotice, setPasskeyNotice] = useState("")
  const [passkeyError, setPasskeyError] = useState("")

  const dirty = Boolean(settings && original && JSON.stringify(settings) !== JSON.stringify(original))
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = "" }
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const loadSettings = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/store-settings/v3", {
        cache: "no-store", credentials: "same-origin", signal
      })
      const body = await response.json() as SettingsResponse
      if (!response.ok || !body.ok || !body.settings ||
          !Number.isSafeInteger(body.version) || !body.version || body.version < 1) {
        throw Error(body.error || "STORE_SETTINGS_UNAVAILABLE")
      }
      if (signal?.aborted) return
      setSettings(body.settings)
      setOriginal(body.settings)
      setVersion(body.version)
      setNotice("")
    } catch (cause) {
      if (signal?.aborted) return
      setError(cause instanceof Error ? cause.message : "STORE_SETTINGS_UNAVAILABLE")
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [])

  const loadSecurity = useCallback(async (signal?: AbortSignal) => {
    setSecurityLoading(true)
    setSecurityError("")
    try {
      const response = await fetch("/api/admin/security/v3", {
        cache: "no-store", credentials: "same-origin", signal
      })
      const body = await response.json() as SecurityResponse
      if (!response.ok || !body.ok || body.sessionMethod !== "passkey" ||
          !Number.isSafeInteger(body.passkeyCount)) throw Error(body.error || "SECURITY_STATUS_UNAVAILABLE")
      if (!signal?.aborted) setSecurity(body)
    } catch (cause) {
      if (!signal?.aborted) {
        setSecurity(null)
        setSecurityError(cause instanceof Error ? cause.message : "SECURITY_STATUS_UNAVAILABLE")
      }
    } finally { if (!signal?.aborted) setSecurityLoading(false) }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadSettings(controller.signal)
    void loadSecurity(controller.signal)
    return () => controller.abort()
  }, [loadSettings, loadSecurity])

  function update(key: keyof StoreSettings, value: string) {
    setSettings(previous => previous ? { ...previous, [key]: value } : previous)
    setNotice("")
  }

  async function reload() {
    if (saving || passkeyBusy) return
    if (dirty && !window.confirm("Discard all unsaved store/legal changes and reload the current live values?")) return
    await loadSettings()
  }

  const complianceReady = useMemo(() => Boolean(
    settings?.legalName?.trim() && settings?.businessAddress?.trim() &&
    settings?.supportEmail?.trim() && settings?.grievanceOfficerName?.trim() &&
    settings?.grievanceEmail?.trim() && settings?.grievancePhone?.trim()
  ), [settings])

  async function save() {
    if (loading || saving || !settings || !dirty || version === null) return
    if (!window.confirm(
      "PUBLISH CUSTOMER-FACING SETTINGS\n\nThis immediately changes the public support/WhatsApp contact and legal/grievance information for the connected environment.\n" +
      "Current saved version: " + version +
      (complianceReady ? "" : "\nWARNING: Grievance/legal profile remains incomplete.") +
      "\n\nDo you want to publish all of these fields now?"
    )) return
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/store-settings/v3", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: version, settings })
      })
      const body = await response.json() as SettingsResponse
      if (!response.ok || !body.ok || !body.settings || !body.version) {
        if (response.status === 409) throw new Error(
          "SETTINGS_VERSION_CONFLICT: Another admin/session changed these live settings. Review a fresh copy before saving."
        )
        throw new Error(body.error || "SETTINGS_SAVE_FAILED")
      }
      setSettings(body.settings)
      setOriginal(body.settings)
      setVersion(body.version)
      setNotice("Store support and legal settings published as v" + body.version + ".")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SETTINGS_SAVE_FAILED")
    } finally { setSaving(false) }
  }

  async function addBackupPasskey() {
    if (passkeyBusy || !security || security.sessionMethod !== "passkey") return
    if (!window.confirm(
      "REGISTER AN ADDITIONAL ADMIN PASSKEY\n\nOnly register a device/passkey under your control. This adds a login credential: it does not rotate old passkeys, remove lost ones or create an email/password recovery option. Continue?"
    )) return
    setPasskeyBusy(true)
    setPasskeyError("")
    setPasskeyNotice("")
    try {
      const optionsResponse = await fetch("/api/admin/passkeys/register/options", {
        method: "POST", credentials: "same-origin"
      })
      const optionsBody = await optionsResponse.json() as {
        ok?: boolean; options?: Parameters<typeof createAdminPasskey>[0]; error?: string
      }
      if (!optionsResponse.ok || !optionsBody.ok || !optionsBody.options) {
        throw Error(optionsBody.error || "PASSKEY_SETUP_UNAVAILABLE")
      }
      const credential = await createAdminPasskey(optionsBody.options)
      const verifyResponse = await fetch("/api/admin/passkeys/register/verify", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential)
      })
      const verifyBody = await verifyResponse.json() as { ok?: boolean; error?: string }
      if (!verifyResponse.ok || !verifyBody.ok) {
        throw Error(verifyBody.error || "PASSKEY_REGISTRATION_FAILED")
      }
      setPasskeyNotice("An additional passkey was registered. Verify sign-in separately on that device before depending on it.")
      await loadSecurity()
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "PASSKEY_REGISTRATION_FAILED"
      setPasskeyError("Additional passkey registration failed or was cancelled: " + detail)
    } finally { setPasskeyBusy(false) }
  }

  function chooseTab(next: Tab) {
    setTab(next) // inputs remain in component state across tabs; no unsaved fields are discarded.
  }

  return <div className="cav3-settings" aria-label="Admin V3 Settings and Security">
    <div className="cav3-settings-banner" role="note">
      <b>Live settings are customer-facing.</b> These fields are stored in the existing database;
      publishing affects support and legal details immediately, without a code deployment.
      Payment credentials, Telegram, Shipway, hosting, passkey secrets and database access are not editable here.
    </div>

    <div className="cav3-settings-tiles">
      <div><span>Store profile</span><b>{loading ? "Checking…" : settings ? "Connected" : "Unavailable"}</b>
        <small>{version === null ? "No verified version loaded" : "Published version " + version}</small></div>
      <div><span>Public legal profile</span><b className={!complianceReady ? "is-warning" : ""}>
        {loading ? "Checking…" : complianceReady ? "Complete" : "Review needed"}</b>
        <small>Source-of-truth values must match registrations</small></div>
      <div><span>Registered passkeys</span><b>{securityLoading ? "Checking…" : security?.passkeyCount ?? "—"}</b>
        <small>Credential count, not distinct devices</small></div>
    </div>

    <div className="cav3-settings-tabs" role="group" aria-label="Settings categories">
      {([
        ["store", "Store & Support"], ["legal", "Legal & Grievance"], ["security", "Security & Passkeys"]
      ] as [Tab, string][]).map(([id, label]) =>
        <button type="button" key={id} className={tab === id ? "is-active" : ""}
          aria-pressed={tab === id} onClick={() => chooseTab(id)}>{label}</button>)}
    </div>

    {tab !== "security" && <div className="cav3-settings-editor">
      <div className="cav3-settings-editor-head">
        <div><h2>{tab === "store" ? "Customer support & storefront helper" : "Business identity & grievance details"}</h2>
          <p>Currently published information is loaded from the secured store settings endpoint.</p></div>
        <div className="cav3-settings-actions">
          <button type="button" className="cav3-settings-secondary" disabled={saving || loading} onClick={() => void reload()}>
            Reload live</button>
          <button type="button" className="cav3-settings-primary" disabled={saving || loading || !dirty || !settings || version === null}
            onClick={() => void save()}>{saving ? "Publishing…" : "Review & publish v" + ((version ?? 0) + 1)}</button>
        </div>
      </div>
      {dirty && <p className="cav3-settings-dirty" role="status">Unsaved local edits. Public storefront still uses its existing settings.</p>}
      {error && <p role="alert" className="cav3-error">{error}</p>}
      {notice && <p role="status" className="cav3-success">{notice}</p>}
      {loading && <p className="cav3-state">Loading verified settings…</p>}
      {!loading && settings && <div className="cav3-settings-fields">
        {(tab === "store" ? contactFields : legalFields).map(field =>
          <Field key={field.field} field={field} value={settings[field.field]} update={update} />)}
      </div>}
      {tab === "store" && settings && <div className="cav3-settings-preview">
        <div><b>Helper preview</b><h3>{settings.assistTitle}</h3><p>{settings.assistBody}</p>
          <small>Preview uses local unsaved inputs. Publishing changes the customer-facing site.</small></div>
        <a href={supportWhatsappUrl(settings.supportMessage, settings.whatsapp)}
          target="_blank" rel="noopener noreferrer">Test WhatsApp link ↗</a>
      </div>}
      {tab === "legal" && !loading && !complianceReady && <div className="cav3-settings-caution">
        The legal/grievance profile is missing required information. Verify business identity, contact details
        and the published consumer policy; do not assume saved defaults are legally correct.
      </div>}
    </div>}

    {tab === "security" && <div className="cav3-settings-security">
      <section className="cav3-panel">
        <div className="cav3-panel-head"><h2>Admin authentication</h2>
          <button type="button" disabled={securityLoading || passkeyBusy}
            onClick={() => void loadSecurity()}>Refresh status</button></div>
        {securityLoading && <p className="cav3-state">Checking authenticated security status…</p>}
        {securityError && <p className="cav3-error" role="alert">{securityError}</p>}
        {security && <dl className="cav3-settings-security-facts">
          <div><dt>Current admin session</dt><dd>Passkey-authenticated</dd></div>
          <div><dt>Registered passkeys</dt><dd>{security.passkeyCount} credentials</dd></div>
          <div><dt>Public password fallback</dt><dd>Disabled after passkey setup</dd></div>
          <div><dt>Self-service reset / credential revocation</dt><dd>Not implemented</dd></div>
        </dl>}
        <div className="cav3-settings-passkey-action">
          <div><b>Register an additional backup passkey</b>
            <p>This uses the existing authorized WebAuthn registration endpoints. Confirm the extra device works before relying on it.</p></div>
          <button type="button" disabled={!security || securityLoading || passkeyBusy}
            onClick={() => void addBackupPasskey()}>
            {passkeyBusy ? "Waiting for device…" : "Register backup passkey"}</button>
        </div>
        {passkeyNotice && <p role="status" className="cav3-success">{passkeyNotice}</p>}
        {passkeyError && <p role="alert" className="cav3-error">{passkeyError}</p>}
      </section>
      <section className="cav3-settings-security-warning">
        <h3>Account recovery requires an offline server-side procedure</h3>
        <p>There is no public “forgot admin passkey” action. If every usable passkey is lost, recovery must be handled
          by the server operator after independently verifying ownership and preserving operational backups.
          This page cannot revoke keys, reset credentials or turn password access back on.</p>
        <p>Existing login sessions and private API keys must never be copied into documentation, analytics or support tickets.</p>
      </section>
      <section className="cav3-panel">
        <div className="cav3-panel-head"><h2>Protected operational systems</h2></div>
        <div className="cav3-settings-system-grid">
          <div><b>Cashfree</b><small>Payment verification separate from fulfilment. No credentials displayed or editable.</small></div>
          <div><b>Shipway</b><small>Booking an AWB does not prove shipment or courier pickup.</small></div>
          <div><b>Telegram</b><small>Order messaging integration left unchanged.</small></div>
          <div><b>Inventory</b><small>Checkout reservations protected by the existing stock workflow.</small></div>
        </div>
      </section>
    </div>}
  </div>
}
