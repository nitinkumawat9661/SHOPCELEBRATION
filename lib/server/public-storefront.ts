import { getCatalogConfig } from "./catalog"
import { getHomeCategoryMedia } from "./home-category-media"
import { getStoreSettings } from "./store-settings"
import { publicSnapshot } from "./public-store-cache"

/**
 * Only shared public-facing snapshots are cached. Never substitute these
 * snapshots for checkout stock validation, price verification or admin writes.
 * Stock may display with <=8s delay; authoritative DB checkout stays live.
 */
export function getPublicCatalogConfig() {
  return publicSnapshot("catalog", 8, getCatalogConfig)
}

export function getPublicStoreSettings() {
  return publicSnapshot("store-settings", 60, getStoreSettings)
}

export function getPublicHomeCategoryMedia() {
  return publicSnapshot("home-category-media", 120, getHomeCategoryMedia)
}
