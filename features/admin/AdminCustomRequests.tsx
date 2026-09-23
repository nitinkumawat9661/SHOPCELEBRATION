"use client"

import { useEffect, useMemo, useState } from "react"
import { formatMoney } from "../../lib/domain/catalog"
import { supportWhatsappUrl } from "../../lib/domain/support"
import type { CustomHamperRequestRecord } from "../../lib/server/custom-requests"
import { useStoreSettings } from "../shell/useStoreSettings"

type RequestFilter = "all" | CustomHamperRequestRecord["status"]

export function AdminCustomRequests() {
  const settings = useStoreSettings()
  const [requests, setRequests] = useState<CustomHamperRequestRecord[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<RequestFilter>("all")

  async function load() {
    const response = await fetch("/api/admin/custom-requests", { cache: "no-store" })
    const data = await response.json() as { ok?: boolean; requests?: CustomHamperRequestRecord[]; error?: string }
    if (!response.ok || !data.ok) throw new Error(data.error || "REQUEST_LOAD_FAILED")
    setRequests(data.requests || [])
  }

  useEffect(() => { load().catch((caught) => setError(caught instanceof Error ? caught.message : "REQUEST_LOAD_FAILED")) }, [])

  async function update(id: string, status: CustomHamperRequestRecord["status"]) {
    setBusy(id)
    setError("")
    try {
      const response = await fetch("/api/admin/custom-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      })
      const data = await response.json() as { ok?: boolean; request?: CustomHamperRequestRecord; error?: string }
      if (!response.ok || !data.ok || !data.request) throw new Error(data.error || "REQUEST_UPDATE_FAILED")
      setRequests((current) => current.map((item) => item.id === id ? data.request! : item))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "REQUEST_UPDATE_FAILED")
    } finally {
      setBusy("")
    }
  }

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return requests.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false
      if (!query) return true
      return [item.customerName, item.phone, item.requestText, String(item.budgetPaise / 100)].join(" ").toLowerCase().includes(query)
    })
  }, [requests, search, filter])

  const counts = useMemo(() => ({
    all: requests.length,
    new: requests.filter((item) => item.status === "new").length,
    contacted: requests.filter((item) => item.status === "contacted").length,
    closed: requests.filter((item) => item.status === "closed").length
  }), [requests])

  return (
    <section className="adminWorkspaceCard">
      <div className="adminWorkspaceHead"><div><div className="kicker">CUSTOM REQUESTS</div><h2>Budget request queue</h2><p>Public “apne budget me” requests. Search, contact aur close yahin se.</p></div><button className="secondary" onClick={() => load().catch((caught) => setError(String(caught)))}>Refresh</button></div>
      {error && <div className="errorBox adminFeedback">{error}</div>}
      <div className="adminQueueToolbar">
        <input className="control" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, phone, budget ya request search karein" />
        <div className="adminFilterRow">{(["all", "new", "contacted", "closed"] as RequestFilter[]).map((value) => <button key={value} type="button" className={`adminFilterChip${filter === value ? " active" : ""}`} onClick={() => setFilter(value)}><span>{value === "all" ? "All" : value === "new" ? "New" : value === "contacted" ? "Contacted" : "Closed"}</span><b>{counts[value]}</b></button>)}</div>
      </div>
      <div className="adminRequestList">
        {visible.length === 0 && <div className="trackingState">Is search/filter me koi custom request nahi mili.</div>}
        {visible.map((item) => {
          const waMessage = `Hi ${item.customerName}, Celebration se bol rahe hain. Aapki ₹${Math.round(item.budgetPaise / 100)} custom hamper request mili thi. Aapne likha tha: ${item.requestText}`
          return <article className="adminRequestCard" key={item.id}>
            <div className="adminRequestIdentity"><div><b>{item.customerName}</b><span><a href={`tel:${item.phone}`}>{item.phone}</a> • {formatMoney(item.budgetPaise / 100)}</span></div><span className={`adminRequestStatus status-${item.status}`}>{item.status}</span></div>
            <p>{item.requestText}</p>
            <div className="adminRequestFooter"><small>{new Date(item.createdAt).toLocaleString("en-IN")}</small><div className="adminRequestActions"><a className="secondary" target="_blank" rel="noreferrer" href={supportWhatsappUrl(waMessage, settings.whatsapp)}>WhatsApp</a><select disabled={busy === item.id} value={item.status} onChange={(event) => update(item.id, event.target.value as CustomHamperRequestRecord["status"])}><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></div></div>
          </article>
        })}
      </div>
    </section>
  )
}
