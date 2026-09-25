import { Storefront } from "../features/home/Storefront"
import { defaultCatalog } from "../lib/domain/catalog"
import { getCatalogConfig } from "../lib/server/catalog"
import { getTierPopularity } from "../lib/server/orders"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  let catalog = defaultCatalog
  let socialProof = null

  try {
    const [catalogResult, proofResult] = await Promise.all([
      getCatalogConfig(),
      getTierPopularity().catch(() => null)
    ])
    catalog = catalogResult.catalog
    socialProof = proofResult
  } catch (error) {
    console.error("storefront-initial-catalog", error)
  }

  return <Storefront initialCatalog={catalog} initialSocialProof={socialProof} />
}
