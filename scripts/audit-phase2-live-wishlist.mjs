#!/usr/bin/env node
/** Live browser QA for Phase 2 saved jewellery. Never submits purchases,
 * shipping quotes, personal data, reviews or customer account mutations. */
import { chromium } from "playwright-core"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const ROOT=resolve(process.cwd(),"artifacts/phase2-wishlist")
mkdirSync(ROOT,{recursive:true})
const base=(process.env.BASE_URL||"https://shopcelebration.in").replace(/\/$/,"")
const executablePath=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(p=>p&&existsSync(p))
if(!executablePath)throw Error("Chrome executable unavailable")
const browser=await chromium.launch({headless:true,executablePath,args:["--no-sandbox","--disable-dev-shm-usage"]})
const results=[]
function check(name,ok,details=""){
 results.push({name,ok:Boolean(ok),details})
 console.log((ok?"PASS ":"FAIL ")+name+(details?" "+details:""))
}
async function get(page,path){
 const r=await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:45000})
 return r?.status()
}
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:820},locale:"en-IN",reducedMotion:"reduce"})
  await context.route("**/api/**",async route=>{
   if(["GET","HEAD"].includes(route.request().method()))return route.continue()
   return route.abort("blockedbyclient")
  })
  const page=await context.newPage()
  const errors=[]
  page.on("pageerror",e=>errors.push(e.message))
  const id=String(width)
  try{
   const status=await get(page,"/jewelry?view=all")
   check(id+" collection HTTP 200",status===200,String(status))
   const card=page.locator(".collectionGrid .catalogCard").first()
   await card.waitFor({timeout:25000})
   const href=await card.locator(".catalogCardLink").getAttribute("href")
   check(id+" exact product route",Boolean(href&&/^\/jewelry\/[a-z0-9_-]+$/i.test(href)),href||"")
   const heart=card.locator(".wishlistToggle")
   await heart.waitFor()
   await heart.waitFor({state:"visible"})
   await page.waitForFunction(()=>!document.querySelector(".collectionGrid .catalogCard .wishlistToggle")?.hasAttribute("disabled"),null,{timeout:12000})
   check(id+" initial wishlist off",await heart.getAttribute("aria-pressed")==="false")
   await heart.click()
   await page.waitForFunction(()=>document.querySelector(".collectionGrid .catalogCard .wishlistToggle")?.getAttribute("aria-pressed")==="true")
   await page.reload({waitUntil:"domcontentloaded"})
   const savedHeart=page.locator(".collectionGrid .catalogCard .wishlistToggle").first()
   await savedHeart.waitFor()
   await page.waitForFunction(()=>document.querySelector(".collectionGrid .catalogCard .wishlistToggle")?.getAttribute("aria-pressed")==="true")
   check(id+" refresh persists",await savedHeart.getAttribute("aria-pressed")==="true")
   check(id+" saved page reachable",await get(page,"/wishlist")===200)
   await page.locator(".wishlistSummary").waitFor({timeout:18000})
   const link=await page.locator(".wishlistPage .catalogCardLink").first().getAttribute("href")
   check(id+" exact SKU on saved page",link===href,link||"")
   const detailStatus=await get(page,href)
   check(id+" SKU detail reachable",detailStatus===200,String(detailStatus))
   await page.waitForFunction(()=>[...document.querySelectorAll(".wishlistDetailRow .wishlistToggle")].some(b=>b.getAttribute("aria-pressed")==="true"))
   check(id+" detail shows saved",await page.locator(".wishlistDetailRow .wishlistToggle").getAttribute("aria-pressed")==="true")
   const second=await context.newPage()
   await get(second,href)
   await second.waitForFunction(()=>document.querySelector(".wishlistDetailRow .wishlistToggle")?.getAttribute("aria-pressed")==="true")
   await page.locator(".wishlistDetailRow .wishlistToggle").click()
   await second.waitForFunction(()=>document.querySelector(".wishlistDetailRow .wishlistToggle")?.getAttribute("aria-pressed")==="false")
   check(id+" same-browser tabs synchronize",await second.locator(".wishlistDetailRow .wishlistToggle").getAttribute("aria-pressed")==="false")
   await second.close()
   await get(page,"/wishlist")
   await page.locator(".collectionEmpty h2").waitFor({timeout:15000})
   check(id+" unsave returns empty state",await page.locator(".collectionEmpty h2").innerText()==="No saved pieces yet")
   check(id+" horizontal overflow absent",await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3))
   check(id+" no page JS errors",errors.length===0,JSON.stringify(errors))
   await page.screenshot({path:resolve(ROOT,id+"-empty.png"),animations:"disabled"})
  }catch(e){check(id+" full wishlist journey",false,String(e?.message||e).slice(0,500))}
  await context.close()
 }
}finally{
 await browser.close()
 writeFileSync(resolve(ROOT,"report.json"),JSON.stringify({results,failed:results.filter(r=>!r.ok)},null,2))
}
const failed=results.filter(r=>!r.ok)
console.log("Phase 2 live wishlist QA: "+results.length+" checks, "+failed.length+" failures")
if(failed.length)process.exitCode=1
