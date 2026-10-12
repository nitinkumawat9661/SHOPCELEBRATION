#!/usr/bin/env node
/**
 * Phase 1 — READ-ONLY live-browser visual geometry and screenshot audit.
 *
 * This visits the actual published shopcelebration.in homepage from the
 * GitHub Actions runner. Five real Chromium mobile viewports are inspected.
 * It never places orders, changes stock, clicks payment, or edits category art.
 *
 * Screenshots are for a human reviewer; programmatic bounds cannot certify
 * art direction, SKU/image correctness or subjective visual appeal.
 */
import { chromium } from "playwright-core"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root=resolve(process.cwd(),"artifacts/phase1-home-mobile")
mkdirSync(root,{recursive:true})
const base=process.env.BASE_URL || "https://shopcelebration.in/"
const widths=[320,360,375,390,430]
const browserPath=[
  process.env.CHROME_BIN,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/snap/bin/chromium"
].find(p=>p&&existsSync(p))
if(!browserPath)throw new Error("GitHub runner needs an installed Chromium or Google Chrome binary")

const browser=await chromium.launch({
  headless:true,executablePath:browserPath,
  args:["--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars"]
})
const report={site:base,generatedAt:new Date().toISOString(),version:"phase1-mobile-20261012",widths:[],errors:[],warnings:[],scope:"Nonmutating browser QA of the live homepage. Shop by Category photos unchanged."}
const severe=(width,message)=>report.errors.push({width,message})
const warn=(width,message)=>report.warnings.push({width,message})
const getMetrics=async page=>page.evaluate(()=>{
  const $=selector=>document.querySelector(selector)
  const rect=el=>{if(!el)return null;const b=el.getBoundingClientRect();return{x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),bottom:Math.round(b.bottom),right:Math.round(b.right)}}
  const visible=el=>{if(!el)return false;const s=getComputedStyle(el);const b=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&b.width>0&&b.height>0}
  const cards=[...document.querySelectorAll(".celebrationFeatured .collectionGrid>.catalogCard")]
  const categories=[...document.querySelectorAll(".celebrationCategories .celebrationCategory")]
  const header=$(".celebrationHome .celebrationHeader")
  const results={
    viewport:innerWidth,docWidth:document.documentElement.scrollWidth,
    bodyWidth:document.body.scrollWidth,
    docHeight:document.documentElement.scrollHeight,
    header:rect(header),
    hero:rect($(".celebrationHero")),
    heroText:rect($(".celebrationHero h1")),
    heroAction1:rect($(".celebrationHeroActions a")),
    search:rect($(".celebrationHome .celebrationSearch")),
    nav:rect($(".celebrationHome .celebrationNav")),
    brand:rect($(".celebrationHome .celebrationBrand")),
    actions:rect($(".celebrationHome .celebrationHeaderActions")),
    categories:rect($(".celebrationCategories")),
    categoryCount:categories.length,
    categoryRects:categories.map(rect),
    categoryPhotoCount:categories.filter(el=>!!el.querySelector(".celebrationCategoryEditorialPhoto img")).length,
    featured:rect($(".celebrationFeatured")),
    featuredCount:cards.length,
    featuredGrid:getComputedStyle($(".celebrationFeatured .collectionGrid")||document.body).gridTemplateColumns,
    featuredDisplay:getComputedStyle($(".celebrationFeatured .collectionGrid")||document.body).display,
    featuredOverflow:getComputedStyle($(".celebrationFeatured .collectionGrid")||document.body).overflowX,
    featuredCards:cards.map((el,i)=>({
      index:i,rect:rect(el),
      title:el.querySelector("h3")?.textContent?.trim()||"",
      titleClipped:(()=>{
        const heading=el.querySelector("h3")
        if(!heading)return null
        const computed=getComputedStyle(heading)
        return heading.scrollHeight>heading.clientHeight+2 ||
          (computed.webkitLineClamp!=="none" && computed.webkitLineClamp!=="unset" && computed.webkitLineClamp!=="" && Number(computed.webkitLineClamp)>0)
      })(),
      image:el.querySelector(".catalogCardVisual img")?{
        loaded:el.querySelector(".catalogCardVisual img").complete,
        naturalWidth:el.querySelector(".catalogCardVisual img").naturalWidth,
        src:el.querySelector(".catalogCardVisual img").currentSrc?.split("?")[0]?.slice(-140)
      }:null,
      cartButton:rect(el.querySelector(".cartAddControl button")),
      price:el.querySelector(".catalogCardPrice strong")?.textContent?.trim()||""
    })),
    budgets:rect($("#budgets")),occasions:rect($("#occasions")),
    trust:rect($("#trust")),edits:rect($(".celebrationEdits")),
    homeMain:rect($(".celebrationHome main")),
    targets:[...document.querySelectorAll(".celebrationHome .celebrationHeroActions a,.celebrationHome .celebrationNav a")].map(el=>({
      label:el.textContent?.trim(),href:el.getAttribute("href"),visible:visible(el),rect:rect(el)
    }))
  }
  return results
})
async function tryScreenshot(page,name,selector){
  try {
    if(selector){
      const loc=page.locator(selector).first()
      if(await loc.count())await loc.screenshot({path:resolve(root,name+".png"),animations:"disabled",timeout:10000})
    } else {
      await page.screenshot({path:resolve(root,name+".png"),fullPage:true,animations:"disabled",timeout:18000})
    }
  }catch(error){warn(name,"Unable to capture screenshot: "+error.message.slice(0,220))}
}
function check(width,d){
  if(d.docWidth>width+3)severe(width,`document horizontally overflows: ${d.docWidth}px vs ${width}px`)
  if(!d.hero || !d.featured || !d.categories || !d.budgets || !d.occasions)
    severe(width,"Critical homepage sections missing from live document")
  if(d.categoryCount!==7)severe(width,`Expected 7 actual category navigation cards, got ${d.categoryCount}`)
  if(d.categoryPhotoCount!==7)warn(width,`Expected 7 current category photos, found ${d.categoryPhotoCount}; inspect fallback/DB`)
  if(d.featuredCount!==4)severe(width,`Expected four real featured SKU cards, got ${d.featuredCount}`)
  if(d.featuredDisplay!=="grid")severe(width,"Featured cards use "+d.featuredDisplay+" instead of approved 2-column grid")
  if(d.featuredCount>=2){
    const [a,b]=d.featuredCards
    if(Math.abs(a.rect.y-b.rect.y)>6)
      severe(width,"First two featured cards are not on the same row")
    if(b.rect.x<=a.rect.x+3)
      severe(width,"Featured cards overlap / are not 2-across")
    if(d.featuredCards.some(x=>x.rect.x< -2||x.rect.right>width+3))
      severe(width,"Featured product card extends outside mobile viewport")
    if(d.featuredCards.some(x=>!x.title||!x.price))
      severe(width,"Featured SKU title or real displayed price is missing")
    if(d.featuredCards.some(x=>x.titleClipped))
      warn(width,"Long featured SKU names are visually clipped; actual product identity must remain readable in 2-column layout")
    if(d.featuredCards.some(x=>!x.image||!x.image.loaded||!x.image.naturalWidth))
      warn(width,"At least one featured photo failed to load in Chromium; inspect screenshot/network")
    if(d.featuredCards.some(x=>x.cartButton && x.cartButton.h<42))
      severe(width,"Featured Add to Cart button touch height under 42px")
  }
  if(d.search && d.search.w>width+3)severe(width,"Mobile search spills past viewport")
  if(d.heroText && d.heroText.right>width+3)warn(width,"Hero title may extend beyond viewport")
  if(d.nav && d.nav.w>width+3)warn(width,"Navigation may extend beyond viewport")
  if(d.header && d.header.w>width+3)severe(width,"Header extends beyond viewport")
  if(d.budgets && d.budgets.w>width+3)severe(width,"Hamper budget section extends beyond viewport")
}
try {
  for(const width of widths){
    const context=await browser.newContext({
      viewport:{width,height:800},deviceScaleFactor:1,
      isMobile:true,hasTouch:true,
      reducedMotion:"reduce",
      locale:"en-IN",
      userAgent:"Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
    })
    const page=await context.newPage()
    const pageErrors=[]
    const badRequests=[]
    page.on("pageerror",error=>pageErrors.push(error.message.slice(0,250)))
    page.on("response",response=>{if(response.status()>=500)badRequests.push({status:response.status(),url:response.url().split("?")[0].slice(0,170)})})
    let status=null
    try{
      const response=await page.goto(base,{waitUntil:"domcontentloaded",timeout:50000})
      status=response?.status()??null
      await page.locator(".celebrationFeatured .catalogCard").first().waitFor({state:"attached",timeout:25000})
      await page.evaluate(()=>document.fonts.ready)
      // Force lazy product and editorial images to load in the browser
      // without clicking any shopping/payment action.
      for(const selector of [".celebrationCategories",".celebrationFeatured","#budgets","#occasions"]){
        if(await page.locator(selector).count()){
          await page.locator(selector).first().scrollIntoViewIfNeeded({timeout:7000})
          await page.waitForTimeout(700)
        }
      }
      await page.evaluate(()=>window.scrollTo(0,0))
      await page.waitForTimeout(900)
      const metrics=await getMetrics(page)
      check(width,metrics)
      await tryScreenshot(page,`home-${width}-full`)
      await tryScreenshot(page,`home-${width}-hero`,".celebrationHero")
      await tryScreenshot(page,`home-${width}-categories`,".celebrationCategories")
      await tryScreenshot(page,`home-${width}-featured`,".celebrationFeatured")
      await tryScreenshot(page,`home-${width}-budget`,"#budgets")
      if(width===390){
        await page.evaluate(()=>window.scrollTo(0,420))
        await page.mouse.wheel(0,320)
        await page.waitForTimeout(850)
        metrics.compactHeader=await page.locator(".celebrationHeader").getAttribute("data-compact-nav")
        await tryScreenshot(page,"home-390-compact-header",".celebrationHeader")
        if(metrics.compactHeader!=="true")
          warn(width,"Mobile header did not reach compact state during simulated Chrome mouse wheel; real touch gesture needs human verification")
        await page.mouse.wheel(0,-350)
        await page.waitForTimeout(450)
        metrics.restoredHeader=await page.locator(".celebrationHeader").getAttribute("data-compact-nav")
        if(metrics.restoredHeader==="true")
          warn(width,"Header did not expand during browser wheel-up; check touch gesture on device")
      }
      report.widths.push({width,status,metrics,pageErrors,badRequests})
      if(status!==200)severe(width,`Homepage HTTP status ${status}`)
      if(pageErrors.length)warn(width,`${pageErrors.length} browser script errors (see JSON report)`)
      if(badRequests.length)warn(width,`${badRequests.length} HTTP 5xx asset/API responses (see report)`)
      console.log(`Mobile ${width}px: HTTP ${status}, page width ${metrics.docWidth}px, ${metrics.categoryCount} categories, ${metrics.featuredCount} featured, grid=${metrics.featuredGrid}, screenshots saved.`)
    }catch(error){
      severe(width,"Unable to fully visit/measure live homepage: "+error.message.slice(0,650))
      report.widths.push({width,status,error:error.message.slice(0,1200),pageErrors,badRequests})
      console.error(`Mobile ${width}px FAILED: ${error.message.slice(0,350)}`)
      await tryScreenshot(page,`home-${width}-failure`)
    }finally {await context.close()}
  }
} finally {
  writeFileSync(resolve(root,"report.json"),JSON.stringify(report,null,2)+"\n")
  await browser.close()
}
console.log(`Phase 1 live-browser results: ${report.widths.length} widths, ${report.errors.length} critical, ${report.warnings.length} warnings`)
if(report.errors.length){
  for(const item of report.errors)console.error(`CRITICAL ${item.width}px: ${item.message}`)
  process.exitCode=1
}
for(const item of report.warnings)console.warn(`WARNING ${item.width}px: ${item.message}`)
