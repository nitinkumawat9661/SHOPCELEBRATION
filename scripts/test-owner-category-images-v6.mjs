import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),"utf8")
const [seed,sql,loader,v3,v4,v5,home,featured,card,manifest]=await Promise.all([
  "scripts/install-owner-category-art-v6.mjs",
  "db/migrations/044_owner_supplied_category_editorial_v6.sql",
  "lib/server/home-category-media.ts",
  "scripts/generate-celebration-circle-art-v3.mjs",
  "scripts/create-clean-photo-category-circles-v4.mjs",
  "scripts/create-jewellery-detail-category-circles-v5.mjs",
  "features/home/HomeCatalog.tsx",
  "styles/home-restore-featured-swipe-ring-fit-20261012.css",
  "features/catalog/CatalogCard.tsx",
  "scripts/owner-category-sources-v6.json"
].map(file=>read(file).catch(error=>{
  // Sources are a temporary one-time transport input: after launch they are
  // intentionally removed from the repository, never required by future deploys.
  if(file.endsWith("owner-category-sources-v6.json")&&error.code==="ENOENT")return null
  throw error
})))

const mappings=[...seed.matchAll(/\{id:"([^"]+)",slug:"([^"]+)",source:"([^"]+)"/g)]
assert.equal(mappings.length,7,"Render exactly seven existing category links")
assert.equal(new Set(mappings.map(m=>m[1])).size,7,"No duplicates")
const expected={
  "Premium Anti-Tarnish Necklaces":"all",
  "Necklace + Earrings Sets":"set",
  "Trending Necklaces":"trending",
  "Gold-Plated Bangles & Bracelets":"bangles",
  "Adjustable Rings":"rings",
  "__all__":"all",
  "__hamper__":"hamper"
}
for(const [,id,slug,source]of mappings)
  assert.equal(source,expected[id],`Wrong customer-provided image in ${slug}`)
assert(seed.includes('crop:[420,210,480,580]'),"Only extra premium thumbnail is a necklace crop from user's All Jewellery source")
assert(seed.includes('fit:item.crop?"contain":"cover"'),"Keep user's image proportions intact")
assert(seed.includes("roundMask")||seed.includes("circleMask"),"Preserve transparent circular card edges")
assert(seed.includes("width!==640")&&seed.includes("alpha(320,320)<245"),"Verify dimensions and alpha before uploading")
assert(seed.includes('await db.query("BEGIN")')&&seed.includes('await db.query("COMMIT")')&&seed.includes('await db.query("ROLLBACK")'),"All seven DB category photos publish atomically")
assert(seed.includes("objectIsValid")&&seed.includes("PutObjectCommand"),"Persist uploaded files in self-hosted R2 and HEAD verify")
assert(seed.indexOf('const ready=')<seed.indexOf('owner-category-sources-v6.json'),"Already installed releases must not need expiring links")
assert(sql.includes("category-v6%2F")&&sql.includes("owner-provided:2026-10-12"),"Persist truthful owner-approved media provenance")
assert(loader.includes("category-v[123456]"),"Homepage reads owner-approved v6 PostgreSQL URLs")
assert(v3.includes("category-v6%2F")&&v4.includes('old.includes("category-v6%2F")')&&v5.includes('old.includes("category-v6%2F")'),"Legacy scripts never replace owner's images on future deploys")
assert(home.includes("categoriesForCatalog(catalog)")&&home.includes("<b>{category.label}</b>")&&home.includes("categoryMedia[category.id]"),"Preserve names, category navigation and DB image mapping")
assert(featured.includes("display:flex")&&featured.includes("flex-wrap:nowrap")&&featured.includes("overflow-x:auto"),"User-approved rounded featured swipe cards remain")
assert(card.includes('catalogCard--featuredPortraitRing'),"Do not change highlighted real product card image fit")
if(manifest){
 const data=JSON.parse(manifest)
 assert.equal(Object.keys(data.source_urls).length,6,"Exactly six approved uploaded sources")
 assert.equal(data.categories.length,7,"Seven category mappings, including one distinct crop")
 for(const [source,url]of Object.entries(data.source_urls))
  assert(url.startsWith("https://d2jqrm6oza8nb6.cloudfront.net/datasets/")&&url.includes("?_jwt="),
    `All one-time transport URLs must be HTTPS and signed: ${source}`)
}
const workflow=await read(".github/workflows/deploy-production.yml").catch(error=>{
 if(error.code==="ENOENT")return null
 throw error
})
if(workflow)assert(workflow.includes('install-owner-category-art-v6.mjs'),"VPS must install user images before switching current release")
console.log("Owner category image mapping v6 passed: six uploaded photos, seven proper categories, R2/SQL atomicity, rollback media and unchanged other cards.")
