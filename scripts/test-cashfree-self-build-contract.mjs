#!/usr/bin/env node
// Offline gateway contract: real provider module, stubbed HTTP, no credentials or external calls.
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { createRequire } from "node:module"
import { readFile } from "node:fs/promises"
import ts from "typescript"

const require = createRequire(import.meta.url)
const source = await readFile(new URL("../lib/server/payments/provider.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const config = {
  provider: "cashfree", mode: "test", appBaseUrl: "https://sandbox.example.invalid",
  cashfree: {
    appId: "fixture-app-id", secretKey: "fixture-secret", webhookSecret: "fixture-webhook-secret",
    apiVersion: "2025-01-01"
  }
}
const module = { exports: {} }
const localRequire = name => {
  if (name === "node:crypto") return require(name)
  if (name === "../../../config/payment-gateway") return {
    paymentGatewayConfig: config, requirePaymentGateway: () => config
  }
  throw Error("UNEXPECTED_MODULE: " + name)
}
new Function("require", "module", "exports", compiled)(localRequire, module, module.exports)
const { createProviderCheckout, verifyProviderReturn, verifyProviderWebhook } = module.exports

const sourceFetch = globalThis.fetch
const amountPaise = 54900 // ₹499 hamper + ₹50 delivery
const providerOrderId = "cf_self_build_fixture_549"
try {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    return Response.json({ order_id: providerOrderId, payment_session_id: "session_fixture" })
  }
  const checkout = await createProviderCheckout({
    publicOrderId: "SB-FIXTURE", providerReference: providerOrderId, amountPaise,
    customerAccountId: "fixture-customer", customerName: "Fixture Customer",
    customerPhone: "9876543210"
  })
  assert.equal(checkout.provider, "cashfree")
  assert.equal(checkout.mode, "test")
  assert.equal(checkout.amountPaise, 54900)
  assert.equal(checkout.paymentSessionId, "session_fixture")
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "https://sandbox.cashfree.com/pg/orders")
  assert.equal(calls[0].options.method, "POST")
  assert.equal(calls[0].options.headers["x-api-version"], "2025-01-01")
  const payload = JSON.parse(calls[0].options.body)
  assert.equal(payload.order_amount, 549)
  assert.equal(payload.order_currency, "INR")
  assert.equal(payload.order_id, providerOrderId)
  assert.equal(payload.order_meta.return_url,
    "https://sandbox.example.invalid/payment/return?payment={order_id}")
  assert.equal(payload.order_meta.notify_url,
    "https://sandbox.example.invalid/api/payments/webhook/cashfree")

  async function mockStatus(rows) {
    let requested = 0
    globalThis.fetch = async (url) => {
      requested++
      assert.equal(String(url),
        "https://sandbox.cashfree.com/pg/orders/" + providerOrderId + "/payments")
      return Response.json(rows)
    }
    const status = await verifyProviderReturn({ provider: "cashfree", providerOrderId })
    assert.equal(requested, 1)
    return status
  }
  const paid = await mockStatus([
    { cf_payment_id: "cf_failed", payment_status: "FAILED", payment_amount: 549 },
    { cf_payment_id: "cf_success", payment_status: "SUCCESS", payment_amount: 549 }
  ])
  assert.equal(paid.status, "paid")
  assert.equal(paid.providerPaymentId, "cf_success")
  assert.equal(paid.amountPaise, 54900)
  const failed = await mockStatus([
    { cf_payment_id: "cf_failed", payment_status: "FAILED", payment_amount: 549,
      payment_message: "Fixture declined" }
  ])
  assert.equal(failed.status, "failed")
  assert.equal(failed.errorCode, "Fixture declined")
  assert.equal((await mockStatus([{ payment_status: "PENDING", payment_amount: 549 }])).status, "pending")
  const empty = await mockStatus([])
  assert.equal(empty.status, "pending")
  assert.equal(empty.amountPaise, null)

  const raw = JSON.stringify({
    type: "PAYMENT_FAILED_WEBHOOK",
    data: {
      order: { order_id: providerOrderId, order_amount: 549 },
      payment: { cf_payment_id: 2002, payment_status: "FAILED", payment_amount: 549,
        payment_message: "Fixture declined" }
    }
  })
  const timestamp = "1700000000000"
  const signature = createHmac("sha256", config.cashfree.webhookSecret)
    .update(timestamp + raw).digest("base64")
  const headers = new Headers({ "x-webhook-signature": signature, "x-webhook-timestamp": timestamp })
  const first = verifyProviderWebhook("cashfree", raw, headers)
  assert.equal(first.status, "failed")
  assert.equal(first.amountPaise, amountPaise)
  assert.equal(first.eventId, verifyProviderWebhook("cashfree", raw, headers).eventId,
    "Repeated webhooks must use the same event id")
  assert.throws(
    () => verifyProviderWebhook("cashfree", raw.replace("549", "1"), headers),
    /PAYMENT_WEBHOOK_SIGNATURE_INVALID/
  )
  assert.throws(() => verifyProviderWebhook("cashfree", raw, new Headers()),
    /PAYMENT_WEBHOOK_SIGNATURE_INVALID/)
  console.log("CASHFREE_SELF_BUILD_OFFLINE_CONTRACT_PASSED: ₹549; sandbox; success, failure, pending; signatures and replay")
} finally {
  globalThis.fetch = sourceFetch
}
