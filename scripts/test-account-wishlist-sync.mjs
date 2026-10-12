import assert from "node:assert/strict"
import vm from "node:vm"
import ts from "typescript"
import { readFile } from "node:fs/promises"

const source=await readFile(new URL("../lib/server/customer-wishlist.ts",import.meta.url),"utf8")
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText

const accounts=new Map([["a",true],["b",true],["disabled",false]])
const wishlist=new Map([["a",new Set()],["b",new Set()]])
const products=Array.from({length:130},(_,i)=>({id:"jewellery_"+String(i+1).padStart(3,"0"),active:true}))
products.push({id:"inactive_piece",active:false})
function table(id){if(!wishlist.has(id))wishlist.set(id,new Set());return wishlist.get(id)}
async function db(text,values=[]){
  const id=values[0]
  if(text.includes("FROM customer_accounts")) return {rowCount:accounts.get(id)?1:0,rows:accounts.get(id)?[{id}]:[]}
  if(text.includes("count(*)"))return {rowCount:1,rows:[{count:String(table(id).size)}]}
  if(text.includes("SELECT product_id"))return {rowCount:table(id).size,rows:[...table(id)].reverse().slice(0,120).map(product_id=>({product_id}))}
  if(text.includes("SELECT 1 FROM customer_wishlist"))return {rowCount:table(id).has(values[1])?1:0,rows:[]}
  if(text.includes("INSERT INTO customer_wishlist")){
    const already=table(id).has(values[1]);table(id).add(values[1]);return {rowCount:already?0:1,rows:[]}
  }
  if(text.includes("DELETE FROM customer_wishlist")){
    const deleted=table(id).delete(values[1]);return {rowCount:deleted?1:0,rows:[]}
  }
  throw Error("Unexpected SQL "+text.slice(0,80))
}
const mod={exports:{}}
vm.runInNewContext(js,{module:mod,exports:mod.exports,require:(key)=>{
  if(key==="./db")return {query:db,transaction:async fn=>fn({query:db})}
  if(key==="./catalog")return {getCatalogConfig:async()=>({catalog:{products}})}
  throw Error("Unexpected dependency: "+key)
}})
const {listAccountWishlist,addWishlistProducts,setWishlistProduct}=mod.exports
const primary=products[0].id
assert.equal((await setWishlistProduct("a",primary,true)).length,1)
assert.deepEqual(await listAccountWishlist("b"),[])
assert.deepEqual(await listAccountWishlist("a"),[primary])
assert.deepEqual(await setWishlistProduct("a",primary,true),[primary],"Repeated save is idempotent")
assert.deepEqual(await addWishlistProducts("a",[primary,products[1].id,products[1].id,"inactive_piece"]),[products[1].id,primary])
assert.deepEqual(await listAccountWishlist("b"),[],"Separate accounts never leak saves")
await assert.rejects(()=>setWishlistProduct("a","x/../../",true),error=>error.code==="INVALID_WISHLIST")
await assert.rejects(()=>setWishlistProduct("a","inactive_piece",true),error=>error.code==="PRODUCT_NOT_AVAILABLE")
await assert.rejects(()=>setWishlistProduct("disabled",primary,true),error=>error.code==="AUTH_REQUIRED")
await assert.rejects(()=>addWishlistProducts("a",Array.from({length:121},()=>primary)),error=>error.code==="INVALID_WISHLIST")
await addWishlistProducts("a",products.map(p=>p.id).filter(id=>id!=="inactive_piece").slice(0,120))
assert.equal((await listAccountWishlist("a")).length,120)
await assert.rejects(()=>setWishlistProduct("a",products[121].id,true),error=>error.code==="WISHLIST_FULL")
assert.equal((await setWishlistProduct("a",primary,true)).length,120,"Idempotent save allowed at cap")
assert.equal((await setWishlistProduct("a",primary,false)).length,119)
assert.equal((await setWishlistProduct("a",products[121].id,true)).length,120,"Slot becomes reusable after delete")
assert.deepEqual(await listAccountWishlist("b"),[])
console.log("Account wishlist domain tests passed: account isolation, real SKU guards, guest import dedup, verified session lock, 120 cap, idempotent add, removal.")
