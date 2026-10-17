/**
 * Real Chromium geometry and tab smoke test of the REAL V3 React components.
 * The route is generated only inside the disposable GitHub Actions workspace.
 * ALL /api requests are mocked with synthetic data; mutations are prohibited.
 * Does NOT test production authentication or database writes.
 */
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"

const base = process.env.ADMIN_V3_QA_URL || "http://127.0.0.1:3288/__admin_v3_qa_only"
const url = new URL(base)
assert.equal(url.hostname, "127.0.0.1", "Only loopback CI preview URLs are allowed")
assert.equal(url.port, "3288")
assert.equal(url.pathname, "/__admin_v3_qa_only")
await mkdir("artifacts/admin-v3-browser", { recursive: true })

const sampleCatalog = {
  products: [{
    id: "qa-necklace-001", name: "Synthetic QA Necklace", category: "Necklaces",
    minTier: 499, points: 1, note: "Browser-only test product",
    active: true, sellIndividually: true, stockAvailable: 5, salePricePaise: 19900
  }],
  tiers: [{
    id: "t499", price: 499, name: "Synthetic QA Hamper", size: "Small",
    maxChoices: 3, pointBudget: 3, active: true
  }],
  occasions: ["Birthday", "Anniversary"],
  settings: { defaultTierId: "t499", defaultOccasion: "Birthday",
    allCategory: { label: "All Products" } }
}
const settings = {
  whatsapp: "919000000000", assistTitle: "How can we help?", assistBody: "Synthetic support helper",
  supportMessage: "Hello Celebration", legalName: "Synthetic QA Test Entity",
  businessAddress: "Not a real address; browser QA",
  supportEmail: "qa@example.invalid", grievanceOfficerName: "QA Officer",
  grievanceOfficerDesignation: "Grievance Officer", grievanceEmail: "grievance@example.invalid",
  grievancePhone: "919000000000"
}
const funnel = Object.fromEntries(
  ["storefront_view", "budget_selected", "builder_started",
    "checkout_reached", "offer_shown", "payment_started"]
    .map(key => [key, { sessions: 0, events: 0 }])
)
const analytics = {
  days: 30, orders: 0, revenuePaise: 0, subtotalPaise: 0, discountPaise: 0,
  customRequests: 0, offerQuotes: 0, offerRedemptions: 0,
  checkoutRate: 0, orderRate: 0, offerRedemptionRate: 0,
  funnel, campaigns: []
}

const payloadFor = path => {
  if (path === "/api/catalog") return { ok: true, catalog: sampleCatalog }
  if (path === "/api/admin/orders") return { ok: true, orders: [] }
  if (path === "/api/admin/catalog") return {
    ok: true, catalog: sampleCatalog, version: 1, draftExists: false,
    draftUpdatedAt: null
  }
  if (path.startsWith("/api/admin/inventory/adjustments")) return { ok: true, items: [] }
  if (path === "/api/admin/reservations") return {
    ok: true, items: [], active: 0, expiredPending: 0, anomalies: 0, moreResults: false
  }
  if (path === "/api/admin/campaigns") return {
    ok: true, config: { campaigns: [], enabled: true }, version: 1
  }
  if (path === "/api/admin/analytics/v3") return {
    ok: true, analytics: {
      days: 30, overview: analytics,
      checkoutTelemetry: {
        inactivityMinutes: 60, checkoutSessionsInactive: 0,
        checkoutWithoutLaterPaymentStart: 0,
        cartAbandonmentAvailable: false,
        identifiableCheckoutRecoveryAvailable: false
      },
      wishlist: { savedRelationshipsCurrent: 0, accountsWithSavedCurrent: 0,
        currentSavesCreatedInPeriod: 0, topProducts: [] },
      individualProductSales: [], dailyPaidOrders: []
    }
  }
  if (path === "/api/admin/analytics") return { ok: true, analytics }
  if (path === "/api/admin/customers") return {
    ok: true, customers: [], page: 1, pageSize: 25, total: 0
  }
  if (path === "/api/admin/reviews/v3") return {
    ok: true, reviews: [], page: 1, pageSize: 25, matchingCount: 0,
    summary: { total: 0, pending: 0, approved: 0, rejected: 0, approved_average: null }
  }
  if (path === "/api/admin/store-settings/v3") return { ok: true, settings, version: 1 }
  if (path === "/api/admin/security/v3") return {
    ok: true, sessionMethod: "passkey", passkeyCount: 2,
    passwordFallbackAllowed: false, credentialManagementAvailable: false,
    selfServicePasskeyRecoveryAvailable: false
  }
  if (path === "/api/admin/self-build") return { ok: false, error: "SYNTHETIC_QA_NOT_AVAILABLE" }
  if (path === "/api/admin/custom-requests") return { ok: true, requests: [] }
  return { ok: false, error: "SYNTHETIC_QA_MOCK_ONLY" }
}

