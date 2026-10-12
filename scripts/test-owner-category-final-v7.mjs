import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const read=f=>readFile(new URL('../'+f,import.meta.url),'utf8')
const [script,home,loader,sql,deploy]=await Promise.all(['scripts/install-owner-category-art-v7.mjs','features/home/HomeCatalog.tsx','lib/server/home-category-media.ts','db/migrations/045_owner_supplied_final_category_art_v7.sql','.github/workflows/deploy-production.yml'].map(read))
assert.equal([...script.matchAll(/\["[^"]+","[^"]+","[a-f0-9-]{36}"\]/g)].length,8)
assert(script.includes('"Earrings","earrings"'))
assert(script.includes('HeadObjectCommand')&&script.includes('PutObjectCommand'))
assert(script.includes('await db.query("BEGIN")')&&script.includes('await db.query("COMMIT")'))
assert(home.includes('label: "Earrings"')&&home.includes('existingCategories.some'))
assert(loader.includes('category-v[1234567]')&&sql.includes('category-v7%2F'))
assert(deploy.includes('install-owner-category-art-v7.mjs'))
console.log('Owner final eight category art + empty Earrings navigation checks passed.')
