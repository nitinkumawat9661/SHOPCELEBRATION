#!/usr/bin/env node
/**
 * Phase 1 desktop review of the REAL live Celebration homepage.
 * Screenshots and layout measurements; no cart, payment or stock mutations.
 * Screenshots still require human evaluation for image aesthetics.
 */
import { chromium } from "playwright-core"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root=resolve(process.cwd(),"artifacts/phase1-home-desktop")
mkdirSync(root,{recursive:true})
const base=process.env.BASE_URL||"https://shopcelebration.in/"
const widths=[1024,1280,1440,1920]
const path=[
  process.env.CHROME_BIN,"/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable","/usr/bin/chromium","/snap/bin/chromium"
].find(p=>p&&existsSync(p))
if(!path)throw Error("No Chromium installation on runner")
const browser=await chromium.launch({headless:true,executablePath:path,args:["--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars"]})
const report={
  version:"Phase 1 original competitor desktop design QA",
  testedAt:new Date().toISOString(),
  website:base, widths:[],errors:[],warnings:[],
  note:"Live Chromium layout and screenshots only; not final human visual signoff or proof of SKU image identity. Category images are not changed."
}
const severe=(width,message)=>report.errors.push({width,message})
const warning=(width,message)=>report.warnings.push({width,message})
const measured=page=>page.evaluate(()=>{
 const $=(s)=>document.querySelector(s)
 const $$=(s)=>[...document.querySelectorAll(s)]
 const box=(el)=>{if(!el)return null;const r=el.getBoundingClientRect();return{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),right:Math.round(r.right),bottom:Math.round(r.bottom)}}
 const visible=el=>{if(!el)return false;const s=getComputedStyle(el);return s.display!=="none"&&s.visibility!=="hidden"&&el.getBoundingClientRect().width>0}
 const featured=$$(".celebrationFeatured .collectionGrid>.catalogCard")
 const categories=$$(".celebrationCategories .celebrationCategory")
 const nav=$$(".celebrationHeader .celebrationNav a")
 const heroButtons=$$(".celebrationHeroActions a")
 const sectionSelectors=[
   ".celebrationHero",".celebrationBenefits",".celebrationCategories",".celebrationFeatured",
   ".celebrationEdits","#budgets","#occasions","#trust"
 ]
 const sections=Object.fromEntries(sectionSelectors.map(selector=>[selector,box($(selector))]))
 return{
   innerWidth, documentWidth:document.documentElement.scrollWidth,
   bodyWidth:document.body.scrollWidth, docHeight:document.documentElement.scrollHeight,
   sections,
   header:box($(".celebrationHeader")),
   headerTop:box($(".celebrationHeaderTop")),
   logo:box($(".celebrationBrand")),
   search:box($(".celebrationSearch")),
   headerActions:box($(".celebrationHeaderActions")),
   nav:box($(".celebrationHeader .celebrationNav")),
   navLinks:nav.map(el=>({text:el.textContent?.trim(),href:el.getAttribute("href"),rect:box(el),visible:visible(el)})),
   heroTitle:box($(".celebrationHero h1")),
   // Font ascenders/descenders can exceed a tight CSS line-height without
   // being cropped when overflow is visible. Flag only true clipping.
   heroTitleClipped:(()=>{
     const el=$(".celebrationHero h1")
     if(!el)return null
     const st=getComputedStyle(el)
     const clippedX=["clip","hidden"].includes(st.overflowX)&&el.scrollWidth>el.clientWidth+3
     const clippedY=["clip","hidden"].includes(st.overflowY)&&el.scrollHeight>el.clientHeight+3
     return clippedX||clippedY
   })(),
   heroCTAs:heroButtons.map(el=>({text:el.textContent?.trim(),href:el.getAttribute("href"),rect:box(el),visible:visible(el)})),
   categoryCount:categories.length,
   categoryMedia:categories.filter(el=>!!el.querySelector(".celebrationCategoryEditorialPhoto img")).length,
   categoryRail:{rect:box($(".celebrationCategoryRail")),scrollWidth:$(".celebrationCategoryRail")?.scrollWidth,clientWidth:$(".celebrationCategoryRail")?.clientWidth},
   categories:categories.map(el=>({name:el.querySelector("b")?.textContent?.trim(),href:el.getAttribute("href"),rect:box(el)})),
   featuredCount:featured.length,
   featuredCss:(()=>{const el=$(".celebrationFeatured .collectionGrid");const s=getComputedStyle(el||document.body);return{display:s.display,gridColumns:s.gridTemplateColumns,overflow:s.overflowX}})(),
   featuredCards:featured.map(el=>{
     const img=el.querySelector(".catalogCardVisual img")
     const title=el.querySelector("h3")
     return{
       rect:box(el), title:title?.textContent?.trim()||"",
       titleClipped:!!title&&(title.scrollWidth>title.clientWidth+2||title.scrollHeight>title.clientHeight+2),
       price:el.querySelector(".catalogCardPrice strong")?.textContent?.trim()||"",
       img:img?{naturalWidth:img.naturalWidth,complete:img.complete,currentSrc:img.currentSrc.split("?")[0].slice(-140)}:null,
       addButton:box(el.querySelector(".cartAddControl button"))
     }
   }),
   edits:$$(".celebrationEdits .celebrationEdit").map(el=>({rect:box(el),href:el.getAttribute("href")})),
   bodyScrollbar:getComputedStyle(document.body).overflowX,
   compactHeader:$(".celebrationHeader")?.getAttribute("data-compact-nav")
 }
})
const screenshot=async(page,width,label,selector)=>{
 try{
   const file=resolve(root,"desktop-"+width+"-"+label+".png")
   if(selector){
     const locator=page.locator(selector).first()
     if(await locator.count())await locator.screenshot({path:file,animations:"disabled",timeout:16000})
   }else await page.screenshot({path:file,fullPage:true,animations:"disabled",timeout:22000})
 }catch(e){warning(width,"Screenshot "+label+" failed: "+e.message.slice(0,180))}
}
function check(width,d){
 if(d.documentWidth>width+3)severe(width,"Horizontal document overflow "+d.documentWidth+"px > "+width+"px")
 for(const sel of [".celebrationHero",".celebrationBenefits",".celebrationCategories",".celebrationFeatured",".celebrationEdits","#budgets","#occasions","#trust"])
   if(!d.sections[sel])severe(width,"Missing essential desktop section: "+sel)
 if(!d.header||!d.logo||!d.search||!d.headerActions||!d.nav)
   severe(width,"Header missing logo, search, actions or nav")
 if(d.navLinks.length!==6||d.navLinks.some(x=>!x.visible))
   severe(width,"All six desktop navigation links must be visible")
 if(d.navLinks.some(x=>x.rect.x< -2||x.rect.right>width+3))
   severe(width,"Desktop navigation links overflow viewport")
 if(d.logo&&d.search&&d.logo.right>d.search.x+5)
   severe(width,"Logo overlaps search field")
 if(d.search&&d.headerActions&&d.search.right>d.headerActions.x+5)
   severe(width,"Search field overlaps account/cart actions")
 if(d.heroCTAs.length<2||d.heroCTAs.some(x=>!x.visible||x.rect.h<40))
   severe(width,"Jewellery and hamper hero buttons must be visible and clickable")
 if(d.heroTitleClipped)warning(width,"Hero title may be clipped")
 if(d.categoryCount!==7||d.categoryMedia!==7)
   severe(width,"Expected seven original category cards and original photographs, got "+d.categoryCount+"/"+d.categoryMedia)
 if(d.featuredCount!==4||d.featuredCss.display!=="grid")
   severe(width,"Original four-product desktop grid missing")
 if(d.featuredCount===4){
   const ys=d.featuredCards.map(x=>x.rect.y)
   if(Math.max(...ys)-Math.min(...ys)>6)
     severe(width,"Featured grid is not four columns on one desktop row")
   for(const [i,c] of d.featuredCards.entries()){
     if(c.rect.x< -2||c.rect.right>width+3)
       severe(width,"Featured product "+i+" overflows desktop viewport")
     if(!c.title||!c.price)severe(width,"Featured SKU title or price missing")
     if(c.titleClipped)warning(width,"Featured SKU product name clipped: "+c.title.slice(0,50))
     if(!c.img||!c.img.complete||c.img.naturalWidth<1)
       warning(width,"Featured SKU image failed browser load: "+c.title.slice(0,50))
     if(c.addButton&&c.addButton.h<40)warning(width,"Add-to-cart touch target small: "+c.addButton.h)
   }
 }
 if(d.edits.length!==2)warning(width,"Expected two jewellery/hamper editorial links")
 if(d.compactHeader==="true")severe(width,"Desktop should never be compact-header mode")
}
try{
 for(const width of widths){
   const ctx=await browser.newContext({
     viewport:{width,height:900},deviceScaleFactor:1,
     isMobile:false,hasTouch:false,reducedMotion:"reduce",locale:"en-IN"
   })
   const page=await ctx.newPage()
   const pageErrors=[],serverErrors=[]
   page.on("pageerror",e=>pageErrors.push(e.message.slice(0,220)))
   page.on("response",res=>{if(res.status()>=500)serverErrors.push({code:res.status(),url:res.url().split("?")[0].slice(0,140)})})
   let status=null
   try{
     const res=await page.goto(base,{waitUntil:"domcontentloaded",timeout:55000})
     status=res?.status()??null
     await page.locator(".celebrationFeatured .catalogCard").first().waitFor({state:"attached",timeout:23000})
     await page.evaluate(()=>document.fonts.ready)
     for(const selector of [".celebrationCategories",".celebrationFeatured",".celebrationEdits","#budgets","#occasions","#trust"]){
       if(await page.locator(selector).count()){
         await page.locator(selector).first().scrollIntoViewIfNeeded({timeout:6500})
         await page.waitForTimeout(550)
       }
     }
     await page.evaluate(()=>window.scrollTo(0,0))
     await page.waitForTimeout(600)
     const metrics=await measured(page)
     check(width,metrics)
     await screenshot(page,width,"full")
     for(const [key,sel] of Object.entries({
       header:".celebrationHeader",hero:".celebrationHero",
       categories:".celebrationCategories",featured:".celebrationFeatured",
       edits:".celebrationEdits",budgets:"#budgets",occasions:"#occasions"
     }))await screenshot(page,width,key,sel)
     // Make sure the desktop header doesn't become compact on scroll.
     await page.mouse.wheel(0,700)
     await page.waitForTimeout(150)
     const afterScroll=await page.locator(".celebrationHeader").getAttribute("data-compact-nav")
     if(afterScroll==="true")severe(width,"Desktop scroll mistakenly compacted navigation")
     if(status!==200)severe(width,"Homepage HTTP status "+status)
     if(pageErrors.length)warning(width,pageErrors.length+" page JavaScript exceptions")
     if(serverErrors.length)warning(width,serverErrors.length+" HTTP 5xx asset/API errors")
     report.widths.push({width,status,metrics,pageErrors,serverErrors})
     console.log("Desktop "+width+"px: HTTP "+status+", page="+metrics.documentWidth+"px, 7 categories="+metrics.categoryCount+", featured="+metrics.featuredCount+", 4-col="+metrics.featuredCss.gridColumns+", screenshots saved.")
   }catch(error){
     severe(width,"Cannot verify live desktop homepage: "+error.message.slice(0,490))
     report.widths.push({width,status,error:error.message.slice(0,900),pageErrors,serverErrors})
     console.error("Desktop "+width+"px: "+error.message.slice(0,200))
     await screenshot(page,width,"failure")
   }finally{await ctx.close()}
 }
}finally{
 writeFileSync(resolve(root,"report.json"),JSON.stringify(report,null,2)+"\n")
 await browser.close()
}
console.log("Phase 1 desktop live-browser QA: "+report.widths.length+" widths, "+report.errors.length+" critical, "+report.warnings.length+" warnings")
for(const item of report.errors)console.error("CRITICAL "+item.width+": "+item.message)
for(const item of report.warnings)console.warn("WARNING "+item.width+": "+item.message)
if(report.errors.length)process.exitCode=1
