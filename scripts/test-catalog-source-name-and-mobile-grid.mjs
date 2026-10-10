import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

const load=path=>readFile(new URL(`../${path}`, import.meta.url),"utf8")
const [manifestText,catalogText,sourceMapText,sql,header,behavior,css,imports,collection]=await Promise.all([
  "content/catalog-name-source-reconciliation-20261010.json",
  "content/catalog.json",
  "content/catalog-image-source-map.json",
  "db/migrations/037_catalog_image_name_exact_source_reconciliation.sql",
  "features/shell/StorefrontHeader.tsx",
  "features/shell/HeaderScrollBehavior.tsx",
  "styles/jewelry-two-column-scroll-header-fix.css",
  "app/globals.css",
  "features/catalog/CatalogCollection.tsx"
].map(load));
const manifest=JSON.parse(manifestText).records;
const products=JSON.parse(catalogText).products;
const src=JSON.parse(sourceMapText).products;
const byId=new Map(products.map(p=>[p.id,p]));
assert.equal(products.length,89,"Do not remove existing SKU records");
assert.equal(byId.size,89,"Cannot duplicate SKU");
assert.equal(manifest.length,27,"Only 27 exact-source matches are cleared for the automatic fix");
assert.equal(new Set(manifest.map(x=>x.sku)).size,27);
assert.equal(manifest.filter(x=>x.kind==="set").length,15);
assert.equal(manifest.filter(x=>x.kind==="bangle").length,12);
const imgKeys=new Map();
for(const item of manifest){
  const p=byId.get(item.sku),original=src[item.sku];
  assert(p&&original,`Unknown SKU in manifest: ${item.sku}`);
  assert.equal(item.confidence,"exact-original-upload-URL");
  assert.equal(item.sourceUrl,original.sourceUrl,`Original source not owned by SKU: ${item.sku}`);
  const digest=createHash("sha256").update(item.sourceUrl).digest("hex");
  assert.equal(original.mainKey,`catalog/rehost/meesho/${digest}/main.webp`,`Rehost hash doesn't match original: ${item.sku}`);
  assert.equal(item.expectedImageUrl,`/api/catalog/image?key=${encodeURIComponent(original.mainKey)}`);
  assert.equal(p.imageUrl,item.expectedImageUrl,`Original SKU primary image unexpectedly changed: ${item.sku}`);
  assert.equal(p.images?.[0]?.url,item.expectedImageUrl,`Hero and gallery disagree: ${item.sku}`);
  assert.equal(p.images?.[0]?.fallbackUrl,item.sourceUrl,`Wrong-SKU original image: ${item.sku}`);
  assert.equal(p.images?.[0]?.alt,item.correctName,`Image alt mismatches heading: ${item.sku}`);
  assert.equal(p.name,item.correctName,`Seed title not fixed: ${item.sku}`);
  assert.notEqual(item.previousName,item.correctName,`Manifest records no actual change: ${item.sku}`);
  assert.equal(p.description,item.correctDescription,`Description still refers to the wrong physical motif: ${item.sku}`);
  assert(!imgKeys.has(item.expectedImageUrl),`Reference photo assigned to multiple SKU IDs: ${item.sku}`);
  imgKeys.set(item.expectedImageUrl,item.sku);
  assert(sql.includes(item.expectedImageUrl.replaceAll("'","''")),`Database guard missing expected photo: ${item.sku}`);
  assert(sql.includes(item.correctName.replaceAll("'","''")),`Database lacks safe corrected title: ${item.sku}`);
}
for(const str of ["p.product->>'name'=m.previous_name","p.product->>'imageUrl'=m.expected_image_url","p.product->'images'->0->>'url'=m.expected_image_url","catalog_revisions","FOR UPDATE","catalog_drafts","version=original_version+1","updated_at=now()"]){
  assert(sql.includes(str),`Missing optimistic image/name safeguard: ${str}`);
}
assert(!/DELETE FROM (?:orders|catalog_config|catalog_drafts)/i.test(sql),"Never delete user orders or draft work");
assert(!/\b(?:salePricePaise|stockAvailable|retail|payment_status|imageUrl)\b\s*=/i.test(sql),"No prices, inventory or image edits in DB migration");
assert(header.includes("<HeaderScrollBehavior />")&&header.includes('className="celebrationNav wrap"'),"Keep visible header navigation");
assert(behavior.includes('window.addEventListener("scroll"')&&behavior.includes('passive: true'),"Mobile hide must be passive and scroll-driven");
assert(behavior.includes('delta >= 5')&&behavior.includes('delta <= -7'),"Hide on down, restore on up");
assert(behavior.includes("nav.inert = value")&&behavior.includes("search.inert = value"),"No invisible keyboard focusable links");
assert(behavior.includes('header.addEventListener("focusin"'),"Keyboard focus must restore controls");
assert(css.includes('data-compact-nav="true"')&&css.includes("visibility:hidden"),"Collapsed UI must be removed visually");
assert(css.includes("@media(max-width:700px)")&&css.includes("@media(max-width:360px)"),"Both small and narrow phone widths addressed");
assert(css.includes("grid-template-columns:repeat(2,minmax(0,1fr))"),"Two actual parallel jewelry cards per row");
assert(css.includes(".collectionPage .collectionSection .collectionGrid"),"Fix collection-only grid without disturbing home cards");
assert(css.includes(".collectionPage .collectionHero"),"Oversized jewelry banner should be compact");
assert(!/\.celebrationHome \.collectionGrid\s*\{/.test(css),"Do not change homepage cards");
assert(imports.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),"Last CSS import wins over conflicting one-column rules");
assert(collection.includes('className="collectionGrid"'),"Jewelry page must still contain real product cards");
console.log("Catalog reconciliation passed: all 27 exact photo-SKU corrections, 15 sets/12 bangles, no price/media/inventory changes. Mobile two-column and scroll-collapse CSS/accessibility checks passed.");
