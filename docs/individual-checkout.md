# Individual jewelry and gift checkout

Implemented on 1 October 2026. Before this change, jewelry pages directed customers to an eligible hamper budget. Products had hamper eligibility, but no individual sale price, cart or standalone order contract. The order API required a hamper tier.

The implementation adds individual purchases alongside the existing hamper checkout. Existing products remain opted out; no merchant sale prices or production orders were created.

## Customer and merchant flow

| Step | Implemented behavior |
| --- | --- |
| Configure products | Admin enters the actual individual price in rupees, enables **Sell individually**, and publishes the catalog draft. Active products with valid prices become purchasable. Hamper minimum and point eligibility remain separate. |
| Select a product | Collection cards and product pages show the individual price and **Add to cart**. **Buy now** opens the cart. Other products retain their hamper flow. |
| Review cart | Quantities, removal and exact totals; up to 10 units per product and 20 distinct products. Local storage keeps IDs and quantities only. Prices and availability come from the published catalog. |
| Enter delivery | Customer/receiver names, phone, required date, full address, city, state and pincode are validated. Login uses the existing customer account system. |
| Pay | The existing configured Razorpay or Cashfree checkout handles supported UPI/cards/apps. Individual products require gateway payment. If the gateway is unavailable, payment is disabled; no manual UTR order is accepted. |
| Confirm payment | Server verifies provider signatures/results and the exact order amount. A client callback alone cannot mark an order paid. Duplicate events are idempotent. |
| Recover an interrupted payment | A saved order stays attached to its owner and original amount. Retry uses `/api/payments/retry`, even if product eligibility changes or the required date passes. My Celebration links pending individual orders to payment status/retry after reload. Cancelled and confirmed orders cannot reopen payment. |
| Fulfill | Account, admin and tracking show purchased names, quantities, unit prices and line totals. Existing packing video, explicit dispatch approval, shipping and issue workflows remain available. |

## Database and backend

Migration `009_individual_orders.sql` adds `order_type` and `line_items`, permits a null hamper tier for individual purchases, and checks that the order shape matches its type. Existing orders default to `hamper` with empty line items.

Each individual order stores an immutable product name, quantity, unit price, line total and optional image snapshot. New orders re-read the published catalog under a transaction lock and calculate the amount on the server. The buyer's expected total detects a price change; it never sets the charge. A changed price requires review before an order is inserted. Integer paise and database amount bounds prevent rounding and overflow errors.

Creation preserves same-origin checks, authentication, account ownership, policy acceptance, rate limits and idempotency. Saved-order retries do not recalculate catalog prices. Provider creation failures return owner-checked saved order details, so another attempt stays on the same order. Confirmed manual payments remain confirmed as fulfillment progresses; failed gateway events cannot downgrade them.

## Validation completed

- `npm run check`: TypeScript, source/import/config audits, domain/provider signature checks, catalog price validation, cart behavior, actual submit-hook recovery and order presentation passed.
- `npm run build`: optimized Next.js production build passed.
- `npm audit --omit=dev`: zero known production dependency vulnerabilities.
- `npm run test:orders:integration`: passed against a disposable loopback PostgreSQL database. Covers migrations 001–009, legacy hamper compatibility, snapshot totals, price changes, unavailable products, concurrent creation/publishing, owner/cart mismatch, manual-payment rejection, missing/wrong paid amounts, duplicate payment events, cancellation and already-confirmed payment guards.
- Local browser: product **Buy now**, quantity totals, cart persistence, missing delivery validation, valid delivery, customer login, gateway-disabled payment state, mobile layout, account item snapshots and payment recovery checked. Admin price edit → Save draft → Preview → Publish updated the local storefront to ₹251.25; existing order snapshots retained their original prices.

The database tests refuse any non-loopback connection or database name other than `celebration_individual_test`. Their fixtures are local test products, not shipped catalog changes. Provider tests are offline; no external gateway transaction or production purchase was made.

## Production activation

1. Release this branch through the existing production workflow. It applies migration 009 before switching the running application. Keep existing production environment values; this feature adds no provider keys or runtime dependencies.
2. In Admin Products, enter merchant-approved unit prices (₹1 minimum, up to two decimal places), enable individual sales and Active, then **Save draft → Preview → Publish**.
3. Verify an enabled SKU through the storefront and complete an authorized gateway sandbox transaction, including payment return/webhook and order tracking. A real gateway transaction remains unverified in this implementation session.

Disabling individual sale and publishing pauses future purchases without changing saved order snapshots. Catalog revisions support reverting product configuration. Rolling back application code does not require removing the additive order columns.

## Scope and remaining business configuration

Availability uses the existing Active and individual-sale switches. Finite stock counts, stock reservations and oversell prevention are not implemented. Add inventory tracking when products have limited quantities. Individual totals are unit price × quantity, with no additional shipping fee at checkout; a separate tax/shipping engine and individual discount offers are not included. Existing hamper offers remain available for hampers.

This report describes tested code in the feature branch. It does not claim that individual purchasing is already enabled on `shopcelebration.in`.
