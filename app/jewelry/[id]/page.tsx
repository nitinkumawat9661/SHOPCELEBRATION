import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CatalogCard } from "../../../features/catalog/CatalogCard"
import { ProductGallery } from "../../../features/catalog/ProductGallery"
import { AddToCart } from "../../../features/cart/AddToCart"
import { SiteFooter } from "../../../features/shell/SiteFooter"
import { StorefrontHeader } from "../../../features/shell/StorefrontHeader"
import { TrustStrip } from "../../../features/shell/TrustStrip"
import { isJewelryProduct } from "../../../lib/domain/catalog-discovery"
import { formatMoney } from "../../../lib/domain/money"
import { isIndividuallySellable } from "../../../lib/domain/catalog"
import { getCatalogConfig } from "../../../lib/server/catalog"
import { defaultStoreSettings, getStoreSettings } from "../../../lib/server/store-settings"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "A Thoughtful Gift | Celebration" }

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, catalog, settings] = await Promise.all([params, getCatalogConfig().catch(() => null), getStoreSettings().catch(() => null)])
  const product = catalog?.catalog.products.find((item) => item.id === id && item.active !== false)
  const individual = product ? isIndividuallySellable(product) : false
  if (catalog && !product) notFound()
  const collectionUrl = product && isJewelryProduct(product) ? "/jewelry" : "/jewelry?view=all"
  const related = catalog?.catalog.products.filter((item) => item.active !== false && item.id !== id && item.category === product?.category).slice(0, 4) || []

  return (
    <main className="collectionPage">
      <TrustStrip /><StorefrontHeader settings={settings?.settings || defaultStoreSettings} />
      {!product ? <section className="collectionSection"><div className="wrap collectionEmpty" role="status"><h1>This gift couldn’t load just now.</h1><p>Please try again in a moment.</p><Link href={`/jewelry/${encodeURIComponent(id)}`}>Try again →</Link><Link href="/jewelry?view=all">Back to the collection</Link></div></section> : <>
        <div className="wrap collectionBreadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">›</span><Link href={collectionUrl}>Collection</Link><span aria-hidden="true">›</span><span>{product.name}</span></div>
        <section className="collectionDetail"><div className="wrap collectionDetailGrid">
          <div className="collectionDetailVisual"><ProductGallery product={product} /></div>
          <div className="collectionDetailInfo">
            <span className="collectionEyebrow">{product.category}</span><h1>{product.name}</h1>
            {product.note && <p className="collectionDetailNote">{product.note}</p>}
            {product.highlights?.length ? <ul className="marketplaceHighlights">{product.highlights.map((item) => <li key={item}>{item}</li>)}</ul> : null}
            <div className="collectionDetailPrice"><span>{individual ? "Individual item" : "In hampers from"}</span><strong>{formatMoney(individual ? product.salePricePaise! / 100 : product.minTier)}</strong><small>{individual ? "Buy this item on its own. No additional shipping fee at checkout." : "Hamper budget, not an individual item price."}</small></div>
            <div className="collectionDetailActions">
              {individual ? <><AddToCart productId={product.id} /><AddToCart productId={product.id} buyNow /></> : <Link className="collectionApply" href="/#budgets">Choose your hamper <span aria-hidden="true">→</span></Link>}
              <Link className="collectionDetailBack" href={collectionUrl}>Keep exploring</Link>
            </div>
            {product.prepackagedRetail && product.retail && <section className="retailDeclarations" aria-label="Product declarations">
              <h2>Product declarations</h2>
              <dl>
                {product.retail.genericName && <div><dt>Generic name</dt><dd>{product.retail.genericName}</dd></div>}
                {product.retail.netQuantity && <div><dt>Net quantity</dt><dd>{product.retail.netQuantity}</dd></div>}
                {product.retail.mrpPaise && <div><dt>MRP (incl. taxes)</dt><dd>{formatMoney(product.retail.mrpPaise / 100)}</dd></div>}
                {product.retail.unitSalePrice && <div><dt>Unit sale price</dt><dd>{product.retail.unitSalePrice}</dd></div>}
                {product.retail.countryOfOrigin && <div><dt>Country of origin</dt><dd>{product.retail.countryOfOrigin}</dd></div>}
                {product.retail.manufacturerOrPackerName && <div><dt>Manufacturer / packer</dt><dd>{product.retail.manufacturerOrPackerName}</dd></div>}
                {product.retail.manufacturerOrPackerAddress && <div className="wide"><dt>Manufacturer / packer address</dt><dd>{product.retail.manufacturerOrPackerAddress}</dd></div>}
                {product.retail.importerName && <div><dt>Importer</dt><dd>{product.retail.importerName}</dd></div>}
                {product.retail.importerAddress && <div className="wide"><dt>Importer address</dt><dd>{product.retail.importerAddress}</dd></div>}
                {product.retail.consumerCare && <div className="wide"><dt>Consumer care</dt><dd>{product.retail.consumerCare}</dd></div>}
                {product.retail.bestBefore && <div><dt>Best / use before</dt><dd>{product.retail.bestBefore}</dd></div>}
                {product.retail.warrantyOrGuarantee && <div className="wide"><dt>Warranty / guarantee</dt><dd>{product.retail.warrantyOrGuarantee}</dd></div>}
              </dl>
            </section>}
            <div className="collectionDetailPromise"><span aria-hidden="true">♡</span><div><b>{individual ? "A little something, just for them" : "A thoughtful part of your hamper"}</b><p>{individual ? "Choose your quantity in the cart, add delivery details and pay securely online." : "Share your occasion and budget. Our team curates the gifts inside your hamper."}</p></div></div>
            <div className="collectionDetailAbout"><h2>Product details</h2><p>{product.description || (individual ? "This gift is available individually and within eligible hampers. For a curated gift set, share your occasion and budget with our team." : "This gift is currently available within our curated hampers. The final selection is curated for your occasion.")}</p><Link href="/policies">Delivery & order policies <span aria-hidden="true">→</span></Link>{individual && <Link href="/#budgets">Explore our curated hampers →</Link>}</div>
          </div>
        </div></section>
        {individual && <div className="mobileMarketplaceBuyBar" aria-label="Quick purchase controls"><div><small>{product.name}</small><b>{formatMoney(product.salePricePaise! / 100)}</b></div><AddToCart productId={product.id} /><AddToCart productId={product.id} buyNow /></div>}
        {related.length > 0 && <section className="collectionRelated"><div className="wrap collectionContainer"><div className="collectionHeading"><div><span className="collectionEyebrow">Keep the inspiration going</span><h2>More thoughtful details</h2></div><Link href={collectionUrl}>View collection →</Link></div><div className="collectionGrid">{related.map((item) => <CatalogCard product={item} key={item.id} />)}</div></div></section>}
      </>}
      <SiteFooter />
    </main>
  )
}
