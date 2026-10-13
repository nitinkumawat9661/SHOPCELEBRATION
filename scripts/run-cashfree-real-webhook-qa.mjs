#!/usr/bin/env node
/**
 * Disposable REAL Cashfree SANDBOX webhook-delivery QA.
 *
 * A temporary Cloudflare Quick Tunnel connects to this isolated local server.
 * The server creates only Cashfree SANDBOX orders; it never reads or mutates
 * Celebration Postgres/R2/VPS/customer data or production payment settings.
 * This process does NOT run in the production app.
 */
import assert from "node:assert/strict"
import { createHmac, randomBytes } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import http from "node:http"
import ts from "typescript"

const require = createRequire(import.meta.url)
const API = "https://sandbox.cashfree.com/pg"
const AMOUNT_PAISE = 54900
const PORT = 33777
const MAX_WEBHOOK_BYTES = 64 * 1024
const MAX_TEST_MS = 15 * 60 * 1000

function actualCashfreeVerifier(secret) {
  const sourcePromise = readFile(new URL("../lib/server/payments/provider.ts", import.meta.url), "utf8")
  return sourcePromise.then(source => {
    const commonjs = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText
    const fixture = {
      provider: "cashfree", mode: "test", appBaseUrl: "https://example.invalid",
      cashfree: { appId: "sandbox", secretKey: secret, webhookSecret: secret, apiVersion: "2025-01-01" }
    }
    const isolated = { exports: {} }
    new Function("require", "module", "exports", commonjs)((name) => {
      if (name === "node:crypto") return require(name)
      if (name === "../../../config/payment-gateway") return {
        paymentGatewayConfig: fixture, requirePaymentGateway: () => fixture
      }
      throw Error("UNEXPECTED_IMPORT")
    }, isolated, isolated.exports)
    return isolated.exports.verifyProviderWebhook
  })
}
async function testVerifier() {
  const secret = "CI-only-test-secret"
  const verify = await actualCashfreeVerifier(secret)
  const raw = JSON.stringify({
    type: "PAYMENT_SUCCESS_WEBHOOK",
    data: {
      order: { order_id: "SBQA_local_verify", order_amount: 549 },
      payment: { cf_payment_id: "123", payment_amount: 549, payment_status: "SUCCESS" }
    }
  })
  const stamp = String(Date.now())
  const signature = createHmac("sha256", secret).update(stamp + raw).digest("base64")
  const headers = new Headers({ "x-webhook-timestamp": stamp, "x-webhook-signature": signature })
  assert.equal(verify("cashfree", raw, headers).amountPaise, AMOUNT_PAISE)
  assert.throws(() => verify("cashfree", raw.replace("549", "1"), headers),
    /PAYMENT_WEBHOOK_SIGNATURE_INVALID/)
  assert.throws(() => verify("cashfree", raw, new Headers()),
    /PAYMENT_WEBHOOK_SIGNATURE_INVALID/)
  console.log("CASHFREE_REAL_WEBHOOK_RECEIVER_LOCAL_CONTRACT_PASSED")
}
if (process.argv.includes("--self-test")) {
  await testVerifier()
  process.exit(0)
}

if (process.env.GITHUB_ACTIONS !== "true" ||
    process.env.CASHFREE_WEBHOOK_LIVE_QA_APPROVED !== "true" ||
    process.env.GITHUB_REF !== "refs/heads/main")
  throw Error("CASHFREE_SANDBOX_MANUAL_MAIN_WORKFLOW_ONLY")
const appId = process.env.CASHFREE_TEST_APP_ID?.trim()
const secret = process.env.CASHFREE_TEST_SECRET_KEY?.trim()
if (!appId || !secret) throw Error("CASHFREE_TEST_SECRETS_MISSING")
const base = process.env.CASHFREE_SANDBOX_WEBHOOK_BASE?.trim()
let origin
try { origin = new URL(base) } catch { throw Error("SANDBOX_TUNNEL_ORIGIN_INVALID") }
if (origin.protocol !== "https:" || !origin.hostname.endsWith(".trycloudflare.com") ||
    origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password)
  throw Error("SANDBOX_TUNNEL_ORIGIN_INVALID")

const verifyProviderWebhook = await actualCashfreeVerifier(secret)
const callbackKey = randomBytes(18).toString("hex")
const returnKey = randomBytes(18).toString("hex")
const checkoutKeys = {
  success: randomBytes(18).toString("hex"),
  failure: randomBytes(18).toString("hex")
}
const orders = new Map()
const dedupe = new Set()
const verified = { success: false, failure: false }
let invalidCount = 0
let duplicateCount = 0
let created = false

