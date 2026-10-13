# Cashfree Real Merchant Sandbox Smoke — 13 October 2026

## Owner setup
Environment `cashfree-sandbox` in `nitinkumawat9661/SHOPCELEBRATION` has two scoped secrets:
`CASHFREE_TEST_APP_ID` and `CASHFREE_TEST_SECRET_KEY`.
Do **not** copy secrets into source, local scripts, production .env or chat.

## Run (PowerShell)
After the workflow is merged into `main`:

```powershell
gh workflow run cashfree-sandbox-smoke.yml -R nitinkumawat9661/SHOPCELEBRATION -r main
gh run list -R nitinkumawat9661/SHOPCELEBRATION --workflow cashfree-sandbox-smoke.yml --limit 3
```

After the most recent run is complete, inspect its conclusion:

```powershell
gh run view -R nitinkumawat9661/SHOPCELEBRATION --log
```

Use the run ID returned by `gh run list` if `gh run view` is ambiguous.

## Exactly what is exercised
- The existing real `lib/server/payments/provider.ts` Cashfree Create Order path, with isolated test-mode configuration, uses only `https://sandbox.cashfree.com/pg`.
- Creates **one** Cashfree sandbox order for **₹549** (₹499 hamper + ₹50 delivery).
- Checks that Cashfree generated a checkout session.
- Independently fetches Cashfree's persisted order and checks ₹549, INR, matching order ID and ACTIVE status.
- Checks Cashfree provider payment list has no captured payment.
- Prints only non-sensitive order ID/status; never prints credentials or session tokens.
- Uses a harmless, non-production callback base URL and fictitious test customer. Does not access website Postgres/VPS, send a webhook, accept a payment, capture money or create a website order.

## IMPORTANT limitations
This test verifies API connectivity, sandbox credentials, Cashfree Create/Get/Payments shape and ₹50 amount. **It does not test a completed sandbox payment, refund, live website checkout, signed inbound webhook, cancellation or delivered+48h R2 deletion.** Those remain hard release gates. Never call this a complete payment-gateway launch test.

A failed run does not affect `shopcelebration.in`. Do not weaken the production DB `customer_enabled=false` check or change jewellery/curated hampers/inventory to make this pass.
