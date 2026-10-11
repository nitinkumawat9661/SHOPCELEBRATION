import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"

const read=(file)=>readFile(new URL("../"+file,import.meta.url),"utf8")
const [code,catalogRaw,css,sql,media]=await Promise.all([
  "scripts/generate-celebration-circle-art-v3.mjs","content/catalog.json",
  "styles/home-true-circle-product-art-v3.css",
  "db/migrations/041_circle_native_category_art.sql",
  "lib/server/home-category-media.ts"
].map(read))
const cat=JSON.parse(catalogRaw)
const byId=new Map(cat.products.map(x=>[x.id,x]))
const entries=[...code.matchAll(/\{ id:"([^"]+)", slug:"([^"]+)", sku:"([^"]+)"/g)]
assert.equal(entries.length,7,"All seven category circles require a real SKU")
assert.equal(new Set(entries.map(x=>x[1])).size,7,"No duplicated category")
for(const match of entries){
  const [,category,slug,id]=match
  const product=byId.get(id)
  assert(product&&product.imageUrl,`Must reference an existing photographed Celebration SKU for ${slug}`)
  if(!category.startsWith("__")) assert.equal(product.category,category,`Never substitute category's product image: ${slug}`)
}
assert(code.includes('const size=570')&&code.includes('fit:"contain"'),"Keep entire product within circle")
assert(code.includes('circularFade')&&code.includes('blend:"dest-in"'),"Feather original picture to a round mask; no visible source rectangle")
assert(code.includes('circle cx="320" cy="320" r="314"'),"Full size native circular background")
assert(code.includes('alpha(0,0)>8')&&code.includes('alpha(320,320)<250'),"Release must actually validate transparent image corners")
assert(code.includes('category-v3/')&&sql.includes('category-v3%2F'),"Use new immutable media, preserving old release assets")
assert(css.includes("object-fit:contain")&&css.includes("border-radius:50%"),"Whole product must fit round card")
assert(media.includes("category-v[123]"),"Home must resolve v3 URLs")
// .github/workflows is deliberately excluded from VPS source archives.\n// Assert its presence when available during GitHub PR CI only.\nconst workflow=await read(".github/workflows/deploy-production.yml").catch(error=>{\n  if(error?.code==="ENOENT") return null\n  throw error\n})\nif(workflow!==null) assert(workflow.includes("generate-celebration-circle-art-v3.mjs"),"Deployment must create images before switching release")
assert(!code.includes('photoPanel')&&!code.includes('matteSvg'),"Reject previous square card montage generator")
console.log("Category v3 source checks passed: 7 exact Celebration SKUs, 1 product per circular card, centered contained photos with feathered mask, versioned R2/DB publication and corner alpha checks.")
