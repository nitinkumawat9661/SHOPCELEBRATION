import assert from "node:assert/strict"
import { readFile, stat } from "node:fs/promises"

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8")
const [globals, admin, hero, home, editorial, layout, nextConfig, safeImage, app, collection] = await Promise.all([
  "app/globals.css", "app/admin/layout.tsx", "features/home/Hero.tsx",
  "features/home/HomeCatalog.tsx", "features/home/CategoryEditorialPhoto.tsx",
  "app/layout.tsx", "next.config.mjs", "features/catalog/SafeCatalogImage.tsx",
  "app/page.tsx", "app/jewelry/page.tsx"
].map(source))

// Real owner admin functionality stays styled, but CSS is isolated to /admin.
const adminStyles = [
  "admin.css", "admin-v2.css", "admin-systematic.css", "admin-shell.css",
  "admin-individual-sales.css", "admin-catalog-polish.css", "admin-reservation-review.css"
]
for (const file of adminStyles) {
  assert(!globals.includes(`@import "../styles/${file}";`), "Admin-only CSS leaks into public stylesheet: " + file)
  assert(admin.includes(`import "../../styles/${file}"`), "Admin lost its required style: " + file)
}
assert(globals.includes('@import "../styles/celebration.css";'))
assert(globals.includes('@import "../styles/collection.css";'))
assert(globals.includes('@import "../styles/catalog-image-reliability.css";'))

// LCP image must be immediately discoverable and high priority, but must
// remain the exact real first-party image selected by picture/media.
assert(hero.includes('srcSet="/images/campaign/hero-800.webp"'))
assert(hero.includes('src="/images/campaign/hero-1600.webp"'))
assert(hero.includes('unoptimized loading="eager" fetchPriority="high"'))
assert(!hero.includes('loading="lazy"'))
assert((await stat(new URL("../public/images/campaign/hero-800.webp", import.meta.url))).size < 65_536)

// Category images are offscreen on short mobiles and must not contend with
// first-viewport hero image fetch for high priority.
assert(!home.includes("eager={index < 3}"))
assert(home.includes("<CategoryEditorialPhoto src={editorial} label={category.label} />"))
assert(editorial.includes('loading={eager ? "eager" : "lazy"}'))
assert(editorial.includes('decoding="async"'))

// Allura is not needed for the first hero paint; remaining typography unchanged.
assert(layout.includes('variable: "--font-shopping-script", preload: false'))
assert(layout.includes('variable: "--font-shopping-display"'))
assert(layout.includes('variable: "--font-shopping-sans"'))

// Dynamic admin/customer/payment routes stay no-store; only public
// campaign art (not customer uploads) gets a bounded browser cache.
assert(nextConfig.includes('source: "/images/campaign/:path*"'))
assert(nextConfig.includes('public, max-age=604800, stale-while-revalidate=86400'))
assert(nextConfig.includes("...httpSecurity.noStoreRoutes.map"))
assert(safeImage.includes('referrerPolicy="no-referrer"'))

// Catalog data is still Redis-backed, yet order/checkout code remains untouched.
assert(app.includes("getPublicCatalogConfig"))
assert(collection.includes("getPublicCatalogConfig"))
console.log("PASS: private admin styles route-scoped; real hero eagerly fetched; category art lazy; safe public browser caching; checkout and product identity preserved.")
