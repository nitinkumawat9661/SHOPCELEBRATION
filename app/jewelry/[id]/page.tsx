import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CatalogCard, CatalogProductImage } from "../../../features/catalog/CatalogCard"
import { SiteFooter } from "../../../features/shell/SiteFooter"
import { StorefrontHeader } from "../../../features/shell/StorefrontHeader"
import { TrustStrip } from "../../../features/shell/TrustStrip"
import { isJewelryProduct } from "../../../lib/domain/catalog-discovery"
import { formatMoney } from "../../../lib/domain/money"
import { getCatalogConfig } from "../../../lib/server/catalog"
import { defaultStoreSettings, getStoreSettings } from "../../../lib/server/store-settings"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "A Thoughtful Gift | Celebration" }

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, catalog, settings] = await Promise.all([params, getCatalogConfig().catch(() => null), getStoreSettings().catch(() => null)])
  const product = catalog?.catalog.products.find((item) => item.id === id && item.active !== false)
  if (catalog && !product) notFound()
  const collectionUrl = product && isJewelryProduct(product) ? "/jewelry" : "/jewelry?view=all"
  const related = catalog?.catalog.products.filter((item) => item.active !== false && item.id !== id && item.category === product?.category).slice(0, 4) || []

  return (
    <main className="collectionPage">
      <TrustStrip /><StorefrontHeader settings={settings?.settings || defaultStoreSettings} />
      {!product ? <section className="collectionSection"><div className="wrap collectionEmpty" role="status"><h1>This gift couldn’t load just now.</h1><p>Please try again in a moment.</p><Link href={`/jewelry/${encodeURIComponent(id)}`}>Try again →</Link><Link href="/jewelry?view=all">Back to the collection</Link></div></section> : <>
        <div className="wrap collectionBreadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">›</span><Link href={collectionUrl}>Collection</Link><span aria-hidden="true">›</span><span>{product.name}</span></div>
        <section className="collectionDetail"><div className="wrap collectionDetailGrid">
          <div className="collectionDetailVisual"><CatalogProductImage product={product} priority /></div>
          <div className="collectionDetailInfo"><span className="collectionEyebrow">{product.category}</span><h1>{product.name}</h1>{product.note && <p className="collectionDetailNote">{product.note}</p>}<div className="collectionDetailPrice"><span>In hampers from</span><strong>{formatMoney(product.minTier)}</strong><small>Hamper budget, not an individual item price.</small></div><div className="collectionDetailActions"><Link className="collectionApply" href="/#budgets">Choose your hamper <span aria-hidden="true">→</span></Link><Link className="collectionDetailBack" href={collectionUrl}>Keep exploring</Link></div><div className="collectionDetailPromise"><span aria-hidden="true">♡</span><div><b>A thoughtful part of your hamper</b><p>Share your occasion and budget. Our team curates the gifts inside your hamper.</p></div></div><div className="collectionDetailAbout"><h2>Made for a thoughtful surprise</h2><p>This gift is part of our hamper collection. Individual items are not sold separately, and the final selection is curated for your occasion.</p><Link href="/policies">Delivery & order policies <span aria-hidden="true">→</span></Link></div></div>
        </div></section>
        {related.length > 0 && <section className="collectionRelated"><div className="wrap collectionContainer"><div className="collectionHeading"><div><span className="collectionEyebrow">Keep the inspiration going</span><h2>More thoughtful details</h2></div><Link href={collectionUrl}>View collection →</Link></div><div className="collectionGrid">{related.map((item) => <CatalogCard product={item} key={item.id} />)}</div></div></section>}
      </>}
      <SiteFooter />
    </main>
  )
}
