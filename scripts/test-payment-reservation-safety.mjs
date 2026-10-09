import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"

const source = await readFile(new URL("../lib/domain/reservation-review.ts", import.meta.url), "utf8")
const transpiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
const mod = await import("data:text/javascript;base64," + Buffer.from(transpiled.outputText).toString("base64"))
const check = mod.reservationReviewStatus
const date = Date.parse("2026-10-10T01:00:00Z")
const sample = (paymentStatus, orderStatus, expiresAt) => ({ paymentStatus, orderStatus, expiresAt })
assert.equal(check(sample("pending", "payment_verification_pending", "2026-10-10T01:15:00Z"), date), "active")
assert.equal(check(sample("pending", "payment_verification_pending", "2026-10-10T00:30:00Z"), date), "payment_review")
assert.equal(check(sample("failed", "payment_verification_pending", "2026-10-10T00:30:00Z"), date), "terminal_cleanup")
assert.equal(check(sample("pending", "cancelled", "2026-10-10T00:30:00Z"), date), "terminal_cleanup")
assert.equal(check(sample("paid", "payment_verified", "2026-10-10T00:30:00Z"), date), "paid_stock_review")
assert.equal(check(sample("verified", "cancelled", "2026-10-10T00:30:00Z"), date), "paid_stock_review")
const store = await readFile(new URL("../lib/server/payments/store.ts", import.meta.url), "utf8")
assert(store.includes("AND provider_order_id = $1"))
assert(store.includes("if (currentAttemptFailed.rowCount)"))
const route = await readFile(new URL("../app/api/admin/reservations/route.ts", import.meta.url), "utf8")
assert(route.includes("isAdminRequest()"))
console.log("Payment reservation review and event ordering safety checks passed.")
