#!/usr/bin/env node
/**
 * Read-only browser QA on the candidate cleanup build. Captures home, curated
 * hamper, and Self-Build design at phone + desktop sizes. Reject API writes.
 * Screenshots are artifacts for human visual comparison, not a claimed
 * pixel-identical automatic comparison to the live website.
 */
import assert from "node:assert/strict"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { chromium } from "playwright-core"

const base = process.env.BASE_URL || ""
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/, "Browser QA must use local test server only")
const output=path.resolve("artifacts/phase3-cleanup")
mkdirSync(output,{recursive:true})
const executablePath=[process.env.CHROME_BIN,
 "/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"]
 .find(p=>p&&existsSync(p))
if(!executablePath)throw Error("No Chromium installed on CI runner")
const browser=await chromium.launch({
 headless:true,executablePath,args:["--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars"]
})
const report={runAt:new Date().toISOString(),base,checks:[],screenshots:[],warnings:[]}
const check=(name,pass,detail="")=>{
 report.checks.push({name,pass:Boolean(pass),detail})
 console.log((pass?"PASS ":"FAIL ")+name+(detail?" — "+detail:""))
}
const wait=async page=>{
 await page.evaluate(()=>document.fonts.ready)
 await page.waitForTimeout(380)
}
const screenshot=async(page,width,label)=>{
 const file=path.join(output,`${width}-${label}.png`)
 await page.screenshot({path:file,fullPage:true,animations:"disabled",timeout:35000})
 report.screenshots.push(file)
}
const widthState=async page=>page.evaluate(()=>{
 const title=document.querySelector(".celebrationHero h1")
 return {
 viewport:innerWidth,
 docWidth:document.documentElement.scrollWidth,
 bodyWidth:document.body.scrollWidth,
 heroTitleStyle:title?{
  fontStyle:getComputedStyle(title).fontStyle,
  fontFamily:getComputedStyle(title).fontFamily
 }:null
 }
})
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({
    viewport:{width,height:900},
    locale:"en-IN",reducedMotion:"reduce",deviceScaleFactor:1
  })
  const writes=[]
  await context.route("**/api/**",async route=>{
   const method=route.request().method()
   if(method==="GET"||method==="HEAD")return route.continue()
   // The website sends benign storefront-view telemetry on load; prevent
   // the request but do not count it as an attempted order/data mutation.
   // Any other POST/PUT/PATCH/DELETE remains a release-gating failure.
   const endpoint = new URL(route.request().url()).pathname
   if (endpoint !== "/api/analytics/event") writes.push(method+" "+route.request().url())
   return route.abort("blockedbyclient")
  })
  const page=await context.newPage()
  page.on("pageerror",e=>report.warnings.push(`pageerror @${width}: ${e.message.slice(0,220)}`))
  const home=await page.goto(base+"/",{waitUntil:"domcontentloaded",timeout:45000})
  check(`Homepage HTTP 200 @${width}`,home?.status()===200,String(home?.status()))
  await page.locator(".celebrationHero h1").waitFor({timeout:30000})
  await wait(page)
  const homeState=await widthState(page)
  check(`Original premium italic photo hero @${width}`,
   homeState.heroTitleStyle?.fontStyle==="italic" &&
   await page.locator(".celebrationHeroPhoto img").count()===1 &&
   await page.locator(".celebrationHeroActions a").count()===2)
  check(`Four-item home trust strip @${width}`,
   await page.locator(".celebrationBenefits > div").count()===4)
  check(`No severe homepage horizontal overflow @${width}`,
   homeState.docWidth<=width+12,
   `documentWidth=${homeState.docWidth}`)
  await screenshot(page,width,"home")

  const curated=await page.goto(base+"/curated-hampers",{waitUntil:"domcontentloaded",timeout:45000})
  check(`Curated page HTTP 200 @${width}`,curated?.status()===200,String(curated?.status()))
  await page.locator(".curatedBudgetCard").first().waitFor({timeout:20000})
  check(`Curated budget cards @${width}`,await page.locator(".curatedBudgetCard").count()>=3)
  check(`Curated size hidden @${width}`,!/(?:^|\s)Size\s*:/i.test(await page.locator(".curatedBudgetGrid").innerText()))
  await screenshot(page,width,"curated-budget")
  await page.locator(".curatedBudgetCard .curatedPrimary").first().click()
  await page.locator(".curatedOccasionChip").first().waitFor()
  check(`Occasion choices @${width}`,await page.locator(".curatedOccasionChip").count()>=6)
  await screenshot(page,width,"curated-occasion")
  await page.getByRole("button",{name:/Continue to details/i}).click()
  await page.locator(".curatedDetailsScreen").waitFor()
  check(`Curated details and summary @${width}`,
   await page.locator(".curatedOrderSummary").count()===1 &&
   await page.getByRole("button",{name:/Review & Pay/i}).count()===1)
  await screenshot(page,width,"curated-details")

  const sb=await page.goto(base+"/self-build-design",{waitUntil:"domcontentloaded",timeout:45000})
  check(`Self-Build demo HTTP 200 @${width}`,sb?.status()===200,String(sb?.status()))
  await page.locator(".sb3BoxCard").first().waitFor({timeout:20000})
  check(`Four illustrated box choices @${width}`,await page.locator(".sb3BoxCard").count()===4)
  check(`Kappa requires ₹1,000 base hamper tier @${width}`,
   (await page.locator(".sb3BoxCard").first().innerText()).includes("₹1,000"))
  check(`Kappa remains selectable in design preview with qualifying sample tiers @${width}`,
   await page.locator(".sb3Select").first().isEnabled())
  await screenshot(page,width,"self-build-boxes")
  await page.locator(".sb3Select").first().click()
  await page.locator(".sb3Options .sb3Add").first().waitFor()
  const kappaEstimate=(await page.locator(".sb3Total strong").first().innerText()).trim()
  check(`Kappa never prices below ₹1,000 before delivery @${width}`,
   kappaEstimate==="—" || Number(kappaEstimate.replace(/[^\d.]/g,""))>=1050,
   `displayed=${kappaEstimate}`)
  check(`Gift categories navigation @${width}`,await page.locator(".sb3Categories button").count()===6)
  await page.locator(".sb3Options .sb3Add").first().click()
  check(`Selected items summary @${width}`,(await page.locator(".sb3SummarySub").innerText()).includes("1 item"))
  await screenshot(page,width,"self-build-items")
  await page.getByRole("button",{name:/Continue/i}).click()
  await page.locator(".sb3ReviewCard").waitFor()
  check(`Self-Build non-paying review @${width}`,
   await page.locator(".sb3ReviewCard").count()===1 &&
   await page.getByRole("button",{name:/Proceed to Payment/i}).count()===1)
  await screenshot(page,width,"self-build-review")
  check(`No order/account/payment API writes during browser QA @${width}`,writes.length===0,writes.join(", "))
  await context.close()
 }
}finally{
 await browser.close()
 writeFileSync(path.join(output,"report.json"),JSON.stringify(report,null,2))
}
const failed=report.checks.filter(c=>!c.pass)
console.log(JSON.stringify({checks:report.checks.length,failures:failed.length,screenshots:report.screenshots.length,warningCount:report.warnings.length}))
if(failed.length)process.exitCode=1
