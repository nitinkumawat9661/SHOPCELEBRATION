import Link from "next/link"
import Image from "next/image"
import { categoriesForCatalog, visibleProducts, type CatalogConfig } from "../../lib/domain/catalog"
import { CatalogCard, CatalogProductImage } from "../catalog/CatalogCard"
import { StoreIcon } from "../shell/StoreIcon"

export function HomeCatalog({ catalog }: { catalog: CatalogConfig }) {
  const products = visibleProducts(catalog)
  const categories = categoriesForCatalog(catalog).filter((item) => item.id !== catalog.settings.allCategory.id)
  const photographed = products.filter((item) => item.imageUrl).slice(0, 4)
  return <>
    <section className="celebrationCategories wrap" id="products">
      <div className="celebrationSectionHead"><div><span className="celebrationEyebrow">Little things. Lasting memories.</span><h2>Shop by category</h2></div><Link href="/jewelry?view=all" prefetch={false}>Explore all <StoreIcon name="arrow" size={17} /></Link></div>
      <div className="celebrationCategoryRail">
        {categories.map((category, index) => {
          const photo = products.find((product) => product.category === category.id && product.imageUrl)
          return <Link className="celebrationCategory" href={`/jewelry?view=all&category=${encodeURIComponent(category.id)}`} key={category.id} prefetch={false}>
            <div className="celebrationCategoryArt">{photo ? <CatalogProductImage product={photo} /> : <><small>THE GIFT EDIT · {String(index + 1).padStart(2, "0")}</small><span aria-hidden="true">{category.label.slice(0, 1)}</span><i aria-hidden="true">✦</i></>}</div>
            <b>{category.label}</b><span>Discover the edit <span aria-hidden="true">→</span></span>
          </Link>
        })}
      </div>
    </section>
    {photographed.length > 0 && <section className="celebrationFeatured wrap"><div className="celebrationSectionHead"><div><span className="celebrationEyebrow">From our gift collection</span><h2>Something they'll love</h2></div><Link href="/jewelry?view=all" prefetch={false}>View all <StoreIcon name="arrow" size={17} /></Link></div><div className="collectionGrid">{photographed.map((product) => <CatalogCard key={product.id} product={product} />)}</div></section>}
    <div className="celebrationEdits wrap">
      <Link className="celebrationEdit jewelryEdit" href="/jewelry" prefetch={false}><picture><source media="(max-width:640px)" srcSet="/images/campaign/jewelry-800.webp" /><Image src="/images/campaign/jewelry-1600.webp" alt="" width={1600} height={900} unoptimized loading="lazy" /></picture><div><span className="celebrationEyebrow">Small details. Big feelings.</span><h2>A little<br /><em>everyday magic.</em></h2><span className="celebrationEditLink">Explore jewelry <StoreIcon name="arrow" size={18} /></span></div></Link>
      <a className="celebrationEdit giftingEdit" href="#budgets"><picture><source media="(max-width:640px)" srcSet="/images/campaign/occasion-800.webp" /><Image src="/images/campaign/occasion-1600.webp" alt="" width={1600} height={900} unoptimized loading="lazy" /></picture><div><span className="celebrationEyebrow">Wrapped in thoughtfulness</span><h2>The joy is<br /><em>in the giving.</em></h2><span className="celebrationEditLink">Find your hamper <StoreIcon name="arrow" size={18} /></span></div></a>
    </div>
  </>
}
