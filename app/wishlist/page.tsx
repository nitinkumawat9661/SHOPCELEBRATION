import type { Metadata } from "next"
import Link from "next/link"
import { WishlistCollection } from "../../features/catalog/WishlistCollection"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { StorefrontHeader } from "../../features/shell/StorefrontHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { getCatalogConfig } from "../../lib/server/catalog"
import { withVerifiedStorefrontBadges } from "../../lib/server/product-badge-evidence"
import { defaultStoreSettings, getStoreSettings } from "../../lib/server/store-settings"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Saved Jewellery",
  description: "Find jewellery saved with your Celebration account across devices, or locally before sign-in.",
  robots: { index: false, follow: true }
}

export default async function WishlistPage() {
  const [catalog, settings] = await Promise.all([
    getCatalogConfig().catch(() => null),
    getStoreSettings().catch(() => null)
  ])
  const verified = catalog ? await withVerifiedStorefrontBadges(catalog.catalog) : null
  return <main className="collectionPage">
    <TrustStrip />
    <StorefrontHeader settings={settings?.settings || defaultStoreSettings} />
    <section className="collectionSection wishlistPage">
      <div className="wrap collectionContainer">
        <div className="collectionBreadcrumb"><Link href="/">Home</Link><span aria-hidden="true">›</span><Link href="/jewelry?view=all">Jewellery</Link><span aria-hidden="true">›</span><span>Saved pieces</span></div>
        <header className="wishlistHeading">
          <span className="collectionEyebrow">YOUR SHORTLIST</span>
          <h1>Saved pieces</h1>
          <p>Keep the pieces you love in one place. Sign in with your Celebration account to access saved pieces on your phone, laptop and other devices.</p>
        </header>
        <WishlistCollection products={verified?.products || []} available={Boolean(catalog)} />
      </div>
    </section>
    <SiteFooter />
  </main>
}
