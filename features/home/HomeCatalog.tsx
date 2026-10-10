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
      <div className="celebrationSectionHead"><div><span className="celebrationEyebrow">RINGS / NECKLACES / SETS</span><h2>Shop by category</h2></div><Link href="/jewelry?view=all" prefetch={false}>Browse all <StoreIcon name="arrow" size={17} /></Link></div>
      <div className="celebrationCategoryRail">
        {categories.map((category, index) => {
          const photo = products.find((product) => product.category === category.id && product.imageUrl)
          return <Link className="celebrationCategory" href={`/jewelry?view=all&category=${encodeURIComponent(category.id)}`} key={category.id} prefetch={false}>
            <div className="celebrationCategoryArt">{photo ? <CatalogProductImage product={photo} /> : <><small>THE GIFT EDIT · {String(index + 1).padStart(2, "0")}</small><span aria-hidden="true">{category.label.slice(0, 1)}</span><i aria-hidden="true">✦</i></>}</div>
            <b>{category.label}</b><span>Browse pieces <span aria-hidden="true">→</span></span>
          </Link>
        })}
      </div>
    </section>
    {photographed.length > 0 && <section className="celebrationFeatured wrap"><div className="celebrationSectionHead"><div><span className="celebrationEyebrow">FROM THE COLLECTION</span><h2>Take a closer look</h2></div><Link href="/jewelry?view=all" prefetch={false}>View all <StoreIcon name="arrow" size={17} /></Link></div><div className="collectionGrid">{photographed.map((product) => <CatalogCard key={product.id} product={product} />)}</div></section>}
    <div className="celebrationEdits wrap">
      <Link className="celebrationEdit jewelryEdit" href="/jewelry" prefetch={false}><picture><source media="(max-width:640px)" srcSet="/images/campaign/jewelry-800.webp" /><Image src="/images/campaign/jewelry-1600.webp" alt="" width={1600} height={900} unoptimized loading="lazy" /></picture><div><span className="celebrationEyebrow">SHOP JEWELRY</span><h2>Rings, necklaces<br /><em>and more.</em></h2><span className="celebrationEditLink">Browse jewelry <StoreIcon name="arrow" size={18} /></span></div></Link>
      <a className="celebrationEdit giftingEdit" href="#budgets"><picture><source media="(max-width:640px)" srcSet="/images/campaign/occasion-800.webp" /><Image src="/images/campaign/occasion-1600.webp" alt="" width={1600} height={900} unoptimized loading="lazy" /></picture><div><span className="celebrationEyebrow">CUSTOM HAMPERS</span><h2>Start with<br /><em>your budget.</em></h2><span className="celebrationEditLink">Choose a hamper <StoreIcon name="arrow" size={18} /></span></div></a>
    </div>
  </>
}
