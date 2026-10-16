import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import pg from "pg"
const connectionString=process.env.JEWELRY_TEST_DATABASE_URL
if(!connectionString)throw Error("JEWELRY_TEST_DATABASE_URL required; NEVER run against production")
if(!/localhost|127\.0\.0\.1/.test(connectionString))throw Error("Only isolated local PostgreSQL is permitted")
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8")
const [seedText,manifestText,sql]=await Promise.all([
 "content/catalog.json",
 "content/jewelry-owner-name-reconciliation-20261016.json",
 "db/migrations/108_owner_necklace_22_photo_name_review.sql"
].map(read))
const current=JSON.parse(seedText),proposals=JSON.parse(manifestText).records
const old=JSON.parse(seedText)
for(const entry of proposals){
 const p=old.products.find(x=>x.id===entry.sku)
 assert(p)
 p.name=entry.previousName
 p.description=entry.previousDescription
 p.images[0].alt=entry.previousName
}
const db=new pg.Client({connectionString,ssl:false})
await db.connect()
try{
 await db.query(`
 CREATE TABLE catalog_config (
   id text PRIMARY KEY,
   payload jsonb NOT NULL,
   version integer NOT NULL,
   updated_at timestamptz NOT NULL DEFAULT now()
 );
 CREATE TABLE catalog_revisions (
   version integer PRIMARY KEY,
   payload jsonb NOT NULL
 );
 CREATE TABLE catalog_drafts (
   id text PRIMARY KEY,
   payload jsonb NOT NULL,
   base_version integer NOT NULL,
   updated_at timestamptz NOT NULL DEFAULT now()
 );
 `)
 const reset=async(draft=false)=>{
  await db.query("TRUNCATE catalog_drafts,catalog_revisions,catalog_config")
  await db.query("INSERT INTO catalog_config(id,payload,version) VALUES('primary',$1::jsonb,29)",[JSON.stringify(old)])
  if(draft)await db.query("INSERT INTO catalog_drafts(id,payload,base_version) VALUES('primary',$1::jsonb,29)",[JSON.stringify(old)])
 }
 const apply=async()=>{
  await db.query("BEGIN")
  try{await db.query(sql);await db.query("COMMIT")}
  catch(e){await db.query("ROLLBACK");throw e}
 }
 const inspect=async()=>{
  const x=(await db.query("SELECT version,payload FROM catalog_config WHERE id='primary'")).rows[0]
  return x
 }
 await reset()
 await apply()
 let got=await inspect()
 assert.equal(got.version,30)
 assert.equal(got.payload.products.length,89)
 assert.deepEqual(got.payload.products,current.products,
   "Successful correction must only update 11 title/description/alt fields")
 assert.equal((await db.query("SELECT count(*)::int n FROM catalog_revisions")).rows[0].n,1)
 await apply() // correct already: idempotent, no extra revision.
 assert.equal((await inspect()).version,30)
 assert.equal((await db.query("SELECT count(*)::int n FROM catalog_revisions")).rows[0].n,1)

 await reset(true)
 await apply()
 assert.equal((await inspect()).version,30)
 const draft=(await db.query("SELECT payload,base_version FROM catalog_drafts WHERE id='primary'")).rows[0]
 assert.equal(draft.base_version,30,"Current unchanged admin draft is rebased")
 assert.deepEqual(draft.payload.products,current.products)

 await reset()
 const tampered=JSON.parse(JSON.stringify(old))
 tampered.products.find(x=>x.id==="celebration-necklace-007").name="OWNER_MANUAL_RENAME"
 await db.query("UPDATE catalog_config SET payload=$1::jsonb WHERE id='primary'",[JSON.stringify(tampered)])
 await assert.rejects(apply(),/OWNER_NECKLACE_ORIGINAL_RECORDS_CHANGED/,
   "Manual changes must abort the whole migration")
 got=await inspect()
 assert.equal(got.version,29)
 assert.equal(got.payload.products.find(x=>x.id==="celebration-necklace-007").name,"OWNER_MANUAL_RENAME")
 assert.equal((await db.query("SELECT count(*)::int n FROM catalog_revisions")).rows[0].n,0)
 console.log("OWNER_NECKLACE_POSTGRES_INTEGRATION_PASSED: 11 exact changes, 89 full records preserved, idempotence, admin draft, manual edit abort")
} finally {await db.end()}
