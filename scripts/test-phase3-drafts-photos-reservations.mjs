#!/usr/bin/env node
import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import ts from "typescript"

const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [migration,drafts,draftRoute,photos,photosRoute,photoAccess,r2,reservations,oldCheckout]=await Promise.all([
  "db/migrations/051_self_build_account_drafts_photos_and_reservations.sql",
  "lib/server/self-build-drafts.ts",
  "app/api/account/self-build/draft/route.ts",
  "lib/server/self-build-photos.ts",
  "app/api/account/self-build/photos/route.ts",
  "app/api/account/self-build/photos/[id]/route.ts",
  "lib/server/r2.ts",
  "lib/server/self-build-reservations.ts",
  "lib/server/orders/create.ts"
].map(read))
for(const table of ["self_build_draft_photos","self_build_order_reservation_batches","self_build_order_reservation_items"])
  assert(migration.includes("CREATE TABLE "+table),"Missing DB component: "+table)
assert(migration.includes("self_build_drafts_one_per_account"),"One draft/account")
assert(migration.includes("REFERENCES self_build_drafts(id) ON DELETE CASCADE"),"Photo ownership/draft cleanup")
assert(migration.includes("REFERENCES orders(id) ON DELETE CASCADE"),"Order FK for hold")
assert(!migration.includes("product_id"),"Reservations must not reference retail products")
assert(migration.includes("status IN ('reserved','committed','released')"),"Reservation lifecycle")
assert(draftRoute.includes("getCustomerSession()")&&draftRoute.includes("enforceSameOrigin(request)"))
assert(draftRoute.includes("customerSelfBuildEnabled()")&&draftRoute.includes("SELF_BUILD_NOT_LIVE"),"Disabled until launch")
assert(draftRoute.includes("private, no-store")&&!draftRoute.includes("GET /api/catalog"),"Account privacy and no retail SKU mapping")
assert(drafts.includes("getCatalogConfig()")&&drafts.includes("catalog.tiers.some"),"Verify tier ID")
assert(drafts.includes("FOR SHARE")&&drafts.includes("FOR UPDATE"),"Concurrent edits protected")
assert(drafts.includes("ON CONFLICT(customer_account_id) DO UPDATE")&&drafts.includes("now()+interval '14 days'"))
assert(drafts.includes("deleteSelfBuildPrivatePhoto")&&drafts.includes("REMOVE_EXCESS_DRAFT_PHOTOS_BEFORE_SAVING"),"Private photo cleanup on draft updates")
assert(photos.includes("limitInputPixels:16_000_000")&&photos.includes(".rotate().resize"),"Image dimensions and EXIF")
assert(photos.includes('contentType')&&photos.includes('image/webp')&&photos.includes("MAX_SELF_BUILD_PHOTOS=40"))
assert(photosRoute.includes("await customerSelfBuildEnabled()")&&photosRoute.includes("PHOTO_TOO_LARGE"))
assert(photosRoute.includes("request.body.getReader()")&&!photosRoute.includes("request.formData()"),"Stream bounded input")
assert(photoAccess.includes("readOwnedSelfBuildPhoto(session.accountId")&&photoAccess.includes("deleteOwnedSelfBuildPhoto(session.accountId"))
assert(photoAccess.includes("nosniff")&&photoAccess.includes("private, no-store"))
assert(r2.includes("uploadSelfBuildPrivatePhoto")&&r2.includes("readSelfBuildPrivatePhoto"))
assert(r2.includes("CacheControl:\"private, no-store\""),"R2 assets not public")
assert(reservations.includes("evaluateSelfBuildBudget(")&&reservations.includes("FOR UPDATE"))
assert(reservations.includes("RESERVATION_PAYLOAD_MISMATCH")&&reservations.includes("RESERVATION_LEDGER_INCONSISTENT"))
assert(reservations.includes("PAYMENT_NOT_VERIFIED")&&reservations.includes("RESERVATION_EXPIRED"))
assert(reservations.includes("reserved_units=reserved_units+$2")&&reservations.includes("reserved_units=reserved_units-$2"))
assert(reservations.includes("available_units=available_units-$2"),"Paid commit consumes real capacity")
assert(!oldCheckout.includes("self-build-reservations"),"Existing curated checkout must not be changed")

// Test the production draft normalizer (not reimplemented business logic).
const compiled=ts.transpileModule(drafts,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText
const module={exports:{}}
const mockRequire=name=>{
  if(name==="node:crypto")return {randomUUID:()=>"test-uuid"}
  if(name==="./db")return {query(){throw Error("mocked")},transaction(){throw Error("mocked")}}
  if(name==="./catalog")return {getCatalogConfig(){throw Error("mocked")}}
  if(name==="./r2")return {deleteSelfBuildPrivatePhoto(){throw Error("mocked")}}
  throw Error("UNEXPECTED_MOCK_IMPORT:"+name)
}
const {runInNewContext}=await import("node:vm")
runInNewContext(compiled,{exports:module.exports,module,require:mockRequire,console,Date,Number,Set,Map}, {timeout:1000})
const parse=module.exports.parseDraftBody
const valid=parse({
  tierId:"premium",selections:[
    {kind:"category",id:"korean-earrings",quantity:2},
    {kind:"category",id:"personalised-photos",quantity:3},
    {kind:"option",id:"chocolate-extra-100",quantity:1}
  ],otherRequestText:" Please add a note. "
})
assert.equal(valid.otherRequestText,"Please add a note.")
assert.equal(valid.selections.length,3)
const invalidCases=[
  {tierId:"premium",selections:[{kind:"category",id:"product/id",quantity:1}],otherRequestText:""},
  {tierId:"premium",selections:[{kind:"product",id:"sku-1",quantity:1}],otherRequestText:""},
  {tierId:"premium",selections:[{kind:"category",id:"korean-earrings",quantity:0}],otherRequestText:""},
  {tierId:"premium",selections:[{kind:"category",id:"korean-earrings",quantity:1.3}],otherRequestText:""},
  {tierId:"premium",selections:[{kind:"category",id:"korean-earrings",quantity:101}],otherRequestText:""},
  {tierId:"premium",selections:[{kind:"option",id:"starter",quantity:1},{kind:"option",id:"starter",quantity:1}],otherRequestText:""}
]
for(const input of invalidCases)assert.throws(()=>parse(input),undefined,"Reject malformed/duplicate draft input")
console.log("Phase 3 customer draft/photo/reservation privacy, API gating and TS normalizer tests passed.")
