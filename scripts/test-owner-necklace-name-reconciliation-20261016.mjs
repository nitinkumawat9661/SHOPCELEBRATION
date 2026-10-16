import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = path => readFile(new URL("../"+path,import.meta.url),"utf8")
const [catalogRaw,manifestRaw,migration,sourceMapRaw] = await Promise.all([
 "content/catalog.json",
 "content/jewelry-owner-name-reconciliation-20261016.json",
 "db/migrations/108_owner_necklace_22_photo_name_review.sql",
 "content/catalog-image-source-map.json"
].map(read))
const catalog=JSON.parse(catalogRaw)
const manifest=JSON.parse(manifestRaw)
const sources=JSON.parse(sourceMapRaw).products
const byId=new Map(catalog.products.map(p=>[p.id,p]))
assert.equal(catalog.products.length,89)
assert.equal(byId.size,89)
assert.equal(manifest.records.length,11)
assert.equal(new Set(manifest.records.map(p=>p.sku)).size,11)
const keep = new Map([
 ["001","Korean Fan Crystal Pendant Necklace"],
 ["002","Korean Bow Crystal Pendant Necklace"],
 ["003","Korean Four Heart Convertible Pendant Necklace"],
 ["004","Korean Double Heart Crystal Pendant Necklace"],
 ["005","Korean Love Key Crystal Pendant Necklace"],
 ["006","Korean Square Dancing Stone Necklace"],
 ["010","Korean Wave Dancing Stone Necklace"],
 ["013","Korean Flower Dancing Stone Necklace"],
 ["019","Korean Pearl Flower Halo Necklace"],
 ["020","Korean Twist Dancing Stone Necklace"],
 ["022","Korean Heart Halo Dancing Stone Necklace"]
])
for(const [suffix,title] of keep){
 const sku="celebration-necklace-"+suffix
 const p=byId.get(sku)
 assert.equal(p?.name,title,"Keep owner-approved title unchanged: "+sku)
 assert(!manifest.records.some(r=>r.sku===sku),"Keep SKU may not be rewritten")
 assert.equal(p.images?.[0]?.alt,title)
}
for(const entry of manifest.records){
 const p=byId.get(entry.sku)
 assert(p,entry.sku+" was removed")
 assert.equal(entry.action,"RENAME")
 assert.equal(p.name,entry.correctName)
 assert.equal(p.description,entry.proposedDescription)
 assert.equal(p.images?.[0]?.alt,entry.correctName)
 assert.equal(p.imageUrl,entry.expectedImageUrl,"Original photograph cannot be swapped")
 assert.equal(p.images?.[0]?.url,entry.expectedImageUrl,"Gallery must preserve original picture")
 assert.equal(p.sellIndividually,true,"Retail status preserved")
 assert.equal(p.category,"Premium Anti-Tarnish Necklaces")
 assert(!sources[entry.sku],"22 original first-party necklaces must not borrow R2 media")
 for(const required of [entry.sku,entry.previousName,entry.correctName,entry.expectedImageUrl,entry.previousDescription,entry.proposedDescription])
   assert(migration.includes(required.replaceAll("'","''")),"Migration guard/content missing for "+entry.sku)
}
const allNecklaces=catalog.products.filter(p=>p.id.startsWith("celebration-necklace-")&&Number(p.id.slice(-3))<=22)
assert.equal(allNecklaces.length,22)
assert.equal(keep.size+manifest.records.length,22)
assert.equal(byId.get("celebration-necklace-011").name,byId.get("celebration-necklace-001").name,
 "Owner explicitly provided same exact name for 001 and 011; do not silently invent another")
assert(migration.includes("eligible<>11")&&migration.includes("OWNER_NECKLACE_ORIGINAL_RECORDS_CHANGED"))
assert(migration.includes("catalog_revisions")&&migration.includes("FOR UPDATE"))
assert(migration.includes("base_version=next_version")&&migration.includes("draft_eligible=11"))
assert(migration.includes("'{0,alt}'")&&migration.includes("p.product->>'description'=m.old_description"))
assert(migration.includes("p.product->>'imageUrl'=m.expected_photo")&&migration.includes("p.product->'images'->0->>'url'=m.expected_photo"))
assert(!/\b(?:UPDATE|DELETE FROM|TRUNCATE)\s+(?:orders|retail_inventory|inventory_reservations|order_items|customer_accounts)\b/i.test(migration))
assert(!/SET\s+.*(?:stockAvailable|salePricePaise|mrpPaise|retail)/is.test(migration))
console.log("OWNER_NECKLACE_NAME_REVIEW_PASSED: 22 owner names, 11 exact guarded renames, 11 keep; no photo/price/stock edits")
