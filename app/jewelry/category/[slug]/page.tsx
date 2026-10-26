import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CatalogCard } from "../../../../features/catalog/CatalogCard"
import { SeoJsonLd } from "../../../../features/seo/SeoJsonLd"
import { SiteFooter } from "../../../../features/shell/SiteFooter"
import { StorefrontHeader } from "../../../../features/shell/StorefrontHeader"
import { TrustStrip } from "../../../../features/shell/TrustStrip"
import { isJewelryProduct } from "../../../../lib/domain/catalog-discovery"
import { primaryProductImage } from "../../../../lib/domain/catalog"
import { jewelryCategoryForSlug } from "../../../../lib/domain/jewelry-seo-categories"
import { withVerifiedStorefrontBadges } from "../../../../lib/server/product-badge-evidence"
import { getPublicCatalogConfig, getPublicStoreSettings } from "../../../../lib/server/public-storefront"
import { defaultStoreSettings } from "../../../../lib/server/store-settings"

export const dynamic = "force-dynamic"
const siteUrl = "https://shopcelebration.in"
type Params = Promise<{ slug: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const category = jewelryCategoryForSlug(slug)
  if (!category) return { title: "Category not found", robots: { index: false, follow: false } }
  // A DB outage should not turn a known live category into a soft-404/noindex.
  const { catalog } = await getPublicCatalogConfig()
  const hasProducts = catalog.products.some((item) => item.active !== false && item.category === category.name && isJewelryProduct(item))
  if (!hasProducts) return { title: "Category not found", robots: { index: false, follow: false } }
  const canonical = `/jewelry/category/${category.slug}`
  const description = `Explore Celebration's ${category.name} collection with genuine product photos, item details and secure ordering.`
  const filtered = ["q", "sort", "price", "view", "category"].some((key) => Boolean(query[key]))
  return {
    title: `Shop ${category.name} Online`,
    description,
    alternates: { canonical },
    robots: { index: !filtered, follow: true },
    openGraph: { type: "website", url: canonical, title: `${category.name} | Celebration`, description }
  }
}

export default async function JewelryCategoryPage({ params }: { params: Params }) {
  const { slug } = await params
  const category = jewelryCategoryForSlug(slug)
  if (!category) notFound()
  // Fail with a retriable server error rather than serving indexable empty HTML.
  const [catalogResult, settingsResult] = await Promise.all([getPublicCatalogConfig(), getPublicStoreSettings().catch(() => null)])
  const products = (await withVerifiedStorefrontBadges(catalogResult.catalog)).products
    .filter((item) => item.active !== false && item.category === category.name && isJewelryProduct(item))
  if (!products.length) notFound()
  const url = `${siteUrl}/jewelry/category/${category.slug}`
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    url,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => {
        const image = primaryProductImage(product)?.url
        return {
          "@type": "ListItem",
          position: index + 1,
          url: `${siteUrl}/jewelry/${encodeURIComponent(product.id)}`,
          name: product.name,
          ...(image ? { image: image.startsWith("/") ? siteUrl + image : image } : {})
        }
      })
    }
  }
  return <main className="collectionPage">
    <SeoJsonLd data={data} />
    <TrustStrip />
    <StorefrontHeader settings={settingsResult?.settings || defaultStoreSettings} />
    <section className="collectionHero">
      <picture><source media="(max-width: 700px)" srcSet="/images/campaign/jewelry-800.webp" /><Image className="collectionHeroImage" src="/images/campaign/jewelry-1600.webp" alt="" width={1600} height={900} unoptimized loading="eager" fetchPriority="high" /></picture>
      <div className="collectionHeroShade" />
      <div className="wrap collectionHeroContent">
        <div className="collectionEyebrow">The Celebration collection</div>
        <h1>{category.name}</h1>
        <p>Explore the available pieces in this collection.</p>
        <a className="collectionHeroCta" href="#collection">Explore the collection <span aria-hidden="true">↓</span></a>
      </div>
    </section>
    <section className="collectionSection" id="collection"><div className="wrap collectionContainer">
      <nav className="collectionBreadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span aria-hidden="true">›</span>
        <Link href="/jewelry">Jewelry</Link><span aria-hidden="true">›</span>
        <span aria-current="page">{category.name}</span>
      </nav>
      <div className="collectionResultMeta"><span><b>{products.length}</b> {products.length === 1 ? "product" : "products"}</span><p>{category.name}</p></div>
      <div className="collectionGrid">{products.map((product) => <CatalogCard key={product.id} product={product} />)}</div>
    </div></section>
    <SiteFooter />
  </main>
}
