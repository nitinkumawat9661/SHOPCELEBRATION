/**
 * Only public catalog R2 keys are eligible; customer assets use private routes.
 * Source-hashed and UUID-uploaded public images are unique. Category editorial
 * image names can be overwritten and therefore need shorter freshness.
 */
const sourceHashedPhoto = /^catalog\/rehost\/meesho\/[a-f0-9]{64}\/(?:main|thumb|zoom)\.webp$/
const uniqueUpload = /^catalog\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:webp|png|jpe?g)$/i
const versionedEditorial = /^catalog\/editorial\/category-v[1-9][0-9]*\/[a-z-]+\.webp$/

export function publicCatalogImageCacheControl(key: string) {
  if (sourceHashedPhoto.test(key) || uniqueUpload.test(key))
    return "public, max-age=604800, immutable"
  if (versionedEditorial.test(key))
    return "public, max-age=3600, stale-while-revalidate=86400"
  return "public, max-age=300, stale-while-revalidate=1800"
}
