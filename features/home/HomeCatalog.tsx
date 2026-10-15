import Link from "next/link"
import Image from "next/image"
import { categoriesForCatalog, isIndividuallySellable, primaryProductImage, visibleProducts, type GiftProduct, type CatalogConfig } from "../../lib/domain/catalog"
import { CatalogCard, CatalogProductImage } from "../catalog/CatalogCard"
import { StoreIcon } from "../shell/StoreIcon"
import { CategoryEditorialPhoto } from "./CategoryEditorialPhoto"

export function HomeCatalog({ catalog, categoryMedia = {} }: { catalog: CatalogConfig; categoryMedia?: Record<string, string> }) {
  const products = visibleProducts(catalog)
  const existingCategories = categoriesForCatalog(catalog).filter((item) => item.id !== catalog.settings.allCategory.id)
  const categories = existingCategories.some((item) => item.id === "Earrings") ? existingCategories : [...existingCategories, { id: "Earrings", label: "Earrings" }]
  // Feature a real purchasable item from several collections instead of four
  // near-identical items from the first necklace category. Never fake badges.
  const featuredOrder = [
    "Adjustable Rings", "Trending Necklaces",
    "Gold-Plated Bangles & Bracelets", "Necklace + Earrings Sets"
  ]
  const selectedIds = new Set<string>()
  const selected = featuredOrder.map((category) =>
    products.find((item) => item.category === category && !!primaryProductImage(item) && isIndividuallySellable(item))
  ).filter((item): item is GiftProduct => {
    if (!item || selectedIds.has(item.id)) return false
    selectedIds.add(item.id)
    return true
  })
  const photographed = [...selected, ...products.filter((item) =>
    !selectedIds.has(item.id) && !!primaryProductImage(item) && isIndividuallySellable(item)
  )].slice(0, 4)
  return <>
    <section className="celebrationCategories wrap" id="products">
      <div className="celebrationSectionHead">
        <div>
          <span className="celebrationEyebrow">FIND SOMETHING YOU LOVE</span>
          <h2>Shop by category</h2>
        </div>
        <Link href="/jewelry?view=all" prefetch={false}>Explore all <StoreIcon name="arrow" size={17} /></Link>
      </div>
      <p className="celebrationCategorySwipeHint" aria-hidden="true">Swipe to explore <span>→</span></p>
      <div className="celebrationCategoryRail" role="region" tabIndex={0} aria-label="Swipe or scroll through Celebration shopping categories">
        {categories.map((category, index) => {
          // Keep each category photograph owned by a real product in that category.
          // Do not substitute a different SKU when media is missing.
          const photo = products.find((product) => product.category === category.id && primaryProductImage(product))
          const editorial = categoryMedia[category.id]
          return <Link className="celebrationCategory" href={`/jewelry?view=all&category=${encodeURIComponent(category.id)}`} key={category.id} prefetch={false}>
            <div className="celebrationCategoryArt">
              {editorial ? <CategoryEditorialPhoto src={editorial} label={category.label} eager={index < 3} /> : photo ? <CatalogProductImage product={photo} /> : <span className="celebrationCategoryGlyph" aria-hidden="true">{category.label.slice(0, 1)}</span>}
            </div>
            <b>{category.label}</b>
            <span className="celebrationCategorySub">Browse pieces <StoreIcon name="arrow" size={13} /></span>
          </Link>
        })}
        <Link className="celebrationCategory celebrationCategory--all" href="/jewelry?view=all" prefetch={false}>
          <div className="celebrationCategoryArt celebrationCategoryArt--editorial">
            {categoryMedia.__all__ ? <CategoryEditorialPhoto src={categoryMedia.__all__} label="All Jewellery" /> : <span className="celebrationCategoryGlyph" aria-hidden="true">✦</span>}
          </div>
          <b>All Jewellery</b>
          <span className="celebrationCategorySub">Shop the edit <StoreIcon name="arrow" size={13} /></span>
        </Link>
        <a className="celebrationCategory celebrationCategory--hamper" href="/curated-hampers">
          <div className="celebrationCategoryArt celebrationCategoryArt--editorial">
            {categoryMedia.__hamper__ ? <CategoryEditorialPhoto src={categoryMedia.__hamper__} label="Custom Hampers" /> : <StoreIcon name="gift" size={45} />}
          </div>
          <b>Custom Hampers</b>
          <span className="celebrationCategorySub">Create yours <StoreIcon name="arrow" size={13} /></span>
        </a>
      </div>
    </section>
    {photographed.length > 0 && <section className="celebrationFeatured wrap"><div className="celebrationSectionHead"><div><span className="celebrationEyebrow">FROM THE COLLECTION</span><h2>Take a closer look</h2></div><Link href="/jewelry?view=all" prefetch={false}>View all <StoreIcon name="arrow" size={17} /></Link></div><div className="collectionGrid">{photographed.map((product) => <CatalogCard key={product.id} product={product} imageVariant="main" />)}</div></section>}
    <div className="celebrationEdits wrap">
      <Link className="celebrationEdit jewelryEdit" href="/jewelry" prefetch={false}><picture><source media="(max-width:640px)" srcSet="/images/campaign/jewelry-800.webp" /><Image src="/images/campaign/jewelry-1600.webp" alt="" width={1600} height={900} unoptimized loading="lazy" /></picture><div><span className="celebrationEyebrow">SHOP JEWELRY</span><h2>Rings, necklaces<br /><em>and more.</em></h2><span className="celebrationEditLink">Browse jewelry <StoreIcon name="arrow" size={18} /></span></div></Link>
      <a className="celebrationEdit giftingEdit" href="#budgets"><picture><source media="(max-width:640px)" srcSet="/images/campaign/occasion-800.webp" /><Image src="/images/campaign/occasion-1600.webp" alt="" width={1600} height={900} unoptimized loading="lazy" /></picture><div><span className="celebrationEyebrow">CUSTOM HAMPERS</span><h2>Start with<br /><em>your budget.</em></h2><span className="celebrationEditLink">Choose a hamper <StoreIcon name="arrow" size={18} /></span></div></a>
    </div>
  </>
}
