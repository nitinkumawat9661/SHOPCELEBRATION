# Celebration: Cashfree signed webhook + merchant refund sandbox QA

13 Oct 2026. **Production Self-Build customer_enabled=false stays enforced.**

### Evidence already obtained
- Cashfree SANDBOX order `SBQA_mv6zhmmt_s8cbd5fec` ₹549 paid (one successful payment).
- Cashfree SANDBOX `SBQA_mv6zhnm0_fc683a838` failed then retried successfully on same Cashfree order.
- Isolated PostgreSQL CI verifies Self-Build order amount ₹549, failed-to-paid retry, idempotent event insertion and no inventory/capacity writes.

### Implemented on this branch
- The real provider's Cashfree webhook raw-body HMAC verifier is called with disposable test webhook secret before handing signed event results to the real app's payment store, in disposable PostgreSQL.
- Altered signatures, unsigned requests and ₹499 underpayment rejected. Payment replay and delayed failure never undo paid state.
- Signed success after cancellation leaves status `cancelled` and queues human `LATE_PAYMENT_AFTER_CANCELLATION` refund review. It deliberately never executes an automatic refund.
- A separate manual-only Cashfree SANDBOX refund workflow has two modes: safe `inspect`, and explicit owner-authorized `refund`, restricted to a paid `SBQA_` test order and exact ₹549 charge. Never reads website DB, VPS or live Cashfree keys.
- Deterministic `refund_id` and UUID idempotency key prevent accidental second refund on rerun. The provider's readback status is shown. Do NOT call a `PENDING` refund completed.

### PowerShell — inspect the already paid test order (read only)

```powershell
$repo = "nitinkumawat9661/SHOPCELEBRATION"
gh workflow run cashfree-sandbox-refund-qa.yml -R $repo --ref main -f action=inspect -f order_id=SBQA_mv6zhmmt_s8cbd5fec
gh run list -R $repo --workflow cashfree-sandbox-refund-qa.yml --limit 1
```

### PowerShell — explicitly initiate ₹549 SANDBOX refund

**This creates a refund in Cashfree TEST MODE. Does not initiate a live refund or modify a production order.**

```powershell
gh workflow run cashfree-sandbox-refund-qa.yml -R $repo --ref main -f action=refund -f order_id=SBQA_mv6zhmmt_s8cbd5fec -f approval=SANDBOX_REFUND_549
gh run list -R $repo --workflow cashfree-sandbox-refund-qa.yml --limit 1
```

Read run logs for `CASHFREE_SANDBOX_REFUND_CREATED_AND_LOOKED_UP` or `CASHFREE_SANDBOX_REFUND_EXISTING_IDEMPOTENT`. For a `PENDING` status, use `inspect` to check again; no duplicate refund.

### Limitations / release gate
- Signed webhook-to-PG integration is synthetic locally signed HMAC, NOT delivery from Cashfree servers to a public **isolated** website. A real webhook subscription and public nonproduction endpoint still must be set up and observed before launch.
- Merchant SANDBOX refund is distinct from the website's manual refund reconciliation ledger: writing a reference in the admin panel does not make the refund happen.
- Delivered+48h private personal-photo R2 removal must be observed on real nonproduction objects and failed/retried deletion.
- Requires explicit owner launch approval before any `customer_enabled` switch; existing inventory/SKU unchanged.
- Cashfree docs: https://www.cashfree.com/docs/api-reference/payments/latest/refunds/create-refund and https://www.cashfree.com/docs/api-reference/payments/latest/refunds/get-refund
