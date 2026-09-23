import { storageConfig, type PackingVideoMimeType } from "../../config/storage"

export function isPackingVideoMimeType(value: string): value is PackingVideoMimeType {
  return Object.prototype.hasOwnProperty.call(storageConfig.packingVideoTypes, value)
}

export function packingVideoAcceptList() {
  return Object.keys(storageConfig.packingVideoTypes).join(",")
}
