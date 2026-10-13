# Celebration — Real Cashfree Sandbox Payment QA

**Customer checkout remains hard-gated OFF. No production DB, VPS, stock or customer record accessed.**

## Generate two Cashfree test checkouts using saved GitHub environment secrets

In PowerShell:

```powershell
$repo = "nitinkumawat9661/SHOPCELEBRATION"
gh workflow run cashfree-sandbox-checkout-qa.yml -R $repo --ref main -f action=create
$runId = gh run list -R $repo --workflow cashfree-sandbox-checkout-qa.yml --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $runId -R $repo --exit-status
New-Item -ItemType Directory -Force "$env:TEMP\celebration-cashfree-qa" | Out-Null
gh run download $runId -R $repo -n cashfree-sandbox-sessions -D "$env:TEMP\celebration-cashfree-qa"
notepad "$env:TEMP\celebration-cashfree-qa\sessions.json"
```

## Complete the test checkouts manually

1. Open **https://www.cashfree.com/devstudio/preview/pg/web/checkout** and scroll to **Load Checkout**. Choose `Sandbox` and paste **success** order's `paymentSessionId` (not your secret key). Start checkout.
2. Cashfree publishes test Visa debit card `4706131211212123`, expiry `03/2028`, CVV `123`, cardholder `Test`, OTP `111000`. Use only sandbox card data; never use a real card.
3. Return to Dev Studio, paste **failure** order's different session. If sandbox UPI Collect is offered, use `testfailure@gocash`. A user abandonment checks user-drop, not a completed failed payment.
4. Never share sandbox payment-session IDs publicly. Workflow sessions artifact expires after one day.

## Verify gateway-side payment result (no DB access)

For success:

```powershell
gh workflow run cashfree-sandbox-checkout-qa.yml -R $repo --ref main -f action=verify -f order_id=YOUR_SUCCESS_ORDER_ID -f expected_status=paid
```

For failure:

```powershell
gh workflow run cashfree-sandbox-checkout-qa.yml -R $repo --ref main -f action=verify -f order_id=YOUR_FAILURE_ORDER_ID -f expected_status=failed
```

Then `gh run list -R $repo --workflow cashfree-sandbox-checkout-qa.yml --limit 3` and `gh run view <run-id> --log`.

The verify job checks Cashfree Get Order AND Get Payments, amount exactly ₹549, and rejects unexpected statuses. The test workflow creates two separate merchant SANDBOX checkout orders only and uses Cashfree's Dev Studio as the return destination; **no production callbacks or webhooks are attempted**.

## Remaining before actual Self-Build launch

- Observe signed webhook delivery + repeated/out-of-order events against an isolated application DB, and verify retry/cancellation/refund state transitions end-to-end. This isolated test deliberately skips webhooks.
- Test actual *website* payment reconciliation in a nonproduction clone with Cashfree sandbox credentials and trusted photo R2.
- Confirm cancelled/undelivered photo retention policy and live delivered+48h deletion.
- Explicit owner approval and reviewed DB customer-enabled hard-gate migration, never from QA workflow.
- Production retail inventory and all jewellery/curated hamper flows must remain untouched.

Cashfree documentation: https://www.cashfree.com/docs/api-reference/payments/data-to-test-integration
