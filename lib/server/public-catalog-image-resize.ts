import sharp from "sharp"

export const PUBLIC_CATALOG_WIDTHS = [192, 256, 384, 640, 828] as const

/** Never allow unbounded resizing or custom dimension amplification. */
export function requestedPublicCatalogImageWidth(params: URLSearchParams): number | null {
  const value = params.get("w")
  if (!value || !/^\d{2,4}$/.test(value)) return null
  const width = Number(value)
  return PUBLIC_CATALOG_WIDTHS.some((candidate) => candidate === width) ? width : null
}

/** Resize only publicly served, already-authenticated catalog image keys. */
export async function resizePublicCatalogImage(source: Buffer, width: number): Promise<Buffer | null> {
  if (!PUBLIC_CATALOG_WIDTHS.some((candidate) => candidate === width)) return null
  try {
    return await sharp(source, { limitInputPixels: 32_000_000, animated: false })
      .rotate()
      .resize({ width, withoutEnlargement: true, fit: "inside" })
      .webp({ quality: 73, effort: 3 })
      .toBuffer()
  } catch {
    return null
  }
}
