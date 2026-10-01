import assert from "node:assert/strict"
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const root = process.cwd()
const out = join(root, ".order-presentation-test")
assert.equal(dirname(out), root)
await mkdir(out, { recursive: true })
try {
  await cp(join(root, "config"), join(out, "config"), { recursive: true })
  await cp(join(root, "content"), join(out, "content"), { recursive: true })
  const sources = ["features/admin/AdminOrderCard.tsx", "features/admin/AdminOrderVideo.tsx", "features/admin/AdminShippingPanel.tsx", "features/tracking/PackingApprovalCard.tsx", "lib/domain/catalog.ts", "lib/domain/money.ts", "lib/domain/payment.ts", "lib/domain/order-status.ts", "lib/domain/content.ts", "lib/domain/storage.ts", "config/routes.ts", "config/payment.ts", "config/validation.ts", "config/storage.ts"]
  for (const source of sources) {
    const output = ts.transpileModule(await readFile(join(root, source), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
    const target = join(out, source.replace(/\.tsx?$/, ".js"))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, output.outputText)
  }
const require = createRequire(import.meta.url)
const { AdminOrderCard } = require(join(out, "features/admin/AdminOrderCard.js"))
const order = {
  publicId: "TEST-ITEM-1", orderType: "individual", lineItems: [{ productId: "test-item", name: "Test Bracelet", quantity: 2, unitPricePaise: 1234, lineTotalPaise: 2468 }],
  subtotalPaise: 2468, discountPaise: 0, amountPaise: 2468, campaignId: null, campaignTitle: null, tierName: "Individual purchase", requiredDate: "2026-10-10", occasion: "Individual purchase",
  status: "payment_verified", paymentStatus: "verified", paymentReference: "TEST-REF", customerName: "Test Customer", phone: "9876543210", receiverName: "Test Receiver", address: "Test address", city: "Test City", state: "Test State", pincode: "332001", message: "",
  selectedProductIds: ["test-item"], selectedProductNames: ["Test Bracelet × 2"], packingVideoKey: null, shippingProvider: null, shippingTrackingNumber: null, issueType: null, issueNote: null, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z"
}
const render = (value) => renderToStaticMarkup(createElement(AdminOrderCard, { order: value, busy: false, onStatus() {}, onShipping() {}, onVideo() {} }))
const individual = render(order)
assert(individual.includes('aria-label="Purchased items"') && individual.includes("Test Bracelet"), "Individual purchased-item snapshot is missing")
assert(individual.includes("2 × ₹12.34 each") && individual.includes("₹24.68"), "Quantity, unit price and line total must preserve paise")
assert(!individual.includes("Hamper preparation"), "Individual fulfillment must use order wording")
const hamper = render({ ...order, orderType: "hamper", lineItems: [], tierName: "Test Hamper" })
assert(hamper.includes("Test Hamper") && !hamper.includes('aria-label="Purchased items"'), "Hamper presentation must remain separate")
const { PackingApprovalCard } = require(join(out, "features/tracking/PackingApprovalCard.js"))
const approval = renderToStaticMarkup(createElement(PackingApprovalCard, { isIndividual: true, status: "packing_video_ready", packingVideoUrl: "/test-video", approving: false, approvedAt: null, async onApprove() {} }))
assert(approval.includes("approve this order for dispatch") && approval.includes('disabled=""'), "Individual packing approval must retain explicit consent before dispatch")
console.log("Order presentation checks passed: snapshots, exact prices, hamper compatibility and packing consent.")
} finally {
  await rm(out, { recursive: true, force: true })
}
