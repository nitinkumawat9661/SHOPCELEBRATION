import Image from "next/image"
import Link from "next/link"
import { isIndividuallySellable, type GiftProduct } from "../../lib/domain/catalog"
import { discoverProducts, type CatalogDiscovery } from "../../lib/domain/catalog-discovery"
import { CatalogCard } from "./CatalogCard"
import { JewelryMarketplaceFilters } from "./JewelryMarketplaceFilters"

export function CatalogCollection({ products, filters, available = true }: { products: GiftProduct[]; filters: CatalogDiscovery; available?: boolean }) {
  const all = filters.view === "all"
  const collection = discoverProducts(products, { view: filters.view })
  const visible = discoverProducts(products, filters)
  const individual = collection.some(isIndividuallySellable)
  const hasFilters = Boolean(filters.q || filters.category || filters.sort || filters.price)
  const categoryCounts = Array.from(collection.reduce((map, product) => map.set(product.category, (map.get(product.category) || 0) + 1), new Map<string, number>()))
    .map(([value, count]) => ({ value, label: value, count }))
  const title = all ? "Little things. Lasting memories." : "Jewelry, with a little meaning."

  return (
    <>
      <section className="collectionHero">
        <picture><source media="(max-width: 700px)" srcSet="/images/campaign/jewelry-800.webp" /><Image className="collectionHeroImage" src="/images/campaign/jewelry-1600.webp" alt="" width={1600} height={900} unoptimized loading="eager" fetchPriority="high" /></picture>
        <div className="collectionHeroShade" />
        <div className="wrap collectionHeroContent">
          <div className="collectionEyebrow">The Celebration collection</div>
          <h1>{title}</h1>
          <p>{all ? "Discover the thoughtful details that make a gift feel personal." : "Thoughtful pieces for someone who means everything."}</p>
          <a className="collectionHeroCta" href="#collection">Explore the collection <span aria-hidden="true">↓</span></a>
        </div>
      </section>
      <section className="collectionSection" id="collection">
        <div className="wrap collectionContainer">
          {available && <JewelryMarketplaceFilters categories={categoryCounts} />}
          {available && <div className="collectionResultMeta"><span><b>{visible.length}</b> {visible.length === 1 ? "product" : "products"}{filters.category ? ` in ${filters.category}` : ""}</span><p>{filters.category || filters.price || filters.sort ? "Filtered results" : "Browse the full jewelry collection"}</p></div>}
          {!available ? <div className="collectionEmpty" role="status"><h3>We’re refreshing the collection.</h3><p>The latest gifts couldn’t load just now. Please try again shortly.</p><Link href={all ? "/jewelry?view=all" : "/jewelry"}>Reload collection →</Link></div> : visible.length ? <div className="collectionGrid">{visible.map((product) => <CatalogCard key={product.id} product={product} />)}</div> : <div className="collectionEmpty"><span className="collectionEmptyMark" aria-hidden="true">♡</span><h3>{collection.length ? "A different search might find it." : "More lovely things are on their way."}</h3><p>{collection.length ? "Try another name or category to explore the collection." : "Explore our other gifts, or let us curate a hamper for your occasion."}</p><Link href={all ? "/jewelry?view=all" : "/jewelry?view=all"}>Explore all gifts →</Link><Link href="/#budgets">Choose a hamper budget</Link></div>}
          <aside className="collectionNote"><span aria-hidden="true">✧</span><div><h3>Every detail, part of a bigger surprise.</h3><p>{individual ? "Choose a piece for yourself or someone special, or let Celebration curate a hamper around your occasion and budget." : "Choose a hamper budget and share your occasion. Celebration curates the products inside your hamper."}</p></div><Link href="/#budgets">Find your hamper <span aria-hidden="true">→</span></Link></aside>
          {!hasFilters && <section className="collectionSeoBlock" aria-labelledby="jewelry-shopping-guide">
            <div className="kicker">SHOPPING GUIDE</div>
            <h2 id="jewelry-shopping-guide">Affordable jewelry online for everyday gifting</h2>
            <p>Browse Celebration rings, necklaces, bangles and bracelets by category and price. Live stock is checked again before payment, so a piece that has sold out cannot be silently accepted as a new order.</p>
            <div className="collectionSeoGrid">
              <article><h3>Anti-tarnish coverage</h3><p>Only pieces specifically marked with Celebration’s 6-month anti-tarnish guarantee receive that commercial coverage. Claim terms and care exclusions are published before purchase.</p></article>
              <article><h3>Clear checkout</h3><p>Displayed individual-item prices include standard delivery where stated. Pincode serviceability is checked before payment, and paid orders can be followed through Celebration order tracking.</p></article>
              <article><h3>Choosing between stores?</h3><p>Material, price, catalogue size and gifting services differ widely across jewellery stores. See our transparent comparison of Celebration with larger jewellery and gifting platforms.</p><Link href="/compare">Compare shopping options →</Link></article>
            </div>
          </section>}
        </div>
      </section>
    </>
  )
}
