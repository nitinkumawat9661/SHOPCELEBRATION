import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"

const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),"utf8")
const [script,catRaw,sql,media,styles,home,imports]=await Promise.all([
  "scripts/create-clean-photo-category-circles-v4.mjs",
  "content/catalog.json",
  "db/migrations/042_home_category_original_photo_only_v4.sql",
  "lib/server/home-category-media.ts",
  "styles/home-featured-compact-photo-grid-20261012.css",
  "features/home/HomeCatalog.tsx",
  "app/globals.css"
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
assert(styles.includes("grid-template-columns:repeat(2,minmax(0,1fr))"),"Phones must show two compact featured cards per row")
assert(styles.includes("grid-template-columns:repeat(4,minmax(0,1fr))"),"Desktop should show all 4 featured products without horizontal overflow")
assert(styles.includes("object-fit:contain"),"Never crop the sale-product image on a listing card")
assert(styles.includes(".celebrationFeatured .collectionGrid>.catalogCard"),"Scope homepage card styles only")
assert(styles.includes(".celebrationFeatured .catalogCard .cartAddControl button")&&styles.includes("min-height:44px"),
  "Cart action stays tappable")
assert(home.includes('imageVariant="main"')&&home.includes("photographed.map((product)"),
  "Use verified real-SKU source photo and product identity")
assert(imports.includes('@import "../styles/home-featured-compact-photo-grid-20261012.css";'),
  "Compact home layout must be included in production")
assert(imports.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Protected /jewelry 2-column contract must remain last")
console.log("Category poster-crop v4 and mobile featured-grid checks passed: 7 exact photo regions, atomic R2 publication and 2-column product cards.")
