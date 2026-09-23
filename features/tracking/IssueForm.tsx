"use client"

import { useState } from "react"
import { routes } from "../../config/routes"
import { storeContent, uiContent } from "../../lib/domain/content"

export function IssueForm({ token, onSubmitted, onError }: { token: string; onSubmitted: () => void; onError: (message: string) => void }) {
  const [issueType, setIssueType] = useState(storeContent.issues.types[0] || "")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    onError("")
    try {
      const response = await fetch(routes.api.reportIssue, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, issueType, note })
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || uiContent.tracking.invalid)
      onSubmitted()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : uiContent.tracking.invalid)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="issueCard" onSubmit={submit}>
      <div className="promiseIcon">{storeContent.issues.icon}</div>
      <h2>{storeContent.issues.title}</h2>
      <p>{storeContent.issues.body}</p>
      <select className="control" value={issueType} onChange={(event) => setIssueType(event.target.value)}>{storeContent.issues.types.map((type) => <option key={type}>{type}</option>)}</select>
      <label className="field"><span>{storeContent.issues.noteLabel}</span><textarea className="control" rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <button className="secondary fullWidth" type="submit" disabled={submitting}>{submitting ? uiContent.common.loadingEllipsis : storeContent.issues.submit}</button>
    </form>
  )
}