function reply(res, code, body, contentType = "application/json") {
  res.writeHead(code, {
    "Content-Type": contentType + "; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY"
  })
  res.end(typeof body === "string" ? body : JSON.stringify(body))
}
function htmlSafe(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}
function checkoutPage(entry) {
  const session = JSON.stringify(entry.paymentSessionId)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Celebration SANDBOX QA — ${htmlSafe(entry.scenario)}</title>
  </head><body style="max-width:480px;margin:60px auto;padding:20px;font:16px system-ui">
  <h1>Cashfree SANDBOX — ${htmlSafe(entry.scenario)}</h1>
  <p>Test order ${htmlSafe(entry.orderId)}: ₹549 (₹499 gift + ₹50 delivery).</p>
  <p>This is an isolated TEST gateway checkout. No real payment and no website order.</p>
  <button id="pay" style="font-size:18px;padding:14px">Open SANDBOX checkout</button>
  <button id="copy" style="font-size:14px;padding:14px">Copy session for Cashfree Dev Studio</button>
  <p id="message" role="status"></p>
  <p><a href="https://www.cashfree.com/devstudio/preview/pg/web/checkout"
    rel="noopener noreferrer">Fallback: open Cashfree Dev Studio</a></p>
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <script>
   const session = ${session};
   document.getElementById('pay').onclick = async () => {
     const node=document.getElementById('message');
     try {
       if (typeof Cashfree !== 'function') throw Error('Cashfree SDK unavailable. Use Dev Studio.');
       await Cashfree({mode:'sandbox'}).checkout({paymentSessionId:session,redirectTarget:'_self'});
     } catch (err) {node.textContent='Checkout unavailable: use Dev Studio fallback.';}
   };
   document.getElementById('copy').onclick = async () => {
     try {await navigator.clipboard.writeText(session);
       document.getElementById('message').textContent='Sandbox session copied. Paste in Dev Studio.';
     } catch {document.getElementById('message').textContent='Browser clipboard unavailable.';}
   };
  </script></body></html>`
}
function baseHeaders() {
  return {
    "Accept": "application/json", "Content-Type": "application/json",
    "x-api-version": "2025-01-01", "x-client-id": appId, "x-client-secret": secret
  }
}
async function cashfree(path, options = {}) {
  const r = await fetch(API + path, {
    ...options,
    headers: baseHeaders(), cache: "no-store", signal: AbortSignal.timeout(15000)
  })
  if (!r.ok) throw Error("SANDBOX_CASHFREE_HTTP_" + r.status)
  return r.json()
}

async function webhook(req, res) {
  // Preserve exact raw bytes for Cashfree's timestamp + body HMAC. Converting
  // each TCP chunk to UTF-8 separately can corrupt split multibyte sequences.
  const chunks = []
  let length = 0
  for await (const chunk of req) {
    length += chunk.length
    if (length > MAX_WEBHOOK_BYTES) {
      invalidCount++
      reply(res, 413, { ok: false })
      return
    }
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString("utf8")
  let event
  try {
    // Uses Celebration's actual payment-provider HMAC verifier with its
    // isolated test secret, NOT a hand-rolled alternative verifier.
    event = verifyProviderWebhook("cashfree", text, new Headers(req.headers))
  } catch {
    invalidCount++
    reply(res, 401, { ok: false })
    return
  }
  const row = orders.get(event.providerOrderId)
  if (!row || event.amountPaise !== AMOUNT_PAISE || event.provider !== "cashfree") {
    invalidCount++
    reply(res, 422, { ok: false })
    return
  }
  const signature = req.headers["x-webhook-signature"]
  const stamp = req.headers["x-webhook-timestamp"]
  if (typeof signature !== "string" || typeof stamp !== "string" ||
      !/^\d{10,16}$/.test(stamp)) {
    invalidCount++
    reply(res, 401, { ok: false })
    return
  }
  const eventKey = row.scenario + ":" + event.eventId
  const duplicate = dedupe.has(eventKey)
  if (duplicate) duplicateCount++
  else dedupe.add(eventKey)

  // Reconcile gateway payment facts independently; an HTTP POST alone is NOT
  // accepted as proof of money received or of a failed checkout.
  let verifiedByApi = false
  try {
    const payments = await cashfree("/orders/" + encodeURIComponent(event.providerOrderId) + "/payments")
    assert.ok(Array.isArray(payments))
    const matching = payments.some(p => {
      const amountOk = Number(p.payment_amount) === 549
      const paymentMatches = event.providerPaymentId &&
        String(p.cf_payment_id) === String(event.providerPaymentId)
      const statusMatches = p.payment_status === (event.status === "paid" ? "SUCCESS" :
        event.status === "failed" ? "FAILED" : "PENDING")
      return amountOk && paymentMatches && statusMatches
    })
    verifiedByApi = Boolean(matching)
  } catch {
    verifiedByApi = false
  }
  if (verifiedByApi && event.status === (row.scenario === "success" ? "paid" : "failed")) {
    verified[row.scenario] = true
  }
  console.log(JSON.stringify({
    result: "CASHFREE_REAL_SIGNED_WEBHOOK_ARRIVED",
    sandboxOrderId: event.providerOrderId, eventStatus: event.status,
    gatewayPaymentVerified: verifiedByApi, duplicate, productionTouched: false
  }))
  reply(res, verifiedByApi ? 200 : 503, { ok: verifiedByApi })
}

const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url || "/", "http://127.0.0.1")
    if (req.method === "GET" && path.pathname === "/health") {
      reply(res, 200, { ok: true, isolated: true })
      return
    }
    if (req.method === "POST" && path.pathname === "/webhook/" + callbackKey) {
      await webhook(req, res)
      return
    }
    if (req.method === "GET" && path.pathname === "/return/" + returnKey) {
      reply(res, 200, "<h2>Sandbox checkout ended.</h2><p>Check GitHub Actions logs for verified webhook evidence.</p>",
        "text/html")
      return
    }
    if (req.method === "GET" && created) {
      for (const entry of orders.values()) {
        if (path.pathname === "/checkout/" + checkoutKeys[entry.scenario]) {
          reply(res, 200, checkoutPage(entry), "text/html")
          return
        }
      }
    }
    reply(res, 404, { ok: false })
  } catch {
    reply(res, 500, { ok: false })
  }
})

await new Promise((resolve, reject) => {
  server.once("error", reject)
  server.listen(PORT, "127.0.0.1", resolve)
})
console.log("CASHFREE_DISPOSABLE_RECEIVER_LISTENING_LOCAL_ONLY")

try {
  for (let i = 0; i < 20; i++) {
    try {
      const check = await fetch(base + "health", { signal: AbortSignal.timeout(2500) })
      if (check.ok) break
    } catch {}
    if (i === 19) throw Error("TUNNEL_PUBLIC_HEALTHCHECK_FAILED")
    await new Promise(r => setTimeout(r, 1500))
  }
  for (const scenario of ["success", "failure"]) {
    const id = "SBQA_" + Date.now().toString(36) + "_w" +
      scenario[0] + randomBytes(4).toString("hex")
    const row = await cashfree("/orders", {
      method: "POST",
      body: JSON.stringify({
        order_id: id, order_currency: "INR", order_amount: 549,
        customer_details: {
          customer_id: "celebration_webhook_isolated_sandbox",
          customer_phone: "9999999999", customer_name: "Celebration Sandbox"
        },
        order_meta: {
          // Critical: Cashfree sends events ONLY to disposable GitHub CI.
          notify_url: base + "webhook/" + callbackKey,
          return_url: base + "return/" + returnKey + "?order_id={order_id}"
        },
        order_note: "CELEBRATION_ISOLATED_REAL_WEBHOOK_" + scenario
      })
    })
    assert.equal(row.order_id, id)
    assert.equal(row.order_amount, 549)
    assert.ok(row.payment_session_id?.startsWith("session_"))
    orders.set(id, {
      scenario, orderId: id, paymentSessionId: row.payment_session_id
    })
  }
  created = true
  const success = [...orders.values()].find(x => x.scenario === "success")
  const failure = [...orders.values()].find(x => x.scenario === "failure")
  console.log("CASHFREE_REAL_SANDBOX_WEBHOOK_TEST_READY " + JSON.stringify({
    successfulPaymentCheckoutUrl: base + "checkout/" + checkoutKeys.success,
    failedPaymentCheckoutUrl: base + "checkout/" + checkoutKeys.failure,
    successOrderId: success.orderId, failureOrderId: failure.orderId,
    amountRupees: 549, maximumWindowMinutes: 15,
    productionTouched: false
  }))
  let done = false
  for (let i = 0; i < MAX_TEST_MS / 2000; i++) {
    if (verified.success && verified.failure) {
      done = true
      break
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  console.log(JSON.stringify({
    result: done ? "CASHFREE_REAL_SIGNED_WEBHOOK_BOTH_SCENARIOS_PASSED" :
      "CASHFREE_REAL_SIGNED_WEBHOOK_INCOMPLETE",
    validSuccess: verified.success, validFailure: verified.failure,
    replayCount: duplicateCount, invalidCount, productionTouched: false
  }))
  if (!done) process.exitCode = 1
} catch (err) {
  console.error("CASHFREE_DISPOSABLE_WEBHOOK_QA_FAILED",
    err instanceof Error ? err.message : "UNKNOWN")
  process.exitCode = 1
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
