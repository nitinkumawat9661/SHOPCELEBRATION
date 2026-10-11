import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"

const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),"utf8")
const [script,catRaw,sql,media,styles,home,imports,card]=await Promise.all([
  "scripts/create-clean-photo-category-circles-v4.mjs",
  "content/catalog.json",
  "db/migrations/042_home_category_original_photo_only_v4.sql",
  "lib/server/home-category-media.ts",
  "styles/home-restore-featured-swipe-ring-fit-20261012.css",
  "features/home/HomeCatalog.tsx",
  "app/globals.css",
  "features/catalog/CatalogCard.tsx"
].map(read))
const products=new Map(JSON.parse(catRaw).products.map(p=>[p.id,p]))
const entries=[...script.matchAll(/\{id:"([^"]+)",slug:"([^"]+)",sku:"([^"]+)",roi:\[([^\]]+)\]/g)]
assert.equal(entries.length,7,"All seven category circles need a source ROI")
assert.equal(new Set(entries.map(x=>x[1])).size,7,"Categories must be unique")
for(const [,category,slug,sku,region]of entries){
  const product=products.get(sku)
  assert(product&&product.imageUrl,`Source must exist: ${slug}`)
  if(!category.startsWith("__"))assert.equal(product.category,category,`Never mismatch image with collection: ${slug}`)
  const [x,y,w,h]=region.split(",").map(Number)
  assert(w<=.60&&h<=.76&&x>=0&&y>=0&&x+w<=1&&y+h<=1,
    `A crop should isolate the photo, not copy a full advertising poster: ${slug}`)
}
assert(script.includes(".extract({left,top,width,height})"),"Actual image ROI must be cropped before circular presentation")
assert(script.includes("GetObjectCommand")&&script.includes("shopcelebration.in")&&script.includes("public"),"Use real first-party product images")
assert(script.includes("roundMask()")&&script.includes('blend:"dest-in"'),"Native circle with transparent poster-free exterior")
assert(script.includes('alpha(0,0)>8')&&script.includes("alpha(320,320)<245"),"Validate true circle pixels")
assert(script.includes('await db.query("BEGIN")')&&script.includes('await db.query("COMMIT")')&&script.includes("ROLLBACK"),
  "Seven category image references must change atomically")
assert(sql.includes("category-v4%2F")&&media.includes("category-v[1234]"),"V4 R2 pointers must be accepted")
assert(styles.includes("display:flex") && styles.includes("flex-wrap:nowrap") &&
       styles.includes("overflow-x:auto") && styles.includes("scroll-snap-type:x proximity"),
  "Restore the previous single-row horizontal featured product carousel")
assert(styles.includes("border-radius:13px") && styles.includes("flex-basis:clamp(218px,68vw,252px)"),
  "Keep the earlier rounded mobile cards and their original swipe-friendly width")
assert(styles.includes("catalogCard--featuredPortraitRing") && styles.includes("object-fit:cover"),
  "Remove portrait-image white bars only for verified first ring card")
assert(card.includes('product.id === "celebration-ring-001"') &&
       card.includes('imageVariant === "main"'),
  "Never crop unrelated or collection listing product photographs")
assert(styles.includes(".celebrationFeatured") && !styles.includes(".collectionPage"),
  "Keep all changes homepage-only")
assert(home.includes('imageVariant="main"')&&home.includes("photographed.map((product)"),
  "Use verified real-SKU source photo and product identity")
assert(imports.includes('@import "../styles/home-restore-featured-swipe-ring-fit-20261012.css";'),
  "Restored original home carousel must be enabled")
assert(!imports.includes('@import "../styles/home-featured-compact-photo-grid-20261012.css";'),
  "The rejected two-column featured grid must not be imported")
assert(imports.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Protected /jewelry 2-column contract must remain last")
console.log("Category v4 photo-source checks and restored rounded swipe-card checks passed: 7 exact photo regions, atomic R2 publication and ring-only object-fit.")
