#!/usr/bin/env node
/** Account cross-device UI contract with a mocked authenticated API.
 * No customer credentials, orders, or production wishlist writes. */
import { chromium } from "playwright-core"
import { existsSync } from "node:fs"
const base=(process.env.BASE_URL||"https://shopcelebration.in").replace(/\/$/,"")
const executablePath=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(p=>p&&existsSync(p))
if(!executablePath)throw Error("No Chrome executable")
const browser=await chromium.launch({headless:true,executablePath,args:["--no-sandbox","--disable-dev-shm-usage"]})
const backend=new Map([["account-A",new Set()],["account-B",new Set()]])
const json=(body,status=200)=>({status,contentType:"application/json",headers:{"Cache-Control":"no-store"},body:JSON.stringify(body)})
function saved(account){return [...backend.get(account)||[]]}
async function device(width,account) {
 const context=await browser.newContext({viewport:{width,height:820}})
 let activeAccount=account
 await context.route("**/api/account/me",route=>route.fulfill(json({ok:true,account:activeAccount?{id:activeAccount}:null})))
 await context.route("**/api/account/wishlist",async route=>{
  if(!activeAccount)return route.fulfill(json({ok:false,error:"AUTH_REQUIRED"},401))
  const method=route.request().method()
  if(method==="GET")return route.fulfill(json({ok:true,productIds:saved(activeAccount)}))
  let body
  try{body=route.request().postDataJSON()}catch{return route.fulfill(json({ok:false},422))}
  const items=backend.get(activeAccount)
  if(method==="PUT"){
   if(body.saved)items.add(body.productId);else items.delete(body.productId)
   return route.fulfill(json({ok:true,productIds:saved(activeAccount)}))
  }
  if(method==="POST"){
   for(const id of body.productIds)items.add(id)
   return route.fulfill(json({ok:true,productIds:saved(activeAccount)}))
  }
  return route.fulfill(json({ok:false},405))
 })
 await context.route("**/api/**",async route=>{
  if(["GET","HEAD"].includes(route.request().method()))return route.continue()
  return route.abort("blockedbyclient")
 })
 return {context,page:await context.newPage(),switchAccount:(id)=>{activeAccount=id}}
}
function assert(x,why){if(!x)throw Error(why);console.log("PASS "+why)}
try{
 const desk=await device(1280,"account-A")
 const phone=await device(390,"account-A")
 const other=await device(390,"account-B")
 await desk.page.goto(base+"/jewelry?view=all",{waitUntil:"domcontentloaded"})
 const card=desk.page.locator(".collectionGrid .catalogCard").first()
 await card.waitFor({timeout:25000})
 const target=await card.locator(".catalogCardLink").getAttribute("href")
 await desk.page.waitForFunction(()=>!document.querySelector(".collectionGrid .wishlistToggle")?.disabled)
 await card.locator(".wishlistToggle").click()
 await desk.page.waitForFunction(()=>document.querySelector(".collectionGrid .wishlistToggle")?.getAttribute("aria-pressed")==="true")
 assert(saved("account-A").length===1,"Account A writes only to its own simulated server wishlist")
 await phone.page.goto(base+"/wishlist",{waitUntil:"domcontentloaded"})
 await phone.page.locator(".wishlistSummary").waitFor({timeout:20000})
 assert(await phone.page.locator(".wishlistPage .catalogCardLink").first().getAttribute("href")===target,"Phone reads desktop saved exact SKU from same account")
 await other.page.goto(base+"/wishlist",{waitUntil:"domcontentloaded"})
 await other.page.locator(".collectionEmpty h2").waitFor({timeout:15000})
 assert(saved("account-B").length===0,"Other account cannot see previous customer's pieces")
 await phone.page.locator(".wishlistToggle").first().click()
 await phone.page.locator(".collectionEmpty h2").waitFor({timeout:15000})
 await desk.page.reload({waitUntil:"domcontentloaded"})
 await desk.page.waitForFunction(()=>document.querySelector(".collectionGrid .wishlistToggle")?.getAttribute("aria-pressed")==="false")
 assert(saved("account-A").length===0,"Removal from phone is retrieved on desktop")
 const guest=await device(390,null)
 await guest.page.goto(base+"/jewelry?view=all",{waitUntil:"domcontentloaded"})
 await guest.page.waitForFunction(()=>!document.querySelector(".collectionGrid .wishlistToggle")?.disabled)
 await guest.page.locator(".collectionGrid .wishlistToggle").first().click()
 assert(saved("account-A").length===0,"Guest save stays local until sign in")
 guest.switchAccount("account-A")
 await guest.page.evaluate(()=>window.dispatchEvent(new Event("celebration:auth-changed")))
 await guest.page.waitForFunction(()=>document.querySelector(".collectionGrid .wishlistToggle")?.getAttribute("aria-pressed")==="true")
 assert(saved("account-A").length===1,"Guest favourites are merged, not replaced, after sign in")
 const remaining=await guest.page.evaluate(()=>localStorage.getItem("celebration.wishlist.v1"))
 assert(remaining===null,"Anonymous saved copy removed only after import confirmation")
 await guest.context.close()
 await desk.context.close();await phone.context.close();await other.context.close()
 console.log("Account wishlist mock cross-device QA passed.")
} finally { await browser.close() }
