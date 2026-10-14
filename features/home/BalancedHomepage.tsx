import Image from "next/image"
import Link from "next/link"
import { categoriesForCatalog, isIndividuallySellable, primaryProductImage, visibleProducts, type CatalogConfig, type GiftProduct, type Tier } from "../../lib/domain/catalog"
import { formatMoney } from "../../lib/domain/money"
import { HAMPER_DELIVERY_FEE_PAISE } from "../../config/self-build-delivery"
import { CatalogCard, CatalogProductImage } from "../catalog/CatalogCard"
import { StoreIcon } from "../shell/StoreIcon"
import { CategoryEditorialPhoto } from "./CategoryEditorialPhoto"
import { FeaturedHamperCards } from "./FeaturedHamperCards"

const JEWELRY_CATEGORIES = [
  "Premium Anti-Tarnish Necklaces",
  "Necklace + Earrings Sets",
  "Trending Necklaces",
  "Gold-Plated Bangles & Bracelets",
  "Adjustable Rings",
  "Earrings"
] as const

const HAMPER_CATEGORIES = [
  { label: "Mini Hampers", tier: "t499", image: "/images/campaign/hero-800.webp" },
  { label: "Classic Hampers", tier: "t699", image: "/images/campaign/occasion-800.webp" },
  { label: "Premium Hampers", tier: "t999", image: "/images/campaign/hero-800.webp" },
  { label: "Luxury Hampers", tier: "t2499", image: "/images/campaign/occasion-800.webp" },
  { label: "Occasion Hampers", tier: "t1499", image: "/images/campaign/hero-800.webp" },
  { label: "Build Your Own", tier: "t499", image: "/images/campaign/occasion-800.webp" }
] as const

function featuredJewelry(catalog: CatalogConfig) {
  const products = visibleProducts(catalog)
  const selected = new Set<string>()
  const priority = ["Adjustable Rings", "Trending Necklaces", "Gold-Plated Bangles & Bracelets", "Necklace + Earrings Sets"]
  const picks = priority.map((category) => products.find((product) =>
    product.category === category && !!primaryProductImage(product) && isIndividuallySellable(product)
  )).filter((product): product is GiftProduct => {
    if (!product || selected.has(product.id)) return false
    selected.add(product.id)
    return true
  })
  return [...picks, ...products.filter((product) =>
    !selected.has(product.id) && !!primaryProductImage(product) && isIndividuallySellable(product)
  )].slice(0, 4)
}

