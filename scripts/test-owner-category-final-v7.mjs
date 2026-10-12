import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=f=>readFile(new URL('../'+f,import.meta.url),'utf8')
const [script,home,loader,sql,collection]=await Promise.all(['scripts/install-owner-category-art-v7.mjs','features/home/HomeCatalog.tsx','lib/server/home-category-media.ts','db/migrations/045_owner_supplied_final_category_art_v7.sql','features/catalog/CatalogCollection.tsx'].map(read))
// The immutable VPS deployment archive intentionally excludes .github.
// Enforce the workflow hook in CI source checkout, but do not fail release verification in the archive.
const deploy=await read('.github/workflows/deploy-production.yml').catch(error=>{
  if(error?.code==='ENOENT')return null
  throw error
})
assert.equal([...script.matchAll(/\["[^"]+","[^"]+","[a-f0-9-]{36}"\]/g)].length,8)
assert(script.includes('"Earrings","earrings"'))
assert(script.includes('HeadObjectCommand')&&script.includes('PutObjectCommand'))
assert(script.includes('await db.query("BEGIN")')&&script.includes('await db.query("COMMIT")'))
assert(home.includes('label: "Earrings"')&&home.includes('existingCategories.some'))
assert(collection.includes('item.value === "Earrings"')&&collection.includes('Earrings are coming soon.'))
assert(loader.includes('category-v[1234567]')&&sql.includes('category-v7%2F'))
if(deploy!==null)assert(deploy.includes('install-owner-category-art-v7.mjs'))
console.log('Owner final eight category art + empty Earrings navigation checks passed.')
