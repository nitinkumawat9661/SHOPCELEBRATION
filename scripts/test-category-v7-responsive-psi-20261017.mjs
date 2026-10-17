import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8")
const [image, home, media, css, v7, catalog, nextConfig, r2route] = await Promise.all([
  "features/home/CategoryEditorialPhoto.tsx",
  "features/home/HomeCatalog.tsx",
  "lib/server/home-category-media.ts",
  "styles/home-category-real-detail-v5.css",
  "scripts/install-owner-category-art-v7.mjs",
  "features/catalog/CatalogCard.tsx",
  "next.config.mjs",
  "app/api/catalog/image/route.ts"
].map(read))

// Real category-v7 owner images stay in R2 at the same keys. The page only
// varies presentation/transfer size, without DB updates or image replacement.
assert(home.includes("categoryMedia[category.id]") &&
       home.includes("categoryMedia.__all__") &&
       home.includes("categoryMedia.__hamper__"),
       "Original owner-assigned category photos changed")
assert(home.includes("<CategoryEditorialPhoto src={editorial} label={category.label} />"),
       "Category cards changed their actual image mapping or URL")
assert(media.includes("category-v[1234567]"), "V7 category lookup no longer accepted")
assert(v7.includes("category-v7/") && v7.includes("HeadObjectCommand"),
       "Existing verified owner V7 artwork cannot be traced")
assert(image.includes('import Image from "next/image"'),
       "PageSpeed's 640px image still lacks responsive image optimization")
assert(image.includes("src={src}") && image.includes("sizes="),
       "Image must optimize the SAME original R2 URL at true display dimensions")
assert(image.includes("188px") && image.includes("256px"),
       "Device-width hints should fit the real navigation circles")
assert(image.includes("quality={75}"),
       "Next 16's default quality allowlist is [75]")
assert(image.includes('loading={eager ? "eager" : "lazy"}') &&
       image.includes('fetchPriority={eager ? "high" : "auto"}'),
       "Offscreen category photos must stay deferred")
assert(image.includes("decoding=\"async\"") &&
       image.includes("width={640}") && image.includes("height={640}"),
       "Image dimensions must retain the original circle's aspect ratio")
assert(image.includes("unoptimized={useOriginal}") &&
       image.includes("setOriginalSource(src)") &&
       image.includes("setBrokenSource(src)"),
       "Always retry the SAME full-size owned source if Next optimizer fails")
assert(!image.includes("otherProduct") && !image.includes("remoteImage"),
       "Never substitute a different SKU's art")
assert(css.includes("border-radius:50%") && css.includes("object-fit:cover"),
       "Keep the approved category circle crop and mobile spacing")
assert(catalog.includes("catalogImageVariant(primary.url, imageVariant)"),
       "Product SKU image mapping must not change")
assert(nextConfig.includes("httpSecurity.noStoreRoutes"),
       "Preserve private API/customer/cache isolation")
assert(r2route.includes("isCatalogImageKey") &&
       r2route.includes("readCatalogImageObject"),
       "Source must continue through verified first-party R2 image route")

console.log("PASS: PageSpeed category-v7 640px originals serve responsive 188-256px Next WebPs; original R2 fallback, exact art, circular design and privacy preserved.")
