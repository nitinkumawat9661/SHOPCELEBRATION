import Image from "next/image"
import Link from "next/link"
import { isIndividuallySellable, type GiftProduct } from "../../lib/domain/catalog"
import { discoverProducts, type CatalogDiscovery } from "../../lib/domain/catalog-discovery"
import { CatalogCard } from "./CatalogCard"

export function CatalogCollection({ products, filters, available = true }: { products: GiftProduct[]; filters: CatalogDiscovery; available?: boolean }) {
  const all = filters.view === "all"
  const collection = discoverProducts(products, { view: filters.view })
  const visible = discoverProducts(products, filters)
  const individual = collection.some(isIndividuallySellable)
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
          <div className="collectionHeading">
            <div><span className="collectionEyebrow">A little something, chosen with love</span><h2>{all ? "Explore our gifts" : "The jewelry edit"}</h2></div>
            <nav className="collectionViews" aria-label="Collections"><Link href="/jewelry" className={!all ? "active" : ""} aria-current={!all ? "page" : undefined}>Jewelry</Link><Link href="/jewelry?view=all" className={all ? "active" : ""} aria-current={all ? "page" : undefined}>All gifts</Link></nav>
          </div>
          {available && <div className="collectionResultMeta"><span>{visible.length} {visible.length === 1 ? "gift" : "gifts"}{filters.q ? ` matching “${filters.q}”` : " to discover"}</span><p>{individual ? "Shop individual items where marked, or explore our curated hampers." : "Available within our curated hampers."}</p></div>}
          {!available ? <div className="collectionEmpty" role="status"><h3>We’re refreshing the collection.</h3><p>The latest gifts couldn’t load just now. Please try again shortly.</p><Link href={all ? "/jewelry?view=all" : "/jewelry"}>Reload collection →</Link></div> : visible.length ? <div className="collectionGrid">{visible.map((product) => <CatalogCard key={product.id} product={product} />)}</div> : <div className="collectionEmpty"><span className="collectionEmptyMark" aria-hidden="true">♡</span><h3>{collection.length ? "A different search might find it." : "More lovely things are on their way."}</h3><p>{collection.length ? "Try another name or category to explore the collection." : "Explore our other gifts, or let us curate a hamper for your occasion."}</p><Link href={all ? "/jewelry?view=all" : "/jewelry?view=all"}>Explore all gifts →</Link><Link href="/#budgets">Choose a hamper budget</Link></div>}
          <aside className="collectionNote"><span aria-hidden="true">✧</span><div><h3>Every detail, part of a bigger surprise.</h3><p>{individual ? "Choose a piece for yourself or someone special, or let Celebration curate a hamper around your occasion and budget." : "Choose a hamper budget and share your occasion. Celebration curates the products inside your hamper."}</p></div><Link href="/#budgets">Find your hamper <span aria-hidden="true">→</span></Link></aside>
        </div>
      </section>
    </>
  )
}
