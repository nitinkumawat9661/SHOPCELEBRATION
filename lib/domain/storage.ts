import { storageConfig, type PackingVideoMimeType } from "../../config/storage"

export function isPackingVideoMimeType(value: string): value is PackingVideoMimeType {
  return Object.prototype.hasOwnProperty.call(storageConfig.packingVideoTypes, value)
}

export function packingVideoAcceptList() {
  return Object.keys(storageConfig.packingVideoTypes).join(",")
}


export function packingVideoMimeTypeForFile(file: Pick<File, "type" | "name">): PackingVideoMimeType | null {
  const declared = file.type.trim().toLowerCase()
  if (isPackingVideoMimeType(declared)) return declared

  const name = file.name.trim().toLowerCase()
  if (name.endsWith(".mp4")) return "video/mp4"
  if (name.endsWith(".webm")) return "video/webm"
  return null
}
