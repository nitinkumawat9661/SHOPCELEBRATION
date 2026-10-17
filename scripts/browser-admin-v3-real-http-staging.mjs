/**
 * Authenticated REAL Next HTTP + disposable Postgres V3 integration smoke.
 * This uses a virtual WebAuthn authenticator and only ephemeral CI credentials.
 * No external payment, courier, messaging, image storage or production access.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"

assert.equal(process.env.GITHUB_ACTIONS, "true")
assert.equal(process.env.ADMIN_V3_STAGING, "ephemeral-ci")
assert.equal(process.env.NEXT_PUBLIC_SITE_INDEXABLE, "false")
assert.equal(process.env.APP_BASE_URL, "http://localhost:3288")
const password = process.env.ADMIN_V3_TEST_PASSWORD
assert(password && password.length >= 24, "Randomized staging-only bootstrap password required")
const base = "http://localhost:3288"
const screenshots = "artifacts/admin-v3-real-http"
await mkdir(screenshots, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
})
let step = "initial"
const completed = []
async function response(request, label, expected = 200) {
  assert.equal(request.status(), expected, `${label}: HTTP ${request.status()} (expected ${expected})`)
  const body = await request.json()
  completed.push(label)
  return body
}
async function jsonReq(context, path, options = {}) {
  return context.request.fetch(base + path, options)
}
const context = await browser.newContext({viewport: {width:390,height:850}})
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
try {
  await cdp.send("WebAuthn.enable")
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2", transport: "internal", hasResidentKey: true,
      hasUserVerification: true, isUserVerified: true,
      automaticPresenceSimulation: true
    }
  })
  step = "anonymous"
  const anonymous = await browser.newContext()
  try {
    for (const path of [
      "/api/admin/inventory/adjustments",
      "/api/admin/store-settings/v3",
      "/api/admin/security/v3",
      "/api/admin/customers",
      "/api/admin/reviews/v3"
    ]) {
      const denied = await jsonReq(anonymous, path)
      assert.equal(denied.status(), 401, `Anonymous access must be rejected for ${path}`)
    }
    completed.push("anonymous private endpoints reject unauthenticated requests")
  } finally { await anonymous.close() }

  step = "bootstrap-password"
  const initial = await page.goto(base + "/admin/v3", {waitUntil:"domcontentloaded",timeout:60000})
  assert.equal(initial.status(), 200)
  await page.locator("input[type=password]").waitFor({timeout:30000})
  await page.locator("input[type=password]").fill(password)
  await page.getByRole("button", { name: "Continue to passkey setup" }).click()
  await page.getByRole("button", { name: "Create phone passkey" }).waitFor({timeout:30000})
  completed.push("staging-only bootstrap password login")

  step = "passkey-registration"
  await page.getByRole("button", { name: "Create phone passkey" }).click()
  await page.locator(".cav3-root").waitFor({timeout:45000})
  const credentials = await cdp.send("WebAuthn.getCredentials", {authenticatorId})
  assert.equal(credentials.credentials.length, 1, "Virtual passkey enrollment must persist exactly one credential")
  completed.push("real WebAuthn registration and passkey-authenticated admin view")

  step = "post-enrollment-guards"
  const fallback = await jsonReq(context,"/api/admin/login",{
    method:"POST",headers:{"Origin":base},
    data:{password}
  })
  assert.equal(fallback.status(),409, "Password fallback prohibited after passkey enrollment")
  const security = await response(await jsonReq(context,"/api/admin/security/v3"),"authenticated security metadata")
  assert.equal(security.sessionMethod, "passkey")
  assert.equal(security.passkeyCount, 1)
  assert.equal(security.passwordFallbackAllowed, false)
  assert.equal(security.credentialManagementAvailable, false)
  assert(!JSON.stringify(security).includes("publicKey"), "No WebAuthn public key in status endpoint")
  completed.push("password fallback disabled after WebAuthn")

  step = "same-origin-and-settings-CAS"
  const initialSettings = await response(
    await jsonReq(context,"/api/admin/store-settings/v3"),"read staging settings"
  )
  assert(Number.isInteger(initialSettings.version))
  const withoutOrigin = await jsonReq(context,"/api/admin/store-settings/v3",{
    method:"PATCH",data:{settings:initialSettings.settings, expectedVersion:initialSettings.version}
  })
  assert.equal(withoutOrigin.status(),403, "Missing Origin must reject mutations")
  const foreignOrigin = await jsonReq(context,"/api/admin/store-settings/v3",{
    method:"PATCH",headers:{"Origin":"https://evil.invalid"},
    data:{settings:initialSettings.settings, expectedVersion:initialSettings.version}
  })
  assert.equal(foreignOrigin.status(),403, "Cross-origin mutation must be rejected")
  const changed = {...initialSettings.settings, assistTitle:"QA isolated stage"}
  const saved = await response(await jsonReq(context,"/api/admin/store-settings/v3",{
    method:"PATCH",headers:{"Origin":base},
    data:{settings:changed,expectedVersion:initialSettings.version}
  }),"settings versioned HTTP write")
  assert.equal(saved.version,initialSettings.version+1)
  const stale = await jsonReq(context,"/api/admin/store-settings/v3",{
    method:"PATCH",headers:{"Origin":base},
    data:{settings:initialSettings.settings,expectedVersion:initialSettings.version}
  })
  assert.equal(stale.status(),409)
  completed.push("same-origin CSRF blocks and concurrent settings write conflict")

  step = "inventory-idempotency"
  const requestId=randomUUID()
  const payload={
    requestId,productId:"staging-qa-necklace-001",mode:"add",
    quantity:2,expectedAvailable:5,reason:"Synthetic QA restock only"
  }
  const stock = await response(await jsonReq(context,"/api/admin/inventory/adjustments",{
    method:"POST",headers:{"Origin":base},data:payload
  }),"inventory API write")
  assert.equal(stock.adjustment.availableQuantity,7)
  const duplicate=await response(await jsonReq(context,"/api/admin/inventory/adjustments",{
    method:"POST",headers:{"Origin":base},data:payload
  }),"inventory idempotent replay")
  assert.equal(duplicate.adjustment.replayed,true)
  const conflicting=await jsonReq(context,"/api/admin/inventory/adjustments",{
    method:"POST",headers:{"Origin":base},
    data:{...payload,requestId:randomUUID()}
  })
  assert.equal(conflicting.status(),409)
  const history = await response(await jsonReq(context,
    "/api/admin/inventory/adjustments?productId=staging-qa-necklace-001"),
    "inventory audit history")
  assert.equal(history.items.length,1)
  completed.push("real HTTP inventory CAS, duplicate suppression and audit history")

  step = "authenticated-data-reads"
  const customers = await response(await jsonReq(context,"/api/admin/customers"),
    "staging customer directory")
  assert.equal(customers.total,0)
  const reviews = await response(await jsonReq(context,"/api/admin/reviews/v3"),
    "staging moderation queue")
  assert.equal(reviews.summary.total,0)
  const analytics = await response(await jsonReq(context,"/api/admin/analytics/v3?days=7"),
    "staging behaviour analytics")
  assert.equal(analytics.analytics.checkoutTelemetry.identifiableCheckoutRecoveryAvailable,false)
  completed.push("real authenticated customers, reviews and analytics queries (empty fixtures)")

  step = "passkey-relogin"
  await context.clearCookies()
  await page.reload({waitUntil:"domcontentloaded"})
  await page.getByRole("button",{name:"Use phone passkey"}).waitFor({timeout:30000})
  await page.getByRole("button",{name:"Use phone passkey"}).click()
  await page.locator(".cav3-root").waitFor({timeout:45000})
  completed.push("real passkey reauthentication after session cookie removal")

  step = "responsive-navigation"
  const sequence=[
    ["overview","Welcome to your workspace."],
    ["orders","Orders"],
    ["products","Products"],
    ["inventory","Inventory"],
    ["hampers","Hampers"],
    ["offers","Offers & Coupons"],
    ["customers","Customers"],
    ["analytics","Analytics & Customer Behaviour"],
    ["reviews","Reviews"],
    ["settings","Settings & Security"]
  ]
  for (const width of [390,1440]) {
    await page.setViewportSize({width,height:850})
    for(const [id,heading] of sequence) {
      if(id!=="overview"){
        const label={orders:"Orders",products:"Products",inventory:width<1024?"Stock":"Inventory",
          hampers:"Hampers",offers:"Offers & Coupons",customers:"Customers",
          analytics:"Analytics",reviews:"Reviews",settings:"Settings"}[id]
        if(width<1024){
          if(["orders","products","inventory"].includes(id)) {
            await page.locator(".cav3-bottom-nav").getByRole("button",{name:label,exact:true}).click()
          } else {
            await page.locator(".cav3-bottom-nav").getByRole("button",{name:"More"}).click()
            await page.locator(".cav3-more").getByRole("button",{name:label,exact:true}).click()
          }
        } else {
          await page.locator(".cav3-sidebar").getByRole("button",{name:label,exact:true}).click()
        }
      } else {
        // Back to overview for each new viewport, without relying on a stale active tab.
        if(width===1440) await page.locator(".cav3-sidebar").getByRole("button",{name:"Overview",exact:true}).click()
      }
      await page.locator(".cav3-intro h1").filter({hasText:heading}).waitFor({timeout:20000})
      const geometry=await page.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth}))
      assert(geometry.body<=width+2,`Overflow: ${id} at ${width}px`)
      if((width===390 && id==="settings")||(width===1440 && id==="overview")) {
        await page.screenshot({path:`${screenshots}/${width}-${id}.png`,fullPage:true})
      }
    }
    completed.push(`authenticated real HTTP navigation 10 screens at ${width}px`)
  }

  await writeFile(`${screenshots}/report.json`,JSON.stringify({
    passed:true,environment:"ephemeral-github-hosted-ci",
    realHttp:true,realDisposablePostgres:true,virtualWebAuthn:true,
    realPayments:false,realCourier:false,productionTouched:false,completed
  },null,2))
  console.log("PASS: Admin V3 real HTTP + disposable DB + virtual passkey CI checks. Not a persistent VPS staging deployment.")
} catch (error) {
  console.error(`FAIL: Admin V3 ephemeral real HTTP checkpoint: ${step}: ${error.message}`)
  throw error
} finally {
  await context.close()
  await browser.close()
}
