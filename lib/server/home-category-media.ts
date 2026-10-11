import { query } from "./db"

/** R2 category images; v2 is a collage of exactly mapped Celebration product photos. */
type CategoryMediaRow = { category_id: string; image_url: string }

export async function getHomeCategoryMedia(): Promise<Record<string, string>> {
  const result = await query<CategoryMediaRow>(
    "SELECT category_id, image_url FROM home_category_media"
  )
  const items: Record<string, string> = {}
  for (const row of result.rows) {
    if (!row.category_id || !/^\/api\/catalog\/image\?key=catalog\/editorial\/category-v[12]\/[a-z-]+\.webp$/.test(decodeURIComponent(row.image_url))) continue
    items[row.category_id] = row.image_url
  }
  return items
}