const sequence = [
  ["overview", "Welcome to your workspace."],
  ["orders", "Orders"],
  ["products", "Products"],
  ["inventory", "Inventory"],
  ["hampers", "Hampers"],
  ["offers", "Offers & Coupons"],
  ["customers", "Customers"],
  ["analytics", "Analytics & Customer Behaviour"],
  ["reviews", "Reviews"],
  ["settings", "Settings & Security"]
]

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
})
const results = []
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 }, deviceScaleFactor: 1
    })
    const page = await context.newPage()
    const errors = []
    const mutations = []
    page.on("pageerror", err => errors.push(err.message))
    await page.route("**/api/**", async route => {
      const req = route.request()
      const target = new URL(req.url())
      if (req.method() !== "GET") {
        mutations.push(req.method() + " " + target.pathname)
        await route.fulfill({
          status: 405, contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "NO_MUTATIONS_IN_QA" })
        })
        return
      }
      const body = payloadFor(target.pathname)
      await route.fulfill({
        status: body.ok ? 200 : 503,
        contentType: "application/json",
        headers: { "Cache-Control": "private, no-store" },
        body: JSON.stringify(body)
      })
    })
    const response = await page.goto(base, { waitUntil: "networkidle", timeout: 60_000 })
    assert(response && response.status() === 200, width + " QA-only route did not load")
    await page.locator(".cav3-root").waitFor({ timeout: 20_000 })
    for (const [id, heading] of sequence) {
      if (id !== "overview") {
        if (width < 1024) {
          const bottom = page.locator(".cav3-bottom-nav")
          await bottom.getByRole("button", { name: "More" }).click()
          await page.locator(".cav3-more").getByRole("button", { name: {
            orders: "Orders", products: "Products", inventory: "Inventory",
            hampers: "Hampers", offers: "Offers & Coupons", customers: "Customers",
            analytics: "Analytics", reviews: "Reviews", settings: "Settings"
          }[id], exact: true }).click()
        } else {
          await page.locator(".cav3-sidebar").getByRole("button", { name: {
            orders: "Orders", products: "Products", inventory: "Inventory",
            hampers: "Hampers", offers: "Offers & Coupons", customers: "Customers",
            analytics: "Analytics", reviews: "Reviews", settings: "Settings"
          }[id], exact: true }).click()
        }
      }
      await page.locator(".cav3-intro h1").filter({ hasText: heading }).waitFor({ timeout: 15_000 })
      await page.waitForTimeout(180)
      const size = await page.evaluate(() => ({
        bodyScroll: document.body.scrollWidth,
        rootScroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        visibleHeading: document.querySelector(".cav3-intro h1")?.textContent
      }))
      results.push({ width, id, ...size })
      assert(
        size.rootScroll <= width + 2,
        `Horizontal page overflow at ${width}px in ${id}: ${size.rootScroll} vs ${width}`
      )
      if ((width === 320 && (id === "overview" || id === "settings" || id === "reviews")) ||
          (width === 1440 && (id === "overview" || id === "products" || id === "analytics"))) {
        await page.screenshot({
          path: `artifacts/admin-v3-browser/${width}-${id}.png`, fullPage: true
        })
      }
    }
    assert.deepEqual(errors, [], width + " browser page errors")
    assert.deepEqual(mutations, [], width + " unexpected admin API mutations")
    await context.close()
  }
  await writeFile("artifacts/admin-v3-browser/report.json", JSON.stringify({
    passed: true, synthetic: true,
    checkedScreens: sequence.length, viewports: [320, 390, 768, 1440], results
  }, null, 2))
  console.log("PASS: Real Chromium Admin V3 navigation and horizontal geometry, 10 screens x 4 widths, no mutation, browser exceptions or production data.")
} finally {
  await browser.close()
}
