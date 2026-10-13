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
  return <main className="collectionPage celebrationWishlistPage">
    <TrustStrip />
    <StorefrontHeader settings={settings?.settings || defaultStoreSettings} />
    <section className="collectionSection wishlistPage wishlistPresentation">
      <div className="wrap collectionContainer">
        <nav className="wishlistBreadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span>
          <Link href="/jewelry?view=all">Jewelry</Link><span aria-hidden="true">/</span>
          <span aria-current="page">Saved pieces</span>
        </nav>
        <header className="wishlistHeading wishlistHero">
          <div className="wishlistHeroCopy">
            <span className="wishlistEyebrow">CELEBRATION · YOUR COLLECTION</span>
            <h1>Pieces you <em>love.</em></h1>
            <p>Every little favorite, beautifully kept in one place. Sign in with your Celebration account to see saved pieces on your phone, laptop and other devices.</p>
            <Link href="/jewelry?view=all" className="wishlistHeroBrowse">Explore more jewelry <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="wishlistHeroArt" aria-hidden="true">
            <span className="wishlistHeroArtFrame"><span>♡</span><small>CURATED BY YOU</small></span>
          </div>
        </header>
        <WishlistCollection products={verified?.products || []} available={Boolean(catalog)} />
      </div>
    </section>
    <SiteFooter />
  </main>
}
