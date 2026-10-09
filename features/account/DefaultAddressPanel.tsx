"use client"

import { useEffect, useState } from "react"
import type { DeliveryAddress } from "../../lib/domain/delivery-address"
import { loadDefaultAddress, saveDefaultAddress } from "../checkout/delivery-preferences"

const empty: DeliveryAddress = { receiverName: "", address: "", city: "", state: "", pincode: "" }

export function DefaultAddressPanel({ accountId }: { accountId: string }) {
  const [saved, setSaved] = useState<DeliveryAddress | null>(null)
  const [draft, setDraft] = useState<DeliveryAddress>(empty)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")

  useEffect(() => {
    let active = true
    setSaved(null)
    setDraft(empty)
    setStatus("")
    void loadDefaultAddress().then((address) => {
      if (!active) return
      setSaved(address)
      setDraft(address || empty)
      setEditing(!address)
    }).catch(() => { if (active) setStatus("Could not load your saved address. Retry by reopening My Celebration.") })
    return () => { active = false }
  }, [accountId])

  function field<K extends keyof DeliveryAddress>(key: K, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
    setStatus("")
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setStatus("")
    try {
      const value = await saveDefaultAddress({
        ...draft, customerName: "", phone: "", requiredDate: "", occasion: "",
        message: "", paymentReference: ""
      })
      setSaved(value)
      setDraft(value)
      setEditing(false)
      setStatus("Default delivery address saved. It will be offered at checkout.")
    } catch {
      setStatus("Address could not be saved. Check the fields and try again.")
    } finally { setBusy(false) }
  }

  return <section className="customerDefaultAddress" aria-labelledby="default-delivery-heading">
    <div className="customerDefaultAddressHeading">
      <div><div className="kicker">YOUR ADDRESS</div><h2 id="default-delivery-heading">Default delivery address</h2></div>
      {saved && !editing && <button type="button" className="secondary" onClick={() => setEditing(true)}>Change address</button>}
    </div>
    {!editing && saved ? <p className="defaultAddressSummary">{saved.receiverName}<br />{saved.address}<br />{saved.city}, {saved.state} - {saved.pincode}</p> : <form onSubmit={(event) => void save(event)} className="defaultAddressForm" autoComplete="on">
      <label>Recipient name<input name="shipping-name" autoComplete="section-profile shipping name" value={draft.receiverName} maxLength={80} required minLength={2} onChange={(e) => field("receiverName", e.target.value)} /></label>
      <label>Street address<textarea name="street-address" autoComplete="section-profile shipping street-address" value={draft.address} maxLength={500} minLength={8} required onChange={(e) => field("address", e.target.value)} /></label>
      <label>City<input name="address-level2" autoComplete="section-profile shipping address-level2" value={draft.city} maxLength={80} minLength={2} required onChange={(e) => field("city", e.target.value)} /></label>
      <label>State<input name="address-level1" autoComplete="section-profile shipping address-level1" value={draft.state} maxLength={80} minLength={2} required onChange={(e) => field("state", e.target.value)} /></label>
      <label>PIN code<input name="postal-code" autoComplete="section-profile shipping postal-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={draft.pincode} onChange={(e) => field("pincode", e.target.value.replace(/\D/g, ""))} /></label>
      <div className="defaultAddressActions"><button type="submit" className="primary" disabled={busy}>{busy ? "Saving…" : "Save default address"}</button>{saved && <button type="button" className="secondary" onClick={() => { setDraft(saved); setEditing(false); setStatus("") }}>Cancel</button>}</div>
    </form>}
    {status && <p role="status" className="defaultAddressStatus">{status}</p>}
  </section>
}
