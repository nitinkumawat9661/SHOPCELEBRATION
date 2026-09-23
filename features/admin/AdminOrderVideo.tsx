"use client"

import { routes } from "../../config/routes"
import { packingVideoAcceptList } from "../../lib/domain/storage"
import { statusHasCapability } from "../../lib/domain/order-status"
import { uiContent } from "../../lib/domain/content"
import type { AdminOrder } from "./types"

const acceptedVideoTypes = packingVideoAcceptList()

export function AdminOrderVideo({ order, busy, onVideo }: {
  order: AdminOrder
  busy: boolean
  onVideo: (file: File) => void | Promise<void>
}) {
  const copy = uiContent.admin
  const canUpload = statusHasCapability(order.status, "packingVideoUpload")
  const hasVideo = Boolean(order.packingVideoKey)

  function fileInput(label: string, className: string) {
    return (
      <label className={className}>
        {busy ? copy.uploadingVideo : label}
        <input
          type="file"
          accept={acceptedVideoTypes}
          hidden
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ""
            if (file) onVideo(file)
          }}
        />
      </label>
    )
  }

  if (hasVideo) {
    return (
      <div className="adminVideoPanel ready">
        <div className="adminVideoCopy">
          <b>{copy.videoUploaded}</b>
          <span>{order.status === "packing_video_ready" ? copy.waitingCustomerApproval : copy.videoStored}</span>
        </div>
        <div className="adminVideoActions">
          <a className="secondary" href={routes.api.adminOrderPackingVideo(order.publicId)} target="_blank" rel="noreferrer">{copy.viewVideo}</a>
          {canUpload && fileInput(copy.replaceVideo, "secondary uploadControl")}
        </div>
      </div>
    )
  }

  if (!canUpload) return null

  return (
    <div className="adminVideoPanel pending">
      <div className="adminVideoCopy">
        <b>{copy.videoNeeded}</b>
        <span>{copy.videoNeededHint}</span>
      </div>
      {fileInput(copy.upload, "primary uploadControl")}
    </div>
  )
}
