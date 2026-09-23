"use client"

import { useEffect, useState } from "react"

type Revision = { id: string; version: number; createdAt: string; tiers: number; products: number; occasions: number }

export function AdminCatalogHistory({ onRestored }: { onRestored?: () => void }) {
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [busy, setBusy] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  async function load() {
    setError("")
    const response = await fetch("/api/admin/catalog/history", { cache: "no-store" })
    const data = await response.json() as { ok?: boolean; revisions?: Revision[]; error?: string }
    if (!response.ok || !data.ok) throw new Error(data.error || "HISTORY_LOAD_FAILED")
    setRevisions(data.revisions || [])
  }

  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : "HISTORY_LOAD_FAILED")) }, [])

  async function restore(revision: Revision) {
    if (!window.confirm(`Catalog v${revision.version} restore karna hai? Current catalog history me safe rahega.`)) return
    setBusy(revision.id)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/catalog/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId: revision.id })
      })
      const data = await response.json() as { ok?: boolean; version?: number; restoredFromVersion?: number; error?: string }
      if (!response.ok || !data.ok) throw new Error(data.error || "ROLLBACK_FAILED")
      setNotice(`v${data.restoredFromVersion} restore ho gaya. New live version v${data.version} hai.`)
      await load()
      onRestored?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ROLLBACK_FAILED")
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="adminWorkspaceCard">
      <div className="adminWorkspaceHead"><div><div className="kicker">CHANGE HISTORY</div><h2>Catalog versions</h2><p>Har publish immutable snapshot save karta hai. Galti ho to previous version restore karein.</p></div><button className="secondary" type="button" onClick={() => load().catch((cause) => setError(String(cause)))}>Refresh</button></div>
      {notice && <div className="successBox adminFeedback">{notice}</div>}
      {error && <div className="errorBox adminFeedback">{error}</div>}
      <div className="adminHistoryList">
        {revisions.length === 0 && <div className="trackingState">Abhi revision history available nahi hai.</div>}
        {revisions.map((revision, index) => <article className="adminHistoryRow" key={revision.id}><div><b>Catalog v{revision.version}</b><span>{new Date(revision.createdAt).toLocaleString("en-IN")}</span></div><div className="adminHistoryCounts"><span>{revision.tiers} hampers</span><span>{revision.products} products</span><span>{revision.occasions} occasions</span></div><button className="secondary" type="button" disabled={busy === revision.id || index === 0} onClick={() => restore(revision)}>{index === 0 ? "Current / latest" : busy === revision.id ? "Restoring…" : "Restore"}</button></article>)}
      </div>
    </section>
  )
}
