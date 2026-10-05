import { storageConfig, type CatalogImageMimeType, type PackingVideoMimeType } from "../../config/storage"

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


export function isCatalogImageMimeType(value: string): value is CatalogImageMimeType {
  return Object.prototype.hasOwnProperty.call(storageConfig.catalogImageTypes, value)
}

export function catalogImageMimeTypeForFile(file: Pick<File, "type" | "name">): CatalogImageMimeType | null {
  const declared = file.type.trim().toLowerCase()
  if (isCatalogImageMimeType(declared)) return declared
  const name = file.name.trim().toLowerCase()
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg"
  if (name.endsWith(".png")) return "image/png"
  if (name.endsWith(".webp")) return "image/webp"
  return null
}
