#!/usr/bin/env node
/**
 * Explicit opt-in, read-only-to-Celebration Cashfree sandbox smoke check.
 * Creates ONE merchant sandbox gateway order (no payment, capture, refund or
 * Celebration database writes); verifies the Cashfree persisted amount.
 *
 * Run ONLY from the manual, GitHub environment-protected workflow.
 */
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import ts from "typescript"

const require = createRequire(import.meta.url)

async function main() {
  if (process.env.GITHUB_ACTIONS !== "true" ||
      process.env.CASHFREE_SANDBOX_SMOKE_APPROVED !== "true") {
    throw new Error("MANUAL_GITHUB_ACTIONS_SANDBOX_ONLY")
  }
  const appId = process.env.CASHFREE_TEST_APP_ID?.trim()
  const secretKey = process.env.CASHFREE_TEST_SECRET_KEY?.trim()
  if (!appId || !secretKey) throw new Error("CASHFREE_TEST_KEYS_NOT_CONFIGURED")
  const mode = "test"
  const API = "https://sandbox.cashfree.com/pg"
  const publicOrderId = "SB-QA-" + Date.now().toString(36)
  const providerReference = "SBQA_" + Date.now().toString(36) + "_" + randomBytes(4).toString("hex")
  const amountPaise = 49900 + 5000

  // Execute the application's actual checkout provider code, with an isolated
  // sandbox-only configuration. Never load the VPS/production .env or DB.
  const path = new URL("../lib/server/payments/provider.ts", import.meta.url)
  const source = await readFile(path, "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const config = {
    provider: "cashfree", mode,
    appBaseUrl: "https://example.com/celebration-sandbox-only",
    cashfree: {
      appId, secretKey, webhookSecret: "sandbox-smoke-do-not-send-webhooks",
      apiVersion: "2025-01-01"
    }
  }
  const isolatedModule = { exports: {} }
  const isolatedRequire = (name) => {
    if (name === "node:crypto") return require(name)
    if (name === "../../../config/payment-gateway") return {
      paymentGatewayConfig: config, requirePaymentGateway: () => config
    }
    throw new Error("UNEXPECTED_PROVIDER_IMPORT")
  }
  new Function("require", "module", "exports", compiled)(
    isolatedRequire, isolatedModule, isolatedModule.exports
  )
  const { createProviderCheckout, verifyProviderReturn } = isolatedModule.exports

  // Exact frontend self-build example: ₹499 tier + ₹50 separate delivery.
  // A test phone is needed by Cashfree Create Order; no buyer data is used.
  const checkout = await createProviderCheckout({
    publicOrderId,
    providerReference,
    amountPaise,
    customerAccountId: "celebration-sandbox-fixture",
    customerName: "Celebration Test",
    customerPhone: "9999999999"
  })
  assert.equal(checkout.provider, "cashfree")
  assert.equal(checkout.mode, "test")
  assert.equal(checkout.providerOrderId, providerReference)
  assert.equal(checkout.amountPaise, 54900)
  assert.ok(typeof checkout.paymentSessionId === "string" && checkout.paymentSessionId.length > 6,
    "Cashfree did not return a payment session")

  // Independently query Cashfree's canonical order amount. Input echoes from
  // createProviderCheckout alone are NOT sufficient for actual verification.
  const headers = {
    "x-client-id": appId,
    "x-client-secret": secretKey,
    "x-api-version": "2025-01-01",
    "Accept": "application/json"
  }
  const response = await fetch(API + "/orders/" + encodeURIComponent(providerReference), {
    method: "GET", headers, cache: "no-store", signal: AbortSignal.timeout(15000)
  })
  if (!response.ok) throw new Error("CASHFREE_GET_ORDER_HTTP_" + response.status)
  const stored = await response.json()
  assert.equal(stored.order_id, providerReference, "Cashfree returned a different order ID")
  assert.equal(stored.order_currency, "INR")
  assert.equal(stored.order_amount, 549, "Cashfree did not store the ₹50 delivery charge")
  assert.ok(["ACTIVE", "PAID", "EXPIRED", "TERMINATED"].includes(stored.order_status),
    "Unexpected Cashfree order status")
  assert.equal(stored.order_status, "ACTIVE", "Fresh uncharged sandbox order must be ACTIVE")

  // Payment attempts list must initially be empty. This workflow does NOT
  // start a payment, use the checkout session or cause any buyer charge.
  const payment = await verifyProviderReturn({
    provider: "cashfree", providerOrderId: providerReference
  })
  assert.equal(payment.status, "pending", "Fresh sandbox order unexpectedly has a payment")
  assert.equal(payment.amountPaise, null, "Fresh sandbox order has an unexpected payment amount")
  console.log(JSON.stringify({
    result: "CASHFREE_REAL_SANDBOX_ORDER_SMOKE_PASSED",
    provider: "cashfree", environment: "sandbox",
    providerOrderId: providerReference,
    tierAmountRupees: 499, deliveryRupees: 50, storedCashfreeAmountRupees: 549,
    orderStatus: stored.order_status, checkoutSessionPresent: true,
    paymentCaptured: false, productionTouched: false
  }))
}

main().catch(error => {
  // Do not log request headers, credentials, full provider payload or sessions.
  console.error("CASHFREE_SANDBOX_SMOKE_FAILED:", error instanceof Error ? error.message : "Unknown error")
  process.exitCode = 1
})