export function BalancedHomepage({ catalog, categoryMedia }: {
  catalog: CatalogConfig
  categoryMedia: Record<string, string>
}) {
  const available = visibleProducts(catalog)
  const knownCategories = new Set(categoriesForCatalog(catalog).map((category) => category.id))
  const tiers = catalog.tiers.filter((tier) => tier.active !== false)
  const primaryTier = tiers.find((tier) => tier.id === "t299") || tiers[0]
  const featuredTiers = ["t499", "t699", "t999", "t1499"]
    .map((id) => tiers.find((tier) => tier.id === id))
    .filter((tier): tier is Tier => !!tier)
  const featured = featuredJewelry(catalog)
  const deliveryFee = HAMPER_DELIVERY_FEE_PAISE / 100

  return <>
    <section className="cbHero wrap" aria-label="Shop jewelry and custom hampers">
      <div className="cbHeroPanel cbHeroJewelry">
        <Image src="/images/campaign/jewelry-1600.webp" alt="Jewelry collection photographed for Celebration" fill priority sizes="(max-width:700px) 100vw, 50vw" className="cbHeroImage" />
        <div className="cbHeroCopy">
          <span className="cbEyebrow">LITTLE THINGS, BIG FEELINGS</span>
          <h1>Jewelry to <em>wear.</em></h1>
          <p>Browse necklaces, rings, bracelets and earrings.</p>
          <Link className="cbPrimaryBtn" href="/jewelry" prefetch={false}>Explore Jewelry <StoreIcon name="arrow" size={16} /></Link>
        </div>
      </div>
      <div className="cbHeroPanel cbHeroHampers">
        <Image src="/images/campaign/occasion-1600.webp" alt="Celebration gifting inspiration with gift hampers" fill priority sizes="(max-width:700px) 100vw, 50vw" className="cbHeroImage" />
        <div className="cbHeroCopy">
          <span className="cbEyebrow">MADE FOR THEIR MOMENT</span>
          <h2>Hampers to <em>give.</em></h2>
          <p>Start with a budget. We curate the perfect gift.</p>
          <a className="cbPrimaryBtn" href="#budgets">Build Hamper <StoreIcon name="arrow" size={16} /></a>
        </div>
      </div>
      {primaryTier && <p className="cbHeroNote">Custom hampers from {formatMoney(primaryTier.price)} <span>+ {formatMoney(deliveryFee)} delivery</span></p>}
    </section>

    <section className="cbCategories wrap" id="products" aria-labelledby="cb-categories-heading">
      <div className="cbSectionHeading"><span className="cbEyebrow">THE CELEBRATION EDIT</span><h2 id="cb-categories-heading">Shop by category</h2></div>
      <div className="cbTwinGroups">
        <div className="cbCategoryGroup">
          <div className="cbGroupTitle"><h3>Jewelry</h3><Link href="/jewelry?view=all" prefetch={false}>Explore all <span aria-hidden="true">→</span></Link></div>
          <div className="cbCategoryGrid">
            {JEWELRY_CATEGORIES.map((category) => {
              const product = available.find((item) => item.category === category && !!primaryProductImage(item))
              const photo = categoryMedia[category]
              return <Link key={category} className="cbCategoryLink" href={knownCategories.has(category) ? `/jewelry?view=all&category=${encodeURIComponent(category)}` : "/jewelry?view=all"} prefetch={false}>
                <span className="cbCategoryImage">
                  {photo ? <CategoryEditorialPhoto src={photo} label={category} /> : product ? <CatalogProductImage product={product} /> : <span className="cbCategoryFallback" aria-hidden="true">✦</span>}
                </span>
                <span>{category}</span>
              </Link>
            })}
          </div>
        </div>
        <div className="cbCategoryGroup">
          <div className="cbGroupTitle"><h3>Hampers</h3><a href="#budgets">Choose a budget <span aria-hidden="true">→</span></a></div>
          <div className="cbCategoryGrid">
            {HAMPER_CATEGORIES.map((category) => <a key={category.label} className="cbCategoryLink" href={category.label === "Build Your Own" ? "/self-build" : `#hamper-${category.tier}`}>
              <span className="cbCategoryImage"><Image src={category.image} alt={category.label} width={220} height={220} loading="lazy" /></span>
              <span>{category.label}</span>
            </a>)}
          </div>
        </div>
      </div>
    </section>

    <section className="cbFeatured wrap" aria-labelledby="cb-featured-heading">
      <div className="cbSectionHeading"><span className="cbEyebrow">A LITTLE INSPIRATION</span><h2 id="cb-featured-heading">Take a closer look</h2></div>
      <div className="cbTwinGroups">
        <div className="cbFeaturedGroup">
          <div className="cbGroupTitle"><h3>Jewelry to love</h3><Link href="/jewelry?view=all" prefetch={false}>View all <span aria-hidden="true">→</span></Link></div>
          <div className="cbProductGrid">{featured.map((product) => <CatalogCard key={product.id} product={product} imageVariant="main" />)}</div>
        </div>
        <div className="cbFeaturedGroup">
          <div className="cbGroupTitle"><h3>Hampers to gift</h3><a href="#budgets">All budgets <span aria-hidden="true">→</span></a></div>
          <FeaturedHamperCards tiers={featuredTiers} deliveryFee={deliveryFee} />
        </div>
      </div>
    </section>
  </>
}
