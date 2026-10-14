#!/usr/bin/env node
// Read-only real-browser QA against a disposable local PostgreSQL database.
// Never run against the live store. A dummy signed admin session is created
// only from isolated CI secrets; no production credentials are needed.
import { createHmac } from "node:crypto"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { chromium } from "playwright-core"

const base = (process.env.BASE_URL || "").replace(/\/$/, "")
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error("Browser QA must target an isolated localhost server")
const secret = process.env.ADMIN_SESSION_SECRET
const version = process.env.ADMIN_SESSION_VERSION
if (!secret || secret.length < 32 || !version) throw Error("Isolated admin test secrets missing")
const payload = Buffer.from(JSON.stringify({
  exp: Math.floor(Date.now() / 1000) + 1800, version, method: "password"
})).toString("base64url")
const signature = createHmac("sha256", secret).update(payload).digest("base64url")
const cookie = payload + "." + signature
const output = resolve("artifacts/phase3-self-build")
mkdirSync(output, { recursive: true })
const executablePath = [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find(x => x && existsSync(x))
if (!executablePath) throw Error("Chromium not available")
const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
const checks = []
const add = (name, pass, detail = "") => {
  checks.push({ name, pass: Boolean(pass), detail })
  console.log((pass ? "PASS " : "FAIL ") + name + (detail ? " " + detail : ""))
}
try {
  const visitor = await browser.newContext()
  const publicPage = await visitor.newPage()
  await publicPage.goto(base + "/admin/self-build-preview", { waitUntil: "domcontentloaded" })
  add("Guest cannot see admin preview", await publicPage.locator(".sbPreviewPage").count() === 0)
  const blocked = await publicPage.request.get(base + "/api/admin/self-build")
  add("Guest cannot read admin internal budget API", blocked.status() === 401)
  await visitor.close()

  for (const width of [320, 390, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 820 }, locale: "en-IN", reducedMotion: "reduce" })
    await context.addCookies([{
      name: "celebration_admin", value: cookie, domain: "127.0.0.1", path: "/",
      httpOnly: true, sameSite: "Strict"
    }])
    const writes = [], errors = []
    await context.route("**/api/**", async route => {
      if (["GET", "HEAD"].includes(route.request().method())) return route.continue()
      writes.push(route.request().method() + " " + route.request().url())
      return route.abort("blockedbyclient")
    })
    const page = await context.newPage()
    page.on("pageerror", error => errors.push(error.message))
    try {
      const result = await page.goto(base + "/admin/self-build-preview", { waitUntil: "domcontentloaded", timeout: 55000 })
      await page.locator(".sbPreviewPage").waitFor({ timeout: 20000 })
      add(width + " admin preview HTTP 200", result?.status() === 200)
      const html = await page.content()
      add(width + " no internal private fields in HTML",
        !/(unitBudgetPaise|defaultCatalogItemBudgetPaise|productRules|catalogCategory|salePricePaise)/.test(html))
      add(width + " preview expressly not live", await page.getByText("No orders or payments", { exact: false }).count() >= 1)
      // First screen is names + all-inclusive final prices. A click must
      // advance directly to one continuous list; no category drill-down.
      const tierBar=page.locator('.sbPreviewTierBar[data-tier-id="t1499"]')
      add(width + " tier shows its name and inclusive price",
        (await tierBar.innerText()).includes("1,549") &&
        await tierBar.locator(".sbPreviewTierName").count()===1 &&
        await tierBar.locator(".sbPreviewTierPrice").count()===1)
      add(width + " gifting choices hidden on tier screen",
        await page.locator(".sbChoiceCard:visible").count()===0)
      const tierWidth=await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
      add(width + " tier page no horizontal overflow",
        tierWidth[0] <= tierWidth[1]+2,tierWidth.join("/"))
      await page.screenshot({path:resolve(output,"tier-"+width+".png"),fullPage:true,animations:"disabled"})
      await tierBar.click()
      await page.getByRole("heading",{name:"Choose your gifts"}).waitFor({state:"visible"})
      add(width+" hamper selection skips category overview",
        await page.locator(".sbCategoryStep,.sbCategoryJump").count()===0 &&
        await page.locator(".sbChoiceCard:visible").count()>=14)
      add(width+" Make it personal sidebar removed",
        await page.locator(".sbSummary").count()===0)
      // Teddys is not present in the historical SQL seed; check only if active.
      const teddyPresent=await page.locator(".sbGiftSectionHeading").filter({hasText:/tedd(y|ies)/i}).count()>0
      add(width + " selecting hamper advances to gifts screen",
        await page.locator(".sbChosenTierLine").innerText().then(x=>x.includes("1,549")))
      add(width + " no displayed piece allowance",
        await page.locator(".sbPreviewLimitBar:visible").count()===0 &&
        !(await page.locator(".sbPreviewPage").innerText()).includes("MAXIMUM PIECES"))
      add(width + " all product categories divided into always-open named sections",
        await page.locator(".sbExploreCard:visible,.sbBreadcrumb:visible,select[aria-label*='category']").count()===0 &&
        await page.locator(".sbGiftSection").count()>=4 &&
        await page.locator(".sbChoiceCard:visible").count()>=14)
      for(const group of ["Jewellery","Chocolates","Snacks"]){
        add(width+" inline gift section "+group,
          await page.locator(".sbGiftSectionHeading").getByText(group,{exact:true}).count()===1)
      }
      if(teddyPresent)add(width+" configured Teddy gift section visible",
        await page.locator(".sbGiftSectionHeading").filter({hasText:/tedd(y|ies)/i}).count()>0)
      add(width+" jewellery is present in published section order",
        await page.locator(".sbGiftSectionHeading").getByText("Jewellery",{exact:true}).count()===1)
      add(width+" no redundant standalone Bangles section",
        await page.locator(".sbGiftSectionHeading").getByText("Bangles",{exact:true}).count()===0)
      add(width+" jewellery still includes Korean / Viral Bangles",
        await page.locator(".sbGiftSection").filter({
          has:page.getByRole("heading",{name:"Jewellery",exact:true})
        }).locator(".sbChoiceCard h3").getByText("Korean Bangles",{exact:true}).count()===1)
      const visualLayout=await page.evaluate(()=>{
        const wrapper=document.querySelector(".sbPreviewLayout")
        const groups=[...document.querySelectorAll(".sbGiftSection")]
        const firstLast=groups[0]?.querySelector(".sbChoiceCard:last-child")
        const nextHead=groups[1]?.querySelector(".sbGiftSectionHeading")
        return {
          width:Math.round(wrapper?.getBoundingClientRect().width||99999),
          left:Math.round(wrapper?.getBoundingClientRect().left||-9999),
          right:Math.round(wrapper?.getBoundingClientRect().right||-9999),
          gap:firstLast&&nextHead?Math.round(nextHead.getBoundingClientRect().top-firstLast.getBoundingClientRect().bottom):99999
        }
      })
      add(width+" gift list contained, centered and not full-screen",
        visualLayout.width <= Math.min(width,936)+2 &&
        Math.abs(visualLayout.left-(width-visualLayout.right))<=3,
        JSON.stringify(visualLayout))
      add(width+" category sections closely stacked without empty blocks",
        visualLayout.gap>=0 && visualLayout.gap<=90,JSON.stringify(visualLayout))
      add(width + " no retail product UI",
        await page.locator(".catalogCard,.productCard,.productStep").count()===0)
      for(const label of ["Premium Feature Necklaces","Premium Necklaces","Necklace & Stud Sets",
        "Korean Earrings","Indian Trending Earrings","Minimal Rings","Viral Bangles","Korean Bangles"]){
        add(width+" jewellery gift "+label,
          await page.locator(".sbChoiceCard h3").getByText(label,{exact:true}).count()===1)
      }
      const first=page.locator(".sbChoiceCard").filter({
        has:page.getByRole("heading",{name:"Premium Feature Necklaces",exact:true})
      })
      await first.getByRole("button",{name:/Add one/}).click()
      await first.getByRole("button",{name:/Add one/}).click()
      add(width+" repeated jewellery choice x2",await first.locator("output").innerText()==="2")
      const starter=page.locator(".sbChoiceCard").filter({
        has:page.getByRole("heading",{name:"Starter",exact:true})
      })
      add(width+" chocolate variants visible inline with Snacks and Teddys",await starter.count()===1)
      await starter.getByRole("button",{name:/Add one/}).click()
      const photos=page.locator(".sbChoiceCard").filter({
        has:page.getByRole("heading",{name:"Personalised Photos",exact:true})
      })
      for(let n=0;n<3;n++)await photos.getByRole("button",{name:/Add one/}).click()
      add(width+" three personalised photos",await photos.locator("output").innerText()==="3")
      await page.screenshot({path:resolve(output,"gifts-"+width+".png"),fullPage:true,animations:"disabled"})
      await photos.getByRole("button",{name:/Add one/}).click()
      await photos.getByRole("button",{name:/Add one/}).click()
      add(width+" capacity offers upgrade popup, not numeric max",await page.getByRole("dialog",{
        name:"Choose a larger hamper"
      }).isVisible())
      await page.getByRole("button",{name:"Keep my hamper"}).click()
      await photos.getByRole("button",{name:/Remove one/}).click()
      const initial=await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
      add(width+" gifts page no overflow",initial[0] <= initial[1]+2,initial.join("/"))
      await page.getByRole("button", { name: /Continue to personalise/ }).click()
      add(width + " personalisation step", await page.getByRole("heading", { name: "Add your personal touch" }).count() === 1)
      await page.locator("#sb-custom-note").fill("Please contact us about an additional greeting.")
      await page.getByRole("button", { name: /Review my hamper/ }).click()
      add(width + " review step", await page.getByRole("heading", { name: "Your hamper, at a glance" }).count() === 1)
      add(width + " review contains request note", await page.getByText("Please contact us about an additional greeting.").count() === 1)
      add(width + " review not an order", await page.getByText("No order, quote or payment is created.", { exact: false }).count() >= 1)
      const end = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
      add(width + " review no overflow", end[0] <= end[1] + 2, end.join("/"))
      await page.screenshot({ path: resolve(output, "review-" + width + ".png"), fullPage: true, animations: "disabled" })
      add(width + " no buyer writes", writes.length === 0, JSON.stringify(writes))
      add(width + " no browser errors", errors.length === 0, JSON.stringify(errors))
    } catch (error) {
      add(width + " full scenario", false, String(error?.message || error).slice(0, 1000))
    }
    await context.close()
  }
} finally {
  await browser.close()
  writeFileSync(resolve(output, "report.json"), JSON.stringify({ checks, failures: checks.filter(x => !x.pass) }, null, 2))
}
const failures = checks.filter(x => !x.pass)
console.log("Phase 3 self-build maximalist browser QA: " + checks.length + " checks, " + failures.length + " failures")
if (failures.length) process.exitCode = 1
