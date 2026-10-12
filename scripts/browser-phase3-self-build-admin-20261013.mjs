#!/usr/bin/env node
// Real admin browser + PostgreSQL test. Must run against isolated localhost.
import { createHmac } from "node:crypto"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { chromium } from "playwright-core"

const base = (process.env.BASE_URL || "").replace(/\/$/, "")
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error("Refuse live admin test; localhost required")
const secret = process.env.ADMIN_SESSION_SECRET
const version = process.env.ADMIN_SESSION_VERSION
if (!secret || secret.length < 32 || !version) throw Error("Missing sandbox admin credentials")
const payload = Buffer.from(JSON.stringify({exp: Math.floor(Date.now() / 1000) + 1800, version, method:"passkey"})).toString("base64url")
const value = payload + "." + createHmac("sha256",secret).update(payload).digest("base64url")
const exe = [process.env.CHROME_BIN,"/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium"].find(x => x && existsSync(x))
if (!exe) throw Error("Chromium not found")
const browser = await chromium.launch({headless:true,executablePath:exe,args:["--no-sandbox","--disable-dev-shm-usage"]})
const root = resolve("artifacts/phase3-self-build-admin")
mkdirSync(root,{recursive:true})
const records=[]
const check=(label,ok,extra="") => {records.push({label,ok:!!ok,extra});console.log((ok?"PASS ":"FAIL ")+label+(extra?" "+extra:""))}
try{
  for(const width of [390,1280]){
    const context=await browser.newContext({viewport:{width,height:900},locale:"en-IN",reducedMotion:"reduce"})
    await context.addCookies([{name:"celebration_admin",value,domain:"127.0.0.1",path:"/",sameSite:"Strict",httpOnly:true}])
    const page=await context.newPage()
    const errors=[]
    page.on("pageerror",error=>errors.push(error.message))
    page.on("dialog",dialog=>dialog.accept())
    try{
      const res=await page.goto(base+"/admin",{waitUntil:"domcontentloaded",timeout:45000})
      check(width+" authenticated dashboard",res?.status()===200)
      const debug=await page.evaluate(async()=>({body:document.body.innerText.slice(0,1300),path:location.pathname,api:(await fetch("/api/admin/self-build",{cache:"no-store"})).status}))
      console.log("ADMIN_BROWSER_DIAGNOSTIC "+width+" "+JSON.stringify(debug))
      const nav=page.locator(".adminGroupedNav .adminNavButton").filter({hasText:"Self-Build Categories"})
      if (width < 980) await page.locator("#admin-section").selectOption("self_build")
      else await nav.click()
      await page.locator(".sbAdminRoot .sbAdminStats").waitFor({timeout:20000})
      check(width+" admin section loads",await page.getByRole("heading",{name:"Self-Build Hampers"}).count()===1)
      check(width+" no SKU mapping section",await page.locator(".sbAdminRoot").getByText("No SKU mapping.",{exact:false}).count()>=1)
      check(width+" buyer checkout locked",await page.getByText("Buyer ordering: LOCKED OFF").count()===1)
      check(width+" all eight jewellery choices",await page.locator('.sbAdminChildGrid [data-category-id]').count()>=8)
      check(width+" chocolate option rows",await page.locator('[data-category-id="chocolates"] [data-option-id]').count()===5)
      check(width+" personal photo row",await page.locator('[data-category-id="personalised-photos"]').count()===1)
      check(width+" capacity starts unverified",
        await page.locator('[data-category-id="premium-necklaces"] .sbAdminCapacity input[type=checkbox]').isChecked()===(width === 390 ? false : true))
      const overflow=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth])
      check(width+" no horizontal scroll",overflow[0]<=overflow[1]+2,overflow.join("/"))
      await page.screenshot({path:resolve(root,"admin-"+width+".png"),fullPage:true,animations:"disabled"})

      const category=page.locator('[data-category-id="premium-necklaces"]')
      await category.getByLabel("Visible category label").fill("Premium Necklaces Editorial")
      await category.getByLabel(/Private budget per unit/).fill("65")
      await category.locator(".sbAdminCapacity input[type=checkbox]").check()
      await category.locator(".sbAdminCapacity input[type=number]").fill("9")

      const chocolate=page.locator('[data-option-id="chocolate-extra-100"]')
      await chocolate.getByLabel("Option name").fill("Starter — Petite")
      await chocolate.locator("input[type=number]").first().fill("120")
      await chocolate.locator(".sbAdminCapacity input[type=checkbox]").check()
      await chocolate.locator(".sbAdminCapacity input[type=number]").fill("5")

      const dirty=await page.locator(".sbAdminDirty").count()
      check(width+" drafts remain unpublished",dirty===1)
      await page.locator(".sbAdminHeadingActions .sbAdminPublish").click()
      await page.locator(".sbAdminAlert").waitFor({timeout:15000})
      console.log("ADMIN_SAVE_RESULT "+width+" "+JSON.stringify({notice:await page.locator(".sbAdminAlert").innerText(),error:await page.locator(".sbAdminAlert--error").count()}))
      await page.locator(".sbAdminAlert--good").waitFor({timeout:15000})
      check(width+" save published",await page.getByText(/settings saved as version/).count()===1)
      const live=await page.evaluate(async()=> {
        const r=await fetch("/api/admin/self-build",{cache:"no-store"})
        return {status:r.status,body:await r.json()}
      })
      check(width+" saved data persisted",live.status===200 &&
        live.body.categories.find(c=>c.id==="premium-necklaces")?.label==="Premium Necklaces Editorial" &&
        live.body.categories.find(c=>c.id==="premium-necklaces")?.unitBudgetPaise===6500 &&
        live.body.categories.find(c=>c.id==="premium-necklaces")?.availableUnits===9)
      check(width+" option budget persisted",live.body.options.find(o=>o.id==="chocolate-extra-100")?.unitBudgetPaise===12000
        && live.body.options.find(o=>o.id==="chocolate-extra-100")?.availableUnits===5)
      check(width+" customer lock still off",live.body.config.customerEnabled===false && live.body.config.showItemPrices===false)

      const stale=await page.evaluate(async (body) => {
        const response=await fetch("/api/admin/self-build",{method:"PATCH",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({...body,version:body.version-1})})
        return {status:response.status,data:await response.json()}
      },live.body)
      check(width+" stale writes are rejected",stale.status===409 && stale.data.error==="STALE_SELF_BUILD_CONFIGURATION")
      const leaked=await page.evaluate(async (body) => {
        const r=await fetch("/api/admin/self-build",{method:"PATCH",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({...body,config:{...body.config,customerEnabled:true}})})
        return {status:r.status,data:await r.json()}
      },live.body)
      check(width+" cannot activate buyers in admin",leaked.status===422 && leaked.data.error==="SELF_BUILD_NOT_READY_FOR_CUSTOMERS")
      const fake=await page.evaluate(async (body) => {
        const r=await fetch("/api/admin/self-build",{method:"PATCH",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({...body,productRules:[{productId:"pretend-product"}]})})
        return {status:r.status,data:await r.json()}
      },live.body)
      check(width+" no SKU mapping allowed",fake.status===422 && fake.data.error==="SKU_MAPPING_NOT_SUPPORTED")

      await page.locator('.sbAdminTabs button').filter({hasText:"Global & custom requests"}).click()
      check(width+" prompt editor available",await page.locator(".sbAdminPrompt textarea").count()===1)
      check(width+" quantity policy toggle",await page.getByText("Allow multiple quantities (approved)").count()===1)
      await page.screenshot({path:resolve(root,"admin-global-"+width+".png"),fullPage:true,animations:"disabled"})
      check(width+" no JS page errors",errors.length===0,JSON.stringify(errors))
    }catch(error){
      check(width+" full admin scenario",false,String(error?.message||error).slice(0,700))
    } finally {await context.close()}
  }
}finally{
  await browser.close()
  writeFileSync(resolve(root,"report.json"),JSON.stringify({checks:records,failures:records.filter(x=>!x.ok)},null,2))
}
const bad=records.filter(x=>!x.ok)
console.log("Self-build admin browser/DB QA: "+records.length+" checks, "+bad.length+" failures")
if(bad.length)process.exitCode=1
