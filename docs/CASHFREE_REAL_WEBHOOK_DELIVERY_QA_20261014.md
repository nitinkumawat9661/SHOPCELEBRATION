# Cashfree REAL webhook delivery — disposable GitHub Actions QA

**Status:** Test harness implemented, but a genuine Cashfree -> temporary HTTPS -> signed callback has **NOT YET BEEN OBSERVED**. It will only be proven by a passing manually dispatched GitHub workflow with two test payments.

## Isolation
- Manual `workflow_dispatch`, `main` only, protected `cashfree-sandbox` environment test credentials.
- Temporary Cloudflare Quick Tunnel assigned per GitHub job. HTTPS endpoint exists for at most 15 minutes, then closes. Cloudflare's Quick Tunnel is for testing and offers no uptime guarantee.
- Uses Celebration's actual `verifyProviderWebhook('cashfree', rawBody, headers)` module with **real test merchant signature key**. No fake signature is supplied for the real test.
- Two unique Cashfree **test** orders ₹549 (₹499 gift + ₹50 delivery), separate checkout pages served by isolated process.
- Payment webhooks are accepted only if: HMAC is valid; order ID belongs to this job; paid/failed payment amount ₹549; its payment ID and status match a fresh Cashfree sandbox Get Payments response. Replayed callbacks do not double-process. No DB writes.
- **NEVER** calls `shopcelebration.in`, its payment webhook route, production PostgreSQL, R2, courier APIs, or inventory. Live checkout remains OFF.
- Cloudflare client `2026.10.0` downloaded from the official releases with pinned SHA-256: `77e26d8d900e0b8469f416239d14b5f296525fdf79fee6f511ef55609e3fbac2`.

## Run in PowerShell (interactive real sandbox QA)

```powershell
$repo = "nitinkumawat9661/SHOPCELEBRATION"
gh workflow run cashfree-real-webhook-qa.yml -R $repo --ref main
$runId = gh run list -R $repo --workflow cashfree-real-webhook-qa.yml --limit 1 --json databaseId --jq '.[0].databaseId'
gh run view $runId -R $repo --web
```

In the **job logs while the run is still active**, find `CASHFREE_REAL_SANDBOX_WEBHOOK_TEST_READY`. It prints the two *ephemeral* `successfulPaymentCheckoutUrl` and `failedPaymentCheckoutUrl` plus order IDs. Do not post the entire checkout URLs publicly.

1. Open the success checkout URL and perform a **Cashfree SANDBOX test** payment with Cashfree's approved test card (never a real card).
2. Open the failure checkout URL and attempt a deliberate failed sandbox payment (e.g. official Cashfree test-failure VPA where UPI Collect is available).
3. The collector prints `CASHFREE_REAL_SIGNED_WEBHOOK_ARRIVED` with `gatewayPaymentVerified: true` after verifying real Cashfree payment facts.
4. Success condition: `CASHFREE_REAL_SIGNED_WEBHOOK_BOTH_SCENARIOS_PASSED`. Cashfree may require merchant-dashboard sandbox webhook event settings or may not deliver one event. If so the job ends `INCOMPLETE`; inspect sandbox webhook logs/config before repeating.

### Fallback
If the ephemeral checkout page cannot invoke Cashfree's SDK due to SDK domain whitelisting, use **Copy session for Cashfree Dev Studio** and paste the session ID into Cashfree's official `https://www.cashfree.com/devstudio/preview/pg/web/checkout` Sandbox Load Checkout control. The original order already carries the tunnel notify URL, so it remains eligible for a real webhook.

### Security and limits
- Checkout pages contain only fake customer details, isolated test sessions and test order IDs; no actual personal data.
- These pages are ephemeral and have unguessable access paths. Anyone with the link can attempt a fake sandbox payment, so do not expose them.
- Signed-webhook receiver success proves provider delivery + signature + gateway-read reconciliation at an isolated endpoint; does **not** yet prove webhook->actual Next.js route->database lifecycle on a public staging clone.
- Next hard gate: staging app with isolated PostgreSQL and R2, real Cashfree webhook with exact website route; delivered+48h photo bytes deletion test.
- Neither this workflow nor a green test should flip `customer_enabled=false` without explicit approval.
