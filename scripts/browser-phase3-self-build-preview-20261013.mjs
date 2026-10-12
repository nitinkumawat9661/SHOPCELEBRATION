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
  exp: Math.floor(Date.now() / 1000) + 1800, version, method: "passkey"
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
      add(width + " category-first entry", await page.getByRole("heading", { name: "Choose your categories" }).count() === 1)
      add(width + " no retail product UI", await page.locator(".catalogCard,.productCard,.productStep").count() === 0)
      const initial = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
      add(width + " initial no overflow", initial[0] <= initial[1] + 2, initial.join("/"))
      await page.screenshot({ path: resolve(output, "categories-" + width + ".png"), fullPage: true, animations: "disabled" })

      // Nested category navigation must show owner-confirmed eight groups, no SKUs.
      await page.locator(".sbExploreCard").filter({ hasText: "Jewellery" }).click()
      add(width + " eight jewellery category choices", await page.locator(".sbChoiceCard").count() === 8)
      for (const label of ["Premium Feature Necklaces", "Premium Necklaces", "Necklace & Stud Sets",
        "Korean Earrings", "Indian Trending Earrings", "Minimal Rings", "Viral Bangles", "Korean Bangles"]) {
        add(width + " label " + label, await page.locator(".sbChoiceCard h3").getByText(label, { exact: true }).count() === 1)
      }
      const firstCard = page.locator(".sbChoiceCard").first()
      await firstCard.getByRole("button", { name: /Add one/ }).click()
      await firstCard.getByRole("button", { name: /Add one/ }).click()
      add(width + " multi-quantity jewellery ×2", await firstCard.locator("output").innerText() === "2")
      await page.screenshot({ path: resolve(output, "jewellery-" + width + ".png"), fullPage: true, animations: "disabled" })
      await page.locator(".sbBreadcrumb button").click()

      // Chocolates are DB option labels, not a synthetic catalogue product wall.
      await page.locator(".sbExploreCard").filter({ hasText: "Chocolates" }).click()
      add(width + " Chocolate Starter + four sizes", await page.locator(".sbChoiceCard").count() === 5)
      add(width + " Starter label", await page.locator(".sbChoiceCard h3").getByText("Starter", { exact: true }).count() === 1)
      await page.locator(".sbChoiceCard").filter({ hasText: "Starter" }).getByRole("button", { name: /Add one/ }).click()
      await page.locator(".sbBreadcrumb button").click()

      // Photo amount is private; buyer preview only chooses a photo count.
      const photos = page.locator(".sbChoiceCard").filter({ hasText: "Personalised Photos" })
      await photos.getByRole("button", { name: /Add one/ }).click()
      await photos.getByRole("button", { name: /Add one/ }).click()
      await photos.getByRole("button", { name: /Add one/ }).click()
      add(width + " three personalised photos", await photos.locator("output").innerText() === "3")
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
console.log("Phase 3 self-build minimalist browser QA: " + checks.length + " checks, " + failures.length + " failures")
if (failures.length) process.exitCode = 1
