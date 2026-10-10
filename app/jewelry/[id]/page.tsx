import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CatalogCard } from "../../../features/catalog/CatalogCard"
import { SeoJsonLd } from "../../../features/seo/SeoJsonLd"
import { ProductGallery } from "../../../features/catalog/ProductGallery"
import { ProductReviews } from "../../../features/catalog/ProductReviews"
import { ProductHowToStyle } from "../../../features/catalog/ProductHowToStyle"
import { ProductFitDetails } from "../../../features/catalog/ProductFitDetails"
import { approvedProductReviews } from "../../../lib/server/product-reviews"
import { AddToCart } from "../../../features/cart/AddToCart"
import { ProductViewAnalytics } from "../../../features/analytics/ProductViewAnalytics"
import { SiteFooter } from "../../../features/shell/SiteFooter"
import { StorefrontHeader } from "../../../features/shell/StorefrontHeader"
import { TrustStrip } from "../../../features/shell/TrustStrip"
import { isJewelryProduct } from "../../../lib/domain/catalog-discovery"
import { formatMoney } from "../../../lib/domain/money"
import { isIndividualListing, isIndividuallySellable, primaryProductImage } from "../../../lib/domain/catalog"
import { productSavingLabel } from "../../../lib/domain/catalog-badges"
import { getCatalogConfig } from "../../../lib/server/catalog"
import { withVerifiedStorefrontBadges } from "../../../lib/server/product-badge-evidence"
import { defaultStoreSettings, getStoreSettings } from "../../../lib/server/store-settings"

export const dynamic = "force-dynamic"
const siteUrl = "https://shopcelebration.in"

