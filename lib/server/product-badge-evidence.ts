import { unstable_cache } from "next/cache"
import type { CatalogConfig, GiftProduct } from "../domain/catalog"
import { query } from "./db"

/**
 * Shopper-facing signals are derived from persisted evidence, never from the
 * editable catalog.badge string. Both sources use existing database tables:
 * - real paid AND delivered individual orders (no cancelled/refunded orders);
 * - the first actual published catalog revision containing an SKU.
 *
 * No new columns, migrations, API calls from the browser, or fake counters.
 */
type SalesRow = { product_id: string; verified_order_count: number }
type PublicationRow = { product_id: string; first_version: number; first_published_at: Date }

const verifiedBadgeFacts = unstable_cache(async () => {
  const [sales, publications] = await Promise.all([
    query<SalesRow>(
      `SELECT item->>'productId' AS product_id,
              count(DISTINCT orders.id)::int AS verified_order_count
         FROM orders
         CROSS JOIN LATERAL jsonb_array_elements(orders.line_items) AS item
        WHERE orders.order_type = 'individual'
          AND orders.status = 'delivered'
          AND orders.payment_status IN ('paid', 'verified', 'success')
          AND orders.created_at >= now() - interval '120 days'
          AND item->>'productId' IS NOT NULL
        GROUP BY item->>'productId'`
    ),
    query<PublicationRow>(
      `SELECT product->>'id' AS product_id,
              min(revision.version)::int AS first_version,
              (array_agg(revision.created_at ORDER BY revision.version))[1] AS first_published_at
         FROM catalog_revisions AS revision
         CROSS JOIN LATERAL jsonb_array_elements(revision.payload->'products') AS product
        WHERE product->>'id' IS NOT NULL
          AND product->>'active' IS DISTINCT FROM 'false'
        GROUP BY product->>'id'`
    )
  ])
  return {
    sales: sales.rows.map(row => ({ id: row.product_id, orders: row.verified_order_count })),
    publications: publications.rows.map(row => ({
      id: row.product_id, version: row.first_version,
      publishedAt: row.first_published_at instanceof Date
        ? row.first_published_at.toISOString()
        : String(row.first_published_at)
    }))
  }
}, ["celebration-storefront-verified-badge-facts-v1"], { revalidate: 120 })

export function attachVerifiedBadgeSignals(
  catalog: CatalogConfig,
  evidence: {
    sales: { id: string; orders: number }[]
    publications: { id: string; version: number; publishedAt: string }[]
  },
  now = Date.now()
): CatalogConfig {
  const current = new Map(catalog.products.map(product => [product.id, product]))
  const sales = new Map(evidence.sales
    .filter(row => current.has(row.id) && Number.isSafeInteger(row.orders) && row.orders >= 0)
    .map(row => [row.id, row.orders]))
  const publications = new Map(evidence.publications
    .filter(row => current.has(row.id))
    .map(row => [row.id, row]))

  const categoryMaxOrders = new Map<string, number>()
  for (const product of catalog.products) {
    if (product.active === false || product.sellIndividually !== true) continue
    categoryMaxOrders.set(
      product.category,
      Math.max(categoryMaxOrders.get(product.category) || 0, sales.get(product.id) || 0)
    )
  }

  return {
    ...catalog,
    products: catalog.products.map((product): GiftProduct => {
      if (product.active === false || product.sellIndividually !== true) return product
      const orders = sales.get(product.id) || 0
      const publication = publications.get(product.id)
      const publishedTime = publication ? Date.parse(publication.publishedAt) : NaN
      const recentlyAdded = Boolean(
        publication && Number.isInteger(publication.version) && publication.version > 1 &&
        Number.isFinite(publishedTime) && publishedTime <= now &&
        now - publishedTime <= 21 * 24 * 60 * 60 * 1000
      )
      const genuinelyPopular = orders >= 5 && orders === (categoryMaxOrders.get(product.category) || 0)

      return {
        ...product,
        badgeSignals: {
          // Consumers see claims only when the measured criteria are met.
          // This field is produced in server code and discarded by normalizeCatalogConfig.
          ...(genuinelyPopular ? { bestsellerOrders: orders } : {}),
          ...(recentlyAdded ? { firstPublishedAt: publication!.publishedAt, firstRevisionVersion: publication!.version } : {})
        }
      }
    })
  }
}

/** For public storefront pages only. If evidence cannot be read, stay neutral
 * instead of hiding the store, manufacturing counts, or publishing raw labels. */
export async function withVerifiedStorefrontBadges(catalog: CatalogConfig): Promise<CatalogConfig> {
  try {
    return attachVerifiedBadgeSignals(catalog, await verifiedBadgeFacts())
  } catch (error) {
    console.error("storefront-badge-evidence", error)
    return catalog
  }
}
