#!/usr/bin/env node
// Read-only production browser QA. Uses anonymous localStorage test hearts;
// blocks POST/PUT/PATCH/DELETE to live APIs. Does not mutate live DB or orders.
import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { chromium } from "playwright-core"
const base=(process.env.BASE_URL||"https://shopcelebration.in").replace(/\/$/,"")
const browserPath=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(v=>v&&existsSync(v))
if(!browserPath)throw Error("Chrome not installed")
const browser=await chromium.launch({headless:true,executablePath:browserPath,args:["--no-sandbox","--disable-dev-shm-usage"]})
await mkdir("artifacts/wishlist-header-premium",{recursive:true})
try{
 for(const width of [320,375,390,768,1024,1280]){
  const ctx=await browser.newContext({viewport:{width,height:840},reducedMotion:"reduce"})
  await ctx.route("**/api/**",route=>{
    if(["GET","HEAD"].includes(route.request().method()))return route.continue()
    return route.abort("blockedbyclient")
  })
  const page=await ctx.newPage()
  const errors=[]
  page.on("pageerror",event=>errors.push(event.message))
  const product=await page.goto(base+"/jewelry?view=all",{waitUntil:"domcontentloaded",timeout:45000})
  assert.equal(product?.status(),200,"Jewelry catalog public")
  const first=page.locator(".collectionGrid .catalogCardLink").first()
  await first.waitFor({timeout:25000})
  const path=await first.getAttribute("href")
  assert(/^\/jewelry\/[a-z0-9_-]+$/i.test(path||""),"Select exact public SKU")
  const sku=decodeURIComponent(path.split("/").at(-1))
  await page.evaluate(id=>localStorage.setItem("celebration.wishlist.v1",JSON.stringify([id])),sku)
  const status=await page.goto(base+"/wishlist",{waitUntil:"domcontentloaded"})
  assert.equal(status?.status(),200)
  await page.locator(".wishlistSummary").waitFor({timeout:18000})
  assert.equal(await page.locator(".wishlistHero").count(),0,"Hero is completely removed")
  assert.equal(await page.getByText("Pieces you", {exact:false}).count(),0,"Promotional headline removed")
  const savedPanel = page.locator(".wishlistCollectionPanel")
  await savedPanel.waitFor()
  const panelRect = await savedPanel.boundingBox()
  assert(panelRect && panelRect.y < 650,"Saved pieces visible immediately without a large hero")
  const heart=page.locator(".celebrationWishlistHeaderLink")
  await heart.waitFor()
  await page.waitForFunction(()=>Boolean(document.querySelector(".celebrationWishlistCount")))
  assert.equal(await page.locator(".celebrationWishlistCount").innerText(),"1")
  const top=page.locator(".celebrationHeaderActions")
  const headerSaved=await heart.boundingBox()
  const notification=await page.locator(".celebrationNotificationLink").boundingBox()
  const cart=await page.locator(".celebrationCartLink").boundingBox()
  assert(headerSaved&&notification&&cart&&headerSaved.x<notification.x&&notification.x<cart.x,"Saved -> Notifications -> Cart, in order")
  assert.equal(await page.locator(".wishlistPage .catalogCardLink").first().getAttribute("href"),path,"Exact saved SKU")
  const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+3)
  assert.equal(horizontalOverflow,false,"Wishlist viewport fits "+width)
  assert.equal(errors.length,0,"No JavaScript errors "+JSON.stringify(errors))
  await page.screenshot({path:`artifacts/wishlist-header-premium/wishlist-${width}.png`,fullPage:true,animations:"disabled"})
  console.log("WISHLIST_PREMIUM_BROWSER_PASS "+width)
  await ctx.close()
 }
 console.log("WISHLIST_PREMIUM_BROWSER_ALL_PASSED")
}finally{await browser.close()}
