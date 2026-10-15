#!/usr/bin/env node
/**
 * Read-only inspection of Celebration's existing product catalog.
 * Run FROM the CURRENT VPS release with the existing runtime env.
 * No UPDATE, INSERT, DELETE, DDL, R2 writes, API writes, or image reassignments.
 * All reported fields are already public product IDs/names/image references.
 */
const {loadEnvConfig}=require("@next/env")
const fs=require("node:fs")
const path=require("node:path")
const {createHash}=require("node:crypto")
const pg=require("pg")
loadEnvConfig(process.cwd(),false)

const seed=JSON.parse(fs.readFileSync(path.resolve("content/catalog.json"),"utf8"))
const sources=JSON.parse(fs.readFileSync(path.resolve("content/catalog-image-source-map.json"),"utf8")).products
const repairs=JSON.parse(fs.readFileSync(path.resolve("content/catalog-name-source-reconciliation-20261010.json"),"utf8")).records
const bySeed=new Map(seed.products.map(p=>[p.id,p]))
const manifest=new Map(repairs.map(r=>[r.sku,r]))
const client=new pg.Client({
 connectionString:process.env.DATABASE_URL,
 ssl:process.env.DATABASE_SSL_MODE==="disable"?false:{rejectUnauthorized:true}
})
const mainKey=url=>"catalog/rehost/meesho/"+createHash("sha256").update(url).digest("hex")+"/main.webp"
const urlKey=url=>{try{return new URL(url,"https://shopcelebration.in").searchParams.get("key")||""}catch{return ""}}
const imgList=p=>Array.isArray(p?.images)?p.images:[]
const mainImg=p=>imgList(p)[0]?.url||p?.imageUrl||""
const keyOf=p=>urlKey(mainImg(p))||mainImg(p)
const recordsFor=(payload,label)=>{
 const products=Array.isArray(payload?.products)?payload.products:[]
 const seen=new Map(),repeat=[],mis=[],old=[],unexpected=[],gallery=[],alts=[],dupes=[],diffSeed=[],needsVisual=[]
 for(const p of products) {
  const expected=manifest.get(p.id),seedP=bySeed.get(p.id),src=sources[p.id],img=mainImg(p),id=p.id
  const oldOwn=seen.get(img);if(oldOwn&&oldOwn!==id)repeat.push({a:oldOwn,b:id})
  seen.set(img,id)
  if(p.imageUrl&&imgList(p).length&&p.imageUrl!==imgList(p)[0].url)
   gallery.push({id,storedHero:keyOf({imageUrl:p.imageUrl}),galleryFirst:keyOf({imageUrl:imgList(p)[0].url})})
  if(imgList(p).length&&imgList(p)[0].alt&&imgList(p)[0].alt!==p.name)
   alts.push({id,name:p.name,imageAlt:imgList(p)[0].alt})
  if(seedP&&(seedP.name!==p.name||keyOf(seedP)!==keyOf(p)))
    diffSeed.push({id,dbName:p.name,seedName:seedP.name,nameMismatch:seedP.name!==p.name,mediaMismatch:keyOf(seedP)!==keyOf(p)})
  if(expected&&p.name!==expected.correctName) {
   mis.push({id,actual:p.name,expected:expected.correctName,previousName:expected.previousName,expectedImage:keyOf({imageUrl:expected.expectedImageUrl}),actualImage:keyOf(p),photoUnchanged:keyOf(p)===keyOf({imageUrl:expected.expectedImageUrl})})
   if(p.name===expected.previousName)old.push(id)
  }
  if(src&&img&&urlKey(img)&&urlKey(img)!==src.mainKey)
    unexpected.push({id,expected:src.mainKey,actual:urlKey(img)})
  if(!seedP)dupes.push(id)
  if(!expected)needsVisual.push({id,name:p.name,category:p.category,sourceMapped:!!src})
 }
 return {label,count:products.length,mismatchedKnownTitles:mis,oldTitles:old,unexpectedMediaProvenance:unexpected,heroVsFirstImage:gallery,imageAltsNotProductTitle:alts,sharedImages:repeat,differentFromSeed:diffSeed,unknownSKUs:dupes,needsHumanVisualCheck:needsVisual}
}
;(async()=>{
 if(!process.env.DATABASE_URL)throw Error("DATABASE_URL missing in active VPS release")
 await client.connect()
 try{
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
  const [liveRes,draftRes,migrations,revisions]=await Promise.all([
   client.query("SELECT payload,version,updated_at FROM catalog_config WHERE id='primary'"),
   client.query("SELECT payload,base_version,updated_at FROM catalog_drafts WHERE id='primary'"),
   client.query("SELECT name,applied_at FROM schema_migrations WHERE name LIKE '037_%'"),
   client.query("SELECT version,created_at,payload FROM catalog_revisions ORDER BY version DESC LIMIT 25")
  ])
  const live=liveRes.rows[0],draft=draftRes.rows[0]
  if(!live)throw Error("LIVE_CATALOG_ROW_NOT_FOUND")
  const audited=recordsFor(live.payload,"liveDB")
  const draftAudit=draft?recordsFor(draft.payload,"adminDraft"):null
  const revs=revisions.rows.map(r=>({v:r.version,at:r.created_at,p:r.payload}))
  const history=audited.mismatchedKnownTitles.map(p=>{
   const last=revs.find(r=>r.p.products?.some(z=>z.id===p.id&&z.name===manifest.get(p.id).correctName))
   return {id:p.id,lastKnownCorrectVersion:last?.v??null,lastKnownCorrectAt:last?.at??null}
  })
  await client.query("COMMIT")
  let publicResult=null
  try{
   const r=await fetch("http://127.0.0.1:3040/api/catalog",{cache:"no-store",signal:AbortSignal.timeout(12000)})
   if(!r.ok)publicResult={status:r.status,error:"PUBLIC_ROUTE_NOT_OK"}
   else {
    const body=await r.json()
    if(body.ok&&body.catalog) {
     const publicById=new Map((body.catalog.products||[]).map(p=>[p.id,p]))
     const differs=(live.payload.products||[]).filter(p=>{
      const b=publicById.get(p.id)
      return !b||b.name!==p.name||keyOf(b)!==keyOf(p)
     }).map(p=>({id:p.id,liveName:p.name,publicName:publicById.get(p.id)?.name||null,publicImageDifferent:keyOf(publicById.get(p.id))!==keyOf(p)}))
     publicResult={status:r.status,count:publicById.size,nameOrMediaDifferencesFromDB:differs}
    }else publicResult={status:r.status,error:"PUBLIC_ROUTE_BAD_RESPONSE"}
   }
  }catch(e){publicResult={error:"PUBLIC_ROUTE_UNAVAILABLE",reason:e.message.slice(0,120)}}
  const summary={
   mode:"READ_ONLY",liveVersion:live.version,liveUpdatedAt:live.updated_at,
   migration037Applied:migrations.rows.length===1,
   migration037AppliedAt:migrations.rows[0]?.applied_at||null,
   historicalVersionsSeen:revs.map(x=>x.v),
   seedProducts:seed.products.length,knownOriginalImageSources:Object.keys(sources).length,
   exactNamePhotoReconciliations:repairs.length,
   live:audited,
   draft:draftAudit?{version:draft.base_version,updatedAt:draft.updated_at,...draftAudit}:null,
   lastCorrectVersionForMismatched:history,
   publicApi:publicResult
  }
  console.log("CELEBRATION_JEWELRY_LIVE_READONLY_DIAGNOSIS="+JSON.stringify(summary))
 }finally{await client.end()}
})().catch(error=>{console.error("READONLY_CATALOG_DIAGNOSIS_FAILED:"+error.message);process.exitCode=1})
