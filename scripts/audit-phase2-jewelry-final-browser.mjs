#!/usr/bin/env node
/**
 * Real production Chromium QA for the approved Phase 2 jewellery listing/PDP.
 * GET requests only plus browser-local cart/wishlist state. No real customer,
 * courier, payment, review, checkout, admin, or order mutation is performed.
 */
import { chromium } from "playwright-core"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const base=(process.env.BASE_URL||"https://shopcelebration.in").replace(/\/$/,"")
const dir=resolve("artifacts/phase2-jewelry-final")
mkdirSync(dir,{recursive:true})
const executablePath=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(p=>p&&existsSync(p))
if(!executablePath)throw Error("Chrome executable is required for Phase 2 browser QA")
const browser=await chromium.launch({headless:true,executablePath,args:["--no-sandbox","--disable-dev-shm-usage"]})
const rows=[]
function verify(name,ok,detail="") {
 const entry={name,ok:Boolean(ok),detail:String(detail).slice(0,700)}
 rows.push(entry)
 console.log((entry.ok?"PASS ":"FAIL ")+name+(entry.detail?" :: "+entry.detail:""))
}
const assert=(condition,message)=>{if(!condition)throw Error(message)}
const pathname=request=>new URL(request.url()).pathname
async function visit(page,url){const response=await page.goto(base+url,{waitUntil:"domcontentloaded",timeout:60000});assert(response?.status()===200,"GET "+url+" returned "+response?.status());return response}
async function ready(page){await page.waitForFunction(()=>{const btn=document.querySelector(".collectionGrid .wishlistToggle, .wishlistDetailRow .wishlistToggle");return btn && !btn.disabled},null,{timeout:20000})}
async function noOverflow(page,label){
 const info=await page.evaluate(()=>({viewport:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}))
 verify(label+" no page horizontal overflow",info.doc<=info.viewport+3,JSON.stringify(info))
}
const prices=async page=>page.locator(".collectionGrid .catalogCard").evaluateAll(cards=>cards.flatMap(card=>{
 const individual=card.querySelector(".catalogCardPrice>span")?.textContent?.includes("Individual item")
 const strong=card.querySelector(".catalogCardPrice strong")?.textContent||""
 const number=Number(strong.replace(/[^\d.]/g,""))
 return individual && Number.isFinite(number) ? [number] : []
}))
async function filterPanel(page,number,dialogName){
 await page.locator(".marketplaceFilterBar>button").nth(number).click()
 const dialog=page.getByRole("dialog",{name:dialogName})
 await dialog.waitFor({state:"visible",timeout:12000})
 return dialog
}
async function awaitParam(page,key,val) {
 await page.waitForFunction(([k,v])=>new URLSearchParams(location.search).get(k)===v,[key,val],{timeout:20000})
 await page.locator(".marketplaceFilterBar").waitFor({state:"visible"})
}

