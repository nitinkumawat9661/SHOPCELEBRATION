/**
 * Stable, verified public jewelry category URLs.
 * Filter/search query variants remain noindex on /jewelry: they are not unique landing pages.
 * A new merchandising category must be reviewed before it receives an indexable slug.
 */
export const jewelrySeoCategories = [
  { name: "Premium Anti-Tarnish Necklaces", slug: "premium-anti-tarnish-necklaces" },
  { name: "Necklace + Earrings Sets", slug: "necklace-earrings-sets" },
  { name: "Trending Necklaces", slug: "trending-necklaces" },
  { name: "Gold-Plated Bangles & Bracelets", slug: "gold-plated-bangles-bracelets" },
  { name: "Adjustable Rings", slug: "adjustable-rings" }
] as const

export function jewelryCategoryForSlug(slug: string) {
  return jewelrySeoCategories.find((item) => item.slug === slug)
}

export function jewelryCategoryPath(name: string): string | null {
  const category = jewelrySeoCategories.find((item) => item.name === name)
  return category ? `/jewelry/category/${category.slug}` : null
}
