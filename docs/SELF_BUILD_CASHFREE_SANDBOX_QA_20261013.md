# Celebration Cashfree Self-Build Sandbox Acceptance

**Provider selected: Cashfree.** Scope: Self-Build hampers only. Customer checkout remains disabled.

## Offline verified through CI
Run `node scripts/test-cashfree-self-build-contract.mjs`.

- Real Cashfree provider module loads with mocked HTTP, no network.
- ₹499 tier + ₹50 delivery = **₹549** sent to Cashfree sandbox Create Order.
- Payment session, return URL and webhook URL contract checked.
- Server-to-provider paid, failed and pending status checks.
- Webhook HMAC signature rejection, deterministic replay event ID.
- Existing PostgreSQL tests separately verify no-inventory, idempotent gateway settlement and ₹50 shipping snapshot. No real merchant capture has been performed.

## Real merchant sandbox still required
1. Use a **non-production** instance configured for `PAYMENT_PROVIDER=cashfree`, `PAYMENT_MODE=test` and the Cashfree **test** App ID, Secret Key and Webhook Secret stored in a secure secrets manager. Do not paste them into ChatGPT or the repository. Do not reuse live merchant credentials.
2. Create a Self-Build order with tier ₹499 and delivery ₹50. Confirm Cashfree returns a checkout session for **₹549**, and the backend stores `shipping_paise=5000`, `amount_paise=54900`.
3. Complete a genuine Cashfree test success, failed payment, and dropped payment. Verify signed webhooks, Cashfree order lookup, retry, and duplicate webhook/return behavior.
4. Verify cancellation/review; the current app **does not automatically issue Cashfree refunds**. Owner reviews refunds manually.
5. Save redacted evidence, sign off Cashfree sandbox tests. Separately prove production R2 delivered+48h deletion and obtain owner approval **before** any buyer launch or DB gate change.

No production customer Self-Build checkout is enabled by this PR. Existing jewelry and curated hamper payments are unchanged.