try{
 for(const width of [320,390,430,1280]){
  const label=String(width)
  const context=await browser.newContext({viewport:{width,height:830},reducedMotion:"reduce",locale:"en-IN"})
  // Browser QA must never charge a customer, book shipping, write reviews or
  // touch live account/cart server data. Buy Now below only updates localStorage.
  await context.route("**/api/**",async route=>{
   const method=route.request().method()
   if(method==="GET"||method==="HEAD")return route.continue()
   return route.abort("blockedbyclient")
  })
  const page=await context.newPage()
  const errors=[]
  page.on("pageerror",error=>errors.push(error.message))
  try{
   await visit(page,"/jewelry?view=all")
   const cards=page.locator(".collectionGrid .catalogCard")
   await cards.first().waitFor({timeout:20000})
   const originalCount=await cards.count()
   verify(label+" product grid loads",originalCount>=4,"count="+originalCount)
   const layout=await cards.evaluateAll(nodes=>nodes.slice(0,4).map(n=>{const r=n.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width)}}))
   const twoCols=layout.length>=2&&Math.abs(layout[0].y-layout[1].y)<4&&layout[1].x>layout[0].x+30
   const fourCols=layout.length>=4&&layout.slice(1).every(n=>Math.abs(n.y-layout[0].y)<4)&&layout[3].x>layout[2].x
   verify(label+" responsive first-row columns",width===1280?fourCols:twoCols,JSON.stringify(layout))
   const sellable=page.locator(".collectionGrid .catalogCard:has(> .cartAddControl)").first()
   await sellable.waitFor({timeout:15000})
   const firstPath=await sellable.locator(".catalogCardLink").getAttribute("href")
   const firstName=(await sellable.locator("h3").innerText()).trim()
   const firstCategory=(await sellable.locator(".catalogCardCategory").innerText()).trim()
   const firstPrice=(await sellable.locator(".catalogCardPrice strong").innerText()).trim()
   assert(/^\/jewelry\/[a-z0-9_-]+$/i.test(firstPath||""),"Product route is not exact SKU")
   verify(label+" first SKU name and price",Boolean(firstName&&firstPrice),firstPath+" "+firstName+" "+firstPrice)
   await noOverflow(page,label+" listing")
   if(width===390||width===1280){
    const sort=await filterPanel(page,0,"Sort products")
    verify(label+" filter dialog accessible",await sort.getAttribute("aria-modal")==="true"&&await sort.isVisible())
    await page.keyboard.press("Escape")
    await sort.waitFor({state:"hidden",timeout:8000})
    verify(label+" Escape closes dialog",await page.getByRole("dialog").count()===0)

    const chooseSort=await filterPanel(page,0,"Sort products")
    await chooseSort.getByRole("button",{name:"Price: Low to High"}).click()
    await awaitParam(page,"sort","price-low")
    const low=await prices(page)
    verify(label+" ascending price sort",low.length>0&&low.every((v,i)=>i===0||v>=low[i-1]),JSON.stringify(low.slice(0,15)))
    const highSort=await filterPanel(page,0,"Sort products")
    await highSort.getByRole("button",{name:"Price: High to Low"}).click()
    await awaitParam(page,"sort","price-high")
    const high=await prices(page)
    verify(label+" descending price sort",high.length>0&&high.every((v,i)=>i===0||v<=high[i-1]),JSON.stringify(high.slice(0,15)))

    const priceSheet=await filterPanel(page,2,"Filter by price")
    await priceSheet.getByRole("button",{name:"₹180 & above"}).click()
    await awaitParam(page,"price","180-plus")
    const priceFiltered=await prices(page)
    verify(label+" price >=₹180 boundaries",priceFiltered.every(v=>v>=180),JSON.stringify(priceFiltered.slice(0,15)))

    const categorySheet=await filterPanel(page,1,"Filter by category")
    const second=categorySheet.locator(".marketplaceFilterOptions>button").nth(1)
    const category=(await second.locator("span").first().innerText()).trim()
    const countLabel=await second.locator("small").innerText()
    await second.click()
    await awaitParam(page,"category",category)
    const combined=await page.locator(".collectionGrid .catalogCardCategory").allInnerTexts()
    verify(label+" category AND price are correctly intersected",combined.every(v=>v.trim()===category)&&await prices(page).then(values=>values.every(v=>v>=180)),category+" + price >= 180, count="+combined.length)
    const noPrice=await filterPanel(page,2,"Filter by price")
    await noPrice.getByRole("button",{name:"All prices"}).click()
    await page.waitForFunction(()=>!new URLSearchParams(location.search).has("price"),null,{timeout:20000})
    await page.waitForFunction(expected=>document.querySelectorAll(".collectionGrid .catalogCard").length===expected,Number.parseInt(countLabel),{timeout:20000})
    const categories=await page.locator(".collectionGrid .catalogCardCategory").allInnerTexts()
    verify(label+" category exact-match after removing price filter",categories.length===Number.parseInt(countLabel)&&categories.every(v=>v.trim().toLocaleLowerCase()===category.toLocaleLowerCase()),category+" expected "+countLabel+" actual "+categories.length)
    const clear=page.getByRole("button",{name:"Clear all filters"})
    await clear.click()
    await page.waitForFunction(()=>!["sort","category","price","q"].some(k=>new URLSearchParams(location.search).has(k)),null,{timeout:20000})
    await page.waitForFunction(expected=>document.querySelectorAll(".collectionGrid .catalogCard").length===expected,originalCount,{timeout:20000})
    verify(label+" clear-all resets filters without dropping view",new URL(page.url()).searchParams.get("view")==="all"&&await cards.count()===originalCount)

    const term=firstName.split(/[^a-zA-Z0-9]+/).find(x=>x.length>=4)||firstCategory.split(" ")[0]
    await visit(page,"/jewelry?view=all&q="+encodeURIComponent(term))
    await page.locator(".collectionSearchFeedback").waitFor({timeout:15000})
    const matches=await page.locator(".collectionGrid .catalogCardLink").evaluateAll(els=>els.map(a=>a.getAttribute("href")))
    verify(label+" search retains true SKU",matches.includes(firstPath),"q="+term+", count="+matches.length)
    await page.getByRole("link",{name:"Clear search ×"}).click()
    await page.waitForFunction(()=>!new URLSearchParams(location.search).has("q"),null,{timeout:20000})
    verify(label+" search clear preserves catalogue",new URL(page.url()).searchParams.get("view")==="all")

    await visit(page,"/jewelry?view=all&q=__celebration_no_such_real_sku_7864")
    verify(label+" empty search honest state",await page.locator(".collectionEmpty").count()>0)
    await noOverflow(page,label+" filters and search")
   }

   await visit(page,firstPath)
   await ready(page)
   const detailName=(await page.locator(".collectionDetailInfo h1").innerText()).trim()
   verify(label+" PDP is exact selected SKU",detailName===firstName,firstPath+" "+detailName)
   const gallery=page.locator(".marketplaceGalleryStage")
   await gallery.waitFor({state:"visible",timeout:15000})
   const imageFrame=gallery.locator(".safeCatalogImageFrame")
   await page.waitForFunction(()=>{const stage=document.querySelector(".marketplaceGalleryStage .safeCatalogImageFrame");return stage && ["ready","unavailable"].includes(stage.dataset.imageState)},null,{timeout:29000})
   const imageState=await imageFrame.getAttribute("data-image-state")
   const alt=await gallery.locator("img").first().getAttribute("alt")
   verify(label+" authentic SKU photo loads",imageState==="ready",imageState+" alt="+alt)
   verify(label+" image identifies SKU",Boolean(alt&&!/image unavailable/i.test(alt)),String(alt))
   const arrows=gallery.locator(".marketplaceGalleryArrow")
   const thumbs=page.locator(".marketplaceGalleryThumbs button")
   if(await arrows.count()===2&&await thumbs.count()>=2){
     const before=await gallery.locator(".marketplaceGalleryCount").innerText()
     await gallery.getByRole("button",{name:"Next image"}).click()
     await page.waitForFunction(old=>document.querySelector(".marketplaceGalleryCount")?.textContent!==old,before)
     verify(label+" image navigation",await gallery.locator(".marketplaceGalleryCount").innerText()!==before)
     await gallery.focus()
     await page.keyboard.press("ArrowLeft")
     await page.waitForFunction(old=>document.querySelector(".marketplaceGalleryCount")?.textContent===old,before)
     verify(label+" gallery keyboard and focus",await gallery.locator(".marketplaceGalleryCount").innerText()===before)
   }else{
     verify(label+" single-photo SKU has no invented gallery angles",await arrows.count()===0&&await thumbs.count()===0)
   }
   verify(label+" PIN check exists before checkout",await page.locator(".productPincodeEstimate").count()===1)
   const buySelector=width>700?".collectionDetailActions .cartAddControl button.primary":".mobileMarketplaceBuyBar .cartAddControl button.primary"
   const buy=page.locator(buySelector).first()
   await buy.waitFor({state:"visible",timeout:13000})
   await buy.click()
   await page.waitForURL(url=>url.pathname==="/cart",{timeout:25000})
   const item=page.locator(".marketCartItem").first()
   await item.waitFor({timeout:18000})
   const cartRoute=await item.locator(".marketCartImage").getAttribute("href")
   const cartTitle=(await item.locator(".marketCartItemCopy").innerText())
   verify(label+" Buy Now routes exact SKU to cart",cartRoute===firstPath&&cartTitle.includes(firstName),cartRoute+" "+cartTitle.slice(0,100))
   verify(label+" customer price is delivery-inclusive",await page.getByText("FREE",{exact:true}).count()>0)
   verify(label+" cart checkout not submitted",new URL(page.url()).pathname==="/cart")
   await noOverflow(page,label+" cart")
   verify(label+" no browser JS exceptions",errors.length===0,JSON.stringify(errors))
   if(width===390||width===1280)await page.screenshot({path:resolve(dir,"cart-"+label+".png"),animations:"disabled",fullPage:false})
  }catch(e){verify(label+" end-to-end Phase 2 journey",false,String(e?.stack||e).slice(0,800))}
  await context.close()
 }
}finally{
 await browser.close()
 writeFileSync(resolve(dir,"results.json"),JSON.stringify({base,checkedAt:new Date().toISOString(),checks:rows,failures:rows.filter(r=>!r.ok)},null,2))
}
const failed=rows.filter(r=>!r.ok)
console.log("Phase 2 jewellery listing/PDP final QA:",rows.length,"checks,",failed.length,"failures")
if(failed.length)process.exitCode=1
