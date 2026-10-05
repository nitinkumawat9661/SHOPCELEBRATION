"use client"

import { useState } from "react"
import { routes } from "../../config/routes"
import { storeContent, uiContent } from "../../lib/domain/content"

export function IssueForm({ token, onSubmitted, onError }: { token: string; onSubmitted: (complaint: { reference: string; issueType: string; note: string }) => void; onError: (message: string) => void }) {
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
      const result = await response.json() as { ok?: boolean; error?: string; complaintReference?: string }
      if (!response.ok || !result.ok) {
        const message = result.error === "ISSUE_WINDOW_EXPIRED"
          ? "The issue-reporting window for this order has ended."
          : result.error === "ISSUE_NOT_ALLOWED_FOR_STATUS"
            ? "Issue reporting isn’t available at this stage."
            : result.error === "INVALID_ISSUE_REPORT"
              ? "Please complete the issue details and try again."
              : result.error === "RATE_LIMITED"
                ? "Too many attempts. Please try again shortly."
                : "We couldn’t submit this issue right now. Please try again."
        throw new Error(message)
      }
      onSubmitted({
        reference: typeof result.complaintReference === "string" ? result.complaintReference : "",
        issueType,
        note
      })
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
