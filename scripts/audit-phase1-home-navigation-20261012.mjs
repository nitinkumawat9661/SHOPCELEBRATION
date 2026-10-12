#!/usr/bin/env node
/**
 * Celebration Phase 1 Step 4: REAL production homepage interaction tests.
 * SAFE: browsing and UI state only. No account login, cart, order, payment,
 * stock updates, webhook side effects or analytics events are submitted.
 * Automated checks cannot replace human physical-device QA.
 */
import { chromium } from "playwright-core"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root=resolve(process.cwd(),"artifacts/phase1-home-navigation")
mkdirSync(root,{recursive:true})
const base=process.env.BASE_URL||"https://shopcelebration.in/"
const chrome=[process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(x=>x&&existsSync(x))
if(!chrome)throw Error("Installed Chrome/Chromium required")
const browser=await chromium.launch({headless:true,executablePath:chrome,args:["--no-sandbox","--disable-dev-shm-usage"]})
const tests=[],critical=[],warnings=[]
const verify=(name,actual,expect,detail="")=>{
 const pass=Boolean(actual)
 const row={name,pass,expected:expect,detail}
 tests.push(row)
 if(!pass)critical.push(row)
 console.log(`${pass?"PASS":"FAIL"} ${name}${detail?" — "+detail:""}`)
}
const browserErrors=[]
const widths=[{name:"mobile-390",width:390,mobile:true},{name:"desktop-1280",width:1280,mobile:false}]
async function home(page){
 const response=await page.goto(base,{waitUntil:"domcontentloaded",timeout:55000})
 await page.locator(".celebrationFeatured .catalogCard").first().waitFor({state:"visible",timeout:20000})
 return response?.status()
}
async function goHomeAndClick(page,selector,timeout=25000){
 await home(page)
 const loc=page.locator(selector).first()
 await loc.scrollIntoViewIfNeeded({timeout:10000})
 const before=page.url()
 await loc.click({timeout:10000})
 await page.waitForURL(u=>u.toString()!==before,{timeout}).catch(()=>{})
 return page.url()
}
async function verifyRoute(page,name,selector,{path="/jewelry",query={},hash=null,check=null}={}){
 let url
 try {
  url=await goHomeAndClick(page,selector)
  const u=new URL(url)
  const expected=new URL(base)
  verify(name+" path",u.origin===expected.origin&&u.pathname===path,path,url)
  for(const [key,val] of Object.entries(query))
   verify(name+" query "+key,u.searchParams.get(key)===val,key+"="+val,url)
  if(hash!==null)verify(name+" hash",u.hash===hash,hash,url)
  if(check)await check(page,u,name)
 }catch(e) {verify(name,false,"click navigates correctly",e.message.slice(0,400))}
}
try{
 for(const setup of widths){
  const ctx=await browser.newContext({
   viewport:{width:setup.width,height:800},deviceScaleFactor:1,
   isMobile:setup.mobile,hasTouch:setup.mobile,
   reducedMotion:"reduce",locale:"en-IN",
   ...(setup.mobile?{userAgent:"Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"}:{})
  })
  // NEVER send synthetic conversion events; deny other mutating API calls.
  await ctx.route("**/api/**",async route=>{
   const method=route.request().method()
   if(method==="GET"||method==="HEAD")return route.continue()
   const url=route.request().url()
   warnings.push({name:setup.name,reason:"mutating API request intercepted in browser QA",method,url:url.split("?")[0].slice(-160)})
   await route.fulfill({status:200,contentType:"application/json",body:'{"ok":true,"testOnly":true}'})
  })
  const page=await ctx.newPage()
  page.on("pageerror",e=>browserErrors.push({width:setup.width,reason:e.message.slice(0,250)}))
  const id=setup.name
  try {
   const status=await home(page)
   verify(id+" homepage",status===200,"HTTP 200","status="+status)
   const hrefs=await page.locator(".celebrationHeader .celebrationNav a").evaluateAll(els=>els.map(e=>({text:e.textContent?.trim(),href:e.getAttribute("href")})))
   verify(id+" six actual navigation links",hrefs.length===6,"6",JSON.stringify(hrefs))
   verify(id+" navigation destinations",hrefs.map(x=>x.href).join("|")==="/#budgets|/jewelry|/jewelry?view=all|/#occasions|/#budgets|/#trust","six correct original routes")
   const expectedHeader=await page.locator(".celebrationHeader").count()
   verify(id+" logo/account/cart",expectedHeader===1&&
     await page.locator(".celebrationBrand[href='/']").count()===1 &&
     await page.locator(".celebrationHeaderActions a").count()>=2,
     "Home logo, account and cart entries")
   const categoryItems=await page.locator(".celebrationCategoryRail .celebrationCategory").evaluateAll(els=>els.map(e=>({label:e.querySelector("b")?.textContent?.trim(),href:e.getAttribute("href")})))
   verify(id+" seven existing category links",categoryItems.length===7,"7",JSON.stringify(categoryItems))
   verify(id+" all category hrefs internal",categoryItems.every(e=>e.href?.startsWith("/jewelry?view=all")||e.href==="#budgets"),"five category routes + all + hamper")
   verify(id+" no changed round image names",await page.locator(".celebrationCategoryEditorialPhoto img").count()===7,"7 currently installed category images")
   // The storefront tail (including footer) intentionally lazy-loads on
   // scroll. Trigger it before verifying footer routes.
   await page.evaluate(()=>window.scrollTo(0,500))
   await page.locator(".finalFooter a").first().waitFor({state:"attached",timeout:18000})
   const footerLinks=await page.locator(".finalFooter a").evaluateAll(els=>els.map(e=>({text:e.textContent?.trim(),href:e.getAttribute("href")})))
   verify(id+" footer support and policies",["/faq","/track","/account","/claim","/privacy","/terms"].every(href=>footerLinks.some(x=>x.href===href)),"existing key support/info pages")
   await page.screenshot({path:resolve(root,id+"-homepage-start.png"),animations:"disabled",timeout:16000})

   // Main product browsing: real clicks, inspect resulting pages, no add-to-cart.
   await verifyRoute(page,id+" explore jewelry hero",".celebrationHeroActions a[href='/jewelry']",{
    path:"/jewelry",check:async (p,u,n)=>verify(n+" collection loaded",await p.locator(".collectionSection").count()>0,"real jewellery collection")
   })
   await verifyRoute(page,id+" all gifts navigation",".celebrationNav a[href='/jewelry?view=all']",{
    path:"/jewelry",query:{view:"all"},check:async(p,u,n)=>verify(n+" collection loaded",await p.locator(".collectionSection").count()>0,"all catalogue page")
   })
   await verifyRoute(page,id+" first category",".celebrationCategoryRail .celebrationCategory[href*='category=']",{
    path:"/jewelry",query:{view:"all"},check:async(p,u,n)=>{
     verify(n+" selected category query",Boolean(u.searchParams.get("category")),"nonempty exact category",u.searchParams.get("category")||"")
     verify(n+" category products/empty state",await p.locator(".collectionResultMeta,.collectionEmpty").count()>0,"category results or honest empty state")
    }
   })
   await verifyRoute(page,id+" all category",".celebrationCategory--all",{
    path:"/jewelry",query:{view:"all"}
   })
   await verifyRoute(page,id+" featured view all",".celebrationFeatured .celebrationSectionHead a",{
    path:"/jewelry",query:{view:"all"}
   })
   // A featured product is dynamically identified by its href, not invented.
   // Verify separately because no static path should be assumed.
   await home(page)
   const firstProduct=await page.locator(".celebrationFeatured .catalogCardLink").first().getAttribute("href")
   verify(id+" exact featured destination",Boolean(firstProduct&&/^\/jewelry\/[^/?#]+$/.test(firstProduct)),"real SKU detail route",firstProduct||"")
   if(firstProduct){
     try{
       await page.locator(".celebrationFeatured .catalogCardLink").first().click({timeout:10000})
       await page.waitForURL(url=>url.pathname===firstProduct,{timeout:25000})
       verify(id+" featured detail page",page.url().includes(firstProduct)&&await page.locator("h1").count()>0,"actual product page",page.url())
     }catch(e){verify(id+" featured detail page",false,"navigate and load",e.message.slice(0,230))}
   }

   // Search must be GET-style, not synthetic orders; confirm query in URL and feedback.
   try{
    await home(page)
    await page.locator(".celebrationSearch input[type=search]").fill("ring")
    await page.locator(".celebrationSearch button[type=submit]").click({timeout:8000})
    await page.waitForURL(u=>u.pathname==="/jewelry"&&u.searchParams.get("q")==="ring",{timeout:26000})
    const u=new URL(page.url())
    verify(id+" search GET route",u.pathname==="/jewelry"&&u.searchParams.get("q")==="ring"&&u.searchParams.get("view")==="all","/jewelry?view=all&q=ring",page.url())
    verify(id+" search results",await page.locator(".collectionSearchFeedback").count()>0,"search query feedback")
   }catch(e){verify(id+" search",false,"query + page results",e.message.slice(0,350))}

   // Anchor links are safe and should load lazy homepage sections if needed.
   for(const [n,sel,hash,target] of [
    ["hero Shop Hampers",".celebrationHeroActions a[href='#budgets']","#budgets","#budgets"],
    ["header Occasions",".celebrationNav a[href='/#occasions']","#occasions","#occasions"],
    ["header Why Celebration",".celebrationNav a[href='/#trust']","#trust","#trust"],
    ["Custom Hampers category",".celebrationCategory--hamper","#budgets","#budgets"],
    ["custom budget request",".budgetDecisionHint a[href='#custom-request']","#custom-request","#custom-request"]
   ]){
    try{
     const url=await goHomeAndClick(page,sel)
     verify(id+" "+n+" hash",new URL(url).hash===hash,hash,url)
     await page.locator(target).first().waitFor({state:"attached",timeout:16000})
     verify(id+" "+n+" target",await page.locator(target).count()>0,"destination section exists")
    }catch(e){verify(id+" "+n,false,"anchor target resolves",e.message.slice(0,350))}
   }

   // Tier selection exercises genuine client state. No delivery form is
   // submitted and all mutating API calls above are stubbed.
   try{
    await home(page)
    const tile=page.locator("#budgets .tier").first()
    const name=(await tile.locator(".name").textContent())?.trim()
    await tile.click({timeout:12000})
    await page.locator("#builder.quickBuilder .quickHamperSummaryName").waitFor({state:"visible",timeout:20000})
    const selected=(await page.locator("#builder .quickHamperSummaryName").textContent())?.trim()
    verify(id+" budget selection opens builder",selected===name,"same genuine hamper tier selected",name+" -> "+selected)
    verify(id+" quick builder starts with delivery",await page.locator("#builder.quickBuilder .hamperDeliveryStep").count()>0,"delivery form; no payment automatically")
    await page.screenshot({path:resolve(root,id+"-budget-to-builder.png"),animations:"disabled",timeout:15000}).catch(()=>{})
    // The builder Change Budget returns to budgets without changing actual order.
    await page.locator("#builder .quickHamperChange").click({timeout:10000})
    verify(id+" change budget",await page.locator("#budgets .tier").count()>0,"budget choices still available")
   }catch(e){verify(id+" budget-to-builder",false,"selection and delivery step",e.message.slice(0,380))}

   // Occasion buttons must open and preserve real chosen occasion, without
   // placing an order or modifying any shipping data.
   try{
    await home(page)
    const choices=page.locator("#occasions button.chip")
    const total=await choices.count()
    verify(id+" occasion choices",total>=2,"2+ real occasion buttons","found "+total)
    if(total>=2){
     const choice=choices.nth(1)
     const occasion=(await choice.locator(".celebrationOccasionName").textContent())?.trim()
     await choice.click({timeout:10000})
     await page.locator("#builder .stepPane").waitFor({state:"visible",timeout:20000})
     const picked=await page.locator("#builder select.selectOcc").inputValue()
     verify(id+" occasion selected in builder",picked===occasion,"selected option preserved",occasion+" -> "+picked)
     verify(id+" occasion starts budget flow",await page.locator("#builder .tierSmall").count()>0,"regular curated hamper budget flow")
    }
   }catch(e){verify(id+" occasion-to-builder",false,"occasion retained in client builder",e.message.slice(0,400))}

   // Browser QA never modifies the shopping cart: link existence only.
   await home(page)
   verify(id+" cart + account link destinations",
    await page.locator(".celebrationHeaderActions a[href='/cart']").count()>0&&
    await page.locator(".celebrationHeaderActions a[href='/account']").count()>0,
    "existing cart and account destinations, no login or purchase")
  }finally{await ctx.close()}
 }
}finally{
 const report={
  version:"phase1-home-navigation-20261012",site:base,generated:new Date().toISOString(),
  testedViewports:widths,tests,critical,warnings,browserErrors,
  warning:"Synthetic production browsing. Intercepts non-GET API requests including conversion tracking; no payment, order, login, stock or cart writes."
 }
 writeFileSync(resolve(root,"report.json"),JSON.stringify(report,null,2)+"\n")
 await browser.close()
 console.log(`Celebration homepage navigation audit: ${tests.length} checks, ${critical.length} FAIL, ${warnings.length} blocked mutations, ${browserErrors.length} page errors`)
 for(const bad of critical)console.error("FAIL "+bad.name+" "+bad.detail)
 for(const bad of browserErrors)console.warn("BROWSER ERROR "+bad.width+" "+bad.reason)
 if(critical.length||browserErrors.length)process.exitCode=1
}
