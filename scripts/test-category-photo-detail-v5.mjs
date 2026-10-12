import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const read=(file)=>readFile(new URL("../"+file,import.meta.url),"utf8")
const [script,catalogRaw,db,media,v3,v4,home,css,imports,card,workflow]=await Promise.all([
  "scripts/create-jewellery-detail-category-circles-v5.mjs",
  "content/catalog.json",
  "db/migrations/043_closeup_category_photo_only_v5.sql",
  "lib/server/home-category-media.ts",
  "scripts/generate-celebration-circle-art-v3.mjs",
  "scripts/create-clean-photo-category-circles-v4.mjs",
  "features/home/HomeCatalog.tsx",
  "styles/home-category-real-detail-v5.css",
  "app/globals.css",
  "features/catalog/CatalogCard.tsx",
  ".github/workflows/deploy-production.yml"
].map(f=>read(f).catch(error=>{
  if(f.startsWith(".github/")&&error.code==="ENOENT") return null
  throw error
})))
const products=new Map(JSON.parse(catalogRaw).products.map(p=>[p.id,p]))
const entries=[...script.matchAll(/\{id:"([^"]+)",slug:"([^"]+)",sku:"([^"]+)",roi:\[([^\]]+)\]/g)]
assert.equal(entries.length,7,"All seven category images must come from a real SKU photograph")
assert.equal(new Set(entries.map(x=>x[1])).size,7,"Every displayed category needs one unique tile")
for(const [,category,slug,id,region] of entries){
  const p=products.get(id)
  assert(p&&p.imageUrl,`Missing source image for ${slug}`)
  if(!category.startsWith("__"))
    assert.equal(p.category,category,`Do not confuse ${slug} with another SKU's image`)
  const [x,y,w,h]=region.split(",").map(Number)
  assert(w>=.29&&w<=.35&&h>=.32&&h<=.40&&x>=0&&y>=0&&x+w<=1&&y+h<=1,
    `Navigation thumb must tightly isolate jewellery, not a whole branded poster: ${slug}`)
}
assert(script.includes("category-v5/")&&script.includes('.extract({left,top,width,height})'),
  "V5 must use immutable R2 keys and product-focused image extraction")
assert(script.includes("roundMask()")&&script.includes('blend:"dest-in"'),
  "Original jewellery photo must be mounted inside the real round mask")
assert(script.includes('alpha(0,0)>8')&&script.includes('alpha(320,320)<245'),
  "Verify transparent edges and visible center before writing an object")
assert(script.includes('await db.query("BEGIN")')&&script.includes('await db.query("COMMIT")')&&script.includes("ROLLBACK"),
  "Publish all seven photos atomically after R2 checks")
assert(db.includes("category-v5%2F")&&media.includes("category-v[123456]"),
  "Updated database and loader must accept the new version")
assert(v3.includes("category-v5%2F")&&v4.includes('old.includes("category-v5%2F")'),
  "All legacy seeding scripts must be safe after future version upgrades")
assert(home.includes("<b>{category.label}</b>") && home.includes("categoriesForCatalog(catalog)"),
  "Do not change original real category labels, only category photographs")
assert(home.includes("encodeURIComponent(category.id)"),
  "Category links must use the untouched original catalog ID")
assert(css.includes("border-radius:50%")&&css.includes("overflow-x:auto")&&
  css.includes("word-break:normal"),
  "Keep original horizontal circular layout and readable labels")
assert(css.includes(".celebrationCategories")&&!css.includes(".celebrationFeatured"),
  "Do not modify previous approved Take a Closer Look cards")
assert(imports.includes('@import "../styles/home-category-real-detail-v5.css";')&&
  imports.endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";\n'),
  "Import category-only styles without altering protected jewelry grid ordering")
assert(imports.includes('@import "../styles/home-phase1-original-featured-grid-20261012.css";'),
  "Use the owner's updated final 2-column mobile and 4-column desktop featured layout")
assert(card.includes('catalogCard--featuredPortraitRing'),
  "Previously approved ring poster display formatting must remain")
if(workflow)assert(workflow.includes("create-jewellery-detail-category-circles-v5.mjs"),
  "Production must generate and verify all seven category thumbnails before switching releases")
console.log("Category photo-only v5 checks passed: seven tightly focused original Celebration SKU crops, stable round navigation, independent featured 2/4 grid and atomic R2/PostgreSQL publishing.")
