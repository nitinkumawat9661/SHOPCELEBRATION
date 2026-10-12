#!/usr/bin/env node
/** Read-only production browser QA: mock the POST /api/shipping/product-estimate
 * response so no Shipway account quota, customer checkout or order is touched. */
import { chromium } from "playwright-core"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const dir=resolve("artifacts/phase2-pincode")
mkdirSync(dir,{recursive:true})
const base=(process.env.BASE_URL||"https://shopcelebration.in").replace(/\/$/,"")
const chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(s=>s&&existsSync(s))
if(!chrome)throw Error("Chrome not installed")
const browser=await chromium.launch({headless:true,executablePath:chrome,args:["--no-sandbox","--disable-dev-shm-usage"]})
const rows=[]
function verify(name,ok,details=""){
 rows.push({name,ok:Boolean(ok),details})
 console.log((ok?"PASS ":"FAIL ")+name+(details?" "+details:""))
}
const responses=[
 {ok:true,serviceable:true,estimatedDeliveryDate:null,estimatedTransitDays:null},
 {ok:true,serviceable:true,estimatedDeliveryDate:null,estimatedTransitDays:4},
 {ok:true,serviceable:true,estimatedDeliveryDate:"2026-10-20",estimatedTransitDays:null},
 {ok:false,error:"NOT_SERVICEABLE"},
 {ok:false,error:"DELIVERY_CHECK_UNAVAILABLE"}
]
try{
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:800},reducedMotion:"reduce",locale:"en-IN"})
  let count=0, posts=[]
  await context.route("**/api/**",async route=>{
   const request=route.request()
   const pathname=new URL(request.url()).pathname
   if(pathname==="/api/shipping/product-estimate" && request.method()==="POST"){
    const payload=request.postDataJSON()
    posts.push(payload)
    const body=responses[Math.min(count++,responses.length-1)]
    const status=body.ok?200:body.error==="NOT_SERVICEABLE"?422:503
    await route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)})
   } else if(["GET","HEAD"].includes(request.method())) await route.continue()
   else await route.abort("blockedbyclient")
  })
  const page=await context.newPage(),errors=[]
  page.on("pageerror",e=>errors.push(e.message))
  try{
   const collection=await page.goto(base+"/jewelry?view=all",{waitUntil:"domcontentloaded",timeout:50000})
   verify(width+" browse",collection?.status()===200)
   const path=await page.locator(".collectionGrid .catalogCardLink").first().getAttribute("href")
   verify(width+" exact SKU",Boolean(path&&path.startsWith("/jewelry/")),path||"")
   const response=await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:50000})
   verify(width+" product page",response?.status()===200)
   const widget=page.locator(".productPincodeEstimate")
   await widget.waitFor({state:"visible",timeout:18000})
   // Wait for React hydration; a visible SSR form can render before handlers attach.
   await page.waitForFunction(()=>{const heart=document.querySelector(".wishlistDetailRow .wishlistToggle");return heart && !heart.disabled},{timeout:20000})
   const pin=widget.locator("#product-delivery-pincode"),button=widget.locator("button[type=submit]")
   verify(width+" disabled until valid PIN",await button.isDisabled())
   await pin.fill("302001")
   verify(width+" ready on six digits",await button.isEnabled())
   await button.click()
   await widget.locator("text=A reliable delivery date isn’t available from the courier yet.").waitFor({timeout:15000})
   verify(width+" no fabricated date",await widget.getByText("Delivery available to 302001").count()===1)
   await pin.fill("110001");await button.click()
   await widget.locator("text=Courier-estimated transit: 4 days after dispatch.").waitFor({timeout:15000})
   verify(width+" carrier days conditional",count===2)
   await pin.fill("400001");await button.click()
   await widget.locator("text=Courier-estimated delivery:").waitFor({timeout:15000})
   verify(width+" carrier date conditional",count===3)
   await pin.fill("560001");await button.click()
   await widget.locator("text=Delivery isn’t available to this PIN code").waitFor({timeout:15000})
   verify(width+" distinct unavailable PIN",count===4)
   await pin.fill("700001");await button.click()
   await widget.locator("text=We couldn’t verify delivery right now.").waitFor({timeout:15000})
   verify(width+" upstream outage not mislabeled unavailable",count===5)
   verify(width+" request carries only PIN and SKU",posts.every(o=>o.pincode&&o.productId===path.slice("/jewelry/".length)&&Object.keys(o).length===2))
   const overflow=await page.evaluate(()=>{
    const rootWidth=document.documentElement.scrollWidth
    const viewport=innerWidth
    const offender=[...document.querySelectorAll("body *:not(.trustStrip):not(.trustStrip *)")].flatMap(el=>{
      const rect=el.getBoundingClientRect()
      if(!rect.width || !rect.height || (rect.right+scrollX<=viewport+2 && rect.left+scrollX>=-2))return []
      const style=getComputedStyle(el)
      if(style.position==="fixed" || style.visibility==="hidden")return []
      return [{tag:el.tagName,classes:String(el.className||"").slice(0,120),left:Math.round(rect.left),right:Math.round(rect.right),width:Math.round(rect.width)}]
    }).slice(0,18)
    return {rootWidth,viewport,scrollX,offender}
   })
   console.log("MOBILE_OVERFLOW_DIAGNOSTIC "+width+" "+JSON.stringify(overflow))
   verify(width+" no horizontal overflow",overflow.rootWidth<=overflow.viewport+3,JSON.stringify(overflow))
   verify(width+" no JS errors",!errors.length,JSON.stringify(errors))
   await page.screenshot({path:resolve(dir,"product-"+width+".png"),animations:"disabled"})
  }catch(e){verify(width+" complete scenario",false,String(e?.message||e).slice(0,600))}
  await context.close()
 }
}finally{
 await browser.close()
 writeFileSync(resolve(dir,"results.json"),JSON.stringify({rows,failures:rows.filter(r=>!r.ok)},null,2))
}
const failures=rows.filter(r=>!r.ok)
console.log("Phase 2 PIN delivery browser QA:",rows.length,"checks,",failures.length,"failures")
if(failures.length)process.exitCode=1