function productDescription(name: string, category: string, description?: string) {
  const clean = description?.trim()
  if (clean) return clean.slice(0, 155)
  return `Shop ${name} from Celebration's ${category} collection. Secure online payment, delivery included where shown, live stock checks and order tracking.`
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const catalog = await getCatalogConfig().catch(() => null)
  const product = catalog?.catalog.products.find((item) => item.id === id && item.active !== false)
  if (!product) return { title: "Product not found", robots: { index: false, follow: false } }
  const image = primaryProductImage(product)?.url
  const description = productDescription(product.name, product.category, product.description)
  const canonical = `/jewelry/${encodeURIComponent(product.id)}`
  return {
    title: product.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${product.name} | Celebration`,
      description,
      images: image ? [{ url: image, alt: product.name }] : undefined
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} | Celebration`,
      description,
      images: image ? [image] : undefined
    }
  }
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, catalog, settings] = await Promise.all([params, getCatalogConfig().catch(() => null), getStoreSettings().catch(() => null)])
  const storefrontCatalog = catalog ? await withVerifiedStorefrontBadges(catalog.catalog) : null
  const product = storefrontCatalog?.products.find((item) => item.id === id && item.active !== false)
  const reviewsResult = product
    ? await approvedProductReviews(product.id)
      .then((items) => ({ items, unavailable: false }))
      .catch((error) => { console.error("product-reviews-public", error); return { items: [], unavailable: true } })
    : { items: [], unavailable: false }
  const listed = product ? isIndividualListing(product) : false
  const individual = product ? isIndividuallySellable(product) : false
  const soldOut = Boolean(product && listed && !individual)
  const savings = product && listed ? productSavingLabel(product) : null
  const mrpPaise = product && listed ? product.retail?.mrpPaise : undefined
  if (catalog && !product) notFound()
  const collectionUrl = product && isJewelryProduct(product) ? "/jewelry" : "/jewelry?view=all"
  const related = storefrontCatalog?.products.filter((item) => item.active !== false && item.id !== id && item.category === product?.category).slice(0, 4) || []
  const image = product ? primaryProductImage(product)?.url : undefined
  const productUrl = product ? `${siteUrl}/jewelry/${encodeURIComponent(product.id)}` : ""
  const structuredData = product ? [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      sku: product.id,
      category: product.category,
      description: productDescription(product.name, product.category, product.description),
      image: image ? [image.startsWith("/") ? `${siteUrl}${image}` : image] : undefined,
      ...(listed ? {
        offers: {
          "@type": "Offer",
          url: productUrl,
          priceCurrency: "INR",
          price: (product.salePricePaise! / 100).toFixed(2),
          availability: individual ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@type": "Organization", name: "Celebration", url: siteUrl }
        }
      } : {})
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Jewelry & Gifts", item: `${siteUrl}/jewelry` },
        { "@type": "ListItem", position: 3, name: product.name, item: productUrl }
      ]
    }
  ] : null

  return (
    <main className="collectionPage">
      {structuredData && <SeoJsonLd data={structuredData} />}
      {product && listed && typeof product.salePricePaise === "number" && <ProductViewAnalytics productId={product.id} name={product.name} category={product.category} pricePaise={product.salePricePaise} />}
      <TrustStrip /><StorefrontHeader settings={settings?.settings || defaultStoreSettings} />
      {!product ? <section className="collectionSection"><div className="wrap collectionEmpty" role="status"><h1>This gift couldn’t load just now.</h1><p>Please try again in a moment.</p><Link href={`/jewelry/${encodeURIComponent(id)}`}>Try again →</Link><Link href="/jewelry?view=all">Back to the collection</Link></div></section> : <>
        <div className="wrap collectionBreadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">›</span><Link href={collectionUrl}>Collection</Link><span aria-hidden="true">›</span><span>{product.name}</span></div>
        <section className="collectionDetail"><div className="wrap collectionDetailGrid">
          <div className="collectionDetailVisual"><ProductGallery product={product} /></div>
          <div className="collectionDetailInfo">
            <span className="collectionEyebrow">{product.category}</span><h1>{product.name}</h1>
            {product.note && <p className="collectionDetailNote">{product.note}</p>}
            {product.highlights?.length ? <ul className="marketplaceHighlights">{product.highlights.map((item) => <li key={item}>{item}</li>)}</ul> : null}
            {product.retail?.warrantyOrGuarantee && <div className="antiTarnishGuarantee"><div><b>6-month anti-tarnish guarantee</b><span>Covered for verified tarnish issues under normal use. Keep dry and avoid perfume, sanitizer, soap, chlorine, salt water and harsh chemicals.</span></div><Link href="/policies">View coverage terms →</Link></div>}
            <div className="collectionDetailPrice"><span>{soldOut ? "Currently sold out" : listed ? "Individual item" : "In hampers from"}</span><strong>{formatMoney(listed ? product.salePricePaise! / 100 : product.minTier)}</strong>{listed && mrpPaise && product.salePricePaise && mrpPaise > product.salePricePaise ? <span><s>MRP {formatMoney(mrpPaise / 100)}</s>{savings ? ` · ${savings}` : null}</span> : null}<small>{soldOut ? "This piece is currently unavailable. Check back after a restock." : listed ? "Delivery included. No extra delivery charge is added at checkout; pincode availability is verified before payment." : "Hamper budget, not an individual item price."}</small></div>
            <div className="collectionDetailActions">
              {individual ? <><AddToCart productId={product.id} productName={product.name} productCategory={product.category} pricePaise={product.salePricePaise} maxQuantity={product.stockAvailable ?? 1} /><AddToCart productId={product.id} productName={product.name} productCategory={product.category} pricePaise={product.salePricePaise} maxQuantity={product.stockAvailable ?? 1} buyNow /></> : soldOut ? <span className="secondary" aria-disabled="true">Sold out</span> : <Link className="collectionApply" href="/#budgets">Choose your hamper <span aria-hidden="true">→</span></Link>}
              <Link className="collectionDetailBack" href={collectionUrl}>Keep exploring</Link>
            </div>
            <div className="marketplaceTrustGrid" aria-label="Shopping assurances">
              <div><span aria-hidden="true">🔒</span><b>Secure payment</b><small>Verified online checkout</small></div>
              {individual ? <div><span aria-hidden="true">✓</span><b>Live stock check</b><small>Availability rechecked before payment</small></div> : <div><span aria-hidden="true">🎥</span><b>Packing review</b><small>Hamper video before dispatch</small></div>}
              <div><span aria-hidden="true">📦</span><b>Order tracking</b><small>Follow progress online</small></div>
              <div><span aria-hidden="true">💬</span><b>Support</b><small>Help when you need it</small></div>
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
            <div className="collectionDetailPromise"><span aria-hidden="true">♡</span><div><b>{individual ? "Available to order individually" : "For a custom hamper"}</b><p>{individual ? "Choose your quantity in the cart, add delivery details and pay securely online." : "Share your occasion and budget. Our team curates the gifts inside your hamper."}</p></div></div>
            <ProductHowToStyle product={product} />
            <ProductFitDetails product={product} />
            <div className="collectionDetailAbout"><h2>Product details</h2><p>{product.description || (individual ? "This gift is available individually and within eligible hampers. For a curated gift set, share your occasion and budget with our team." : "This gift is currently available within our curated hampers. The final selection is curated for your occasion.")}</p><Link href="/policies">Delivery & order policies <span aria-hidden="true">→</span></Link><Link href="/faq">Shopping FAQs <span aria-hidden="true">→</span></Link>{individual && <Link href="/#budgets">Explore our curated hampers →</Link>}</div>
          </div>
        </div></section>
        {individual && <div className="mobileMarketplaceBuyBar" aria-label="Quick purchase controls"><div><small>{product.name}</small><b>{formatMoney(product.salePricePaise! / 100)}</b></div><AddToCart productId={product.id} productName={product.name} productCategory={product.category} pricePaise={product.salePricePaise} maxQuantity={product.stockAvailable ?? 1} /><AddToCart productId={product.id} productName={product.name} productCategory={product.category} pricePaise={product.salePricePaise} maxQuantity={product.stockAvailable ?? 1} buyNow /></div>}
        <ProductReviews productId={product.id} reviews={reviewsResult.items} reviewsUnavailable={reviewsResult.unavailable} />
        {related.length > 0 && <section className="collectionRelated"><div className="wrap collectionContainer"><div className="collectionHeading"><div><span className="collectionEyebrow">Keep the inspiration going</span><h2>More from this collection</h2></div><Link href={collectionUrl}>View collection →</Link></div><div className="collectionGrid">{related.map((item) => <CatalogCard product={item} key={item.id} />)}</div></div></section>}
      </>}
      <SiteFooter />
    </main>
  )
}
