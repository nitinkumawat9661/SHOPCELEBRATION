import { query } from "./db"

/** R2-hosted real photos curated for navigation, never SKU product images. */
type CategoryMediaRow = { category_id: string; image_url: string }

export async function getHomeCategoryMedia(): Promise<Record<string, string>> {
  const result = await query<CategoryMediaRow>(
    "SELECT category_id, image_url FROM home_category_media"
  )
  const items: Record<string, string> = {}
  for (const row of result.rows) {
    if (!row.category_id || !/^\/api\/catalog\/image\?key=catalog\/editorial\/category-v1\/[a-z-]+\.webp$/.test(decodeURIComponent(row.image_url))) continue
    items[row.category_id] = row.image_url
  }
  return items
}
