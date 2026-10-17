# Celebration Admin V3 — Inventory Milestone Status

**Date:** 17 October 2026 (IST)  
**Branch:** `feat/admin-v3-phase1-20261017`  
**Release:** DEVELOPMENT ONLY — DO NOT DEPLOY, MERGE, MIGRATE PRODUCTION OR TEST AGAINST LIVE PAYMENT/STOCK.  
**Validation:** Source inspection and contract checks only; full Node tests, typecheck, Next build and PostgreSQL transaction integration tests NOT YET RUN.

## Delivered in this development branch

- New `AdminInventoryV3` workspace wired to the Inventory navigation entry with responsive layout.
- Live available-to-sell stock per individually sellable active SKU; SKU search; All, Low (1–3), Out (0), Healthy (>3) filters; total available units.
- Select a SKU and propose SET / ADD / REMOVE of available stock with required human-readable audit reason and explicit confirmation preview.
- New server-authoritative `nextAvailableStock` domain rule (0…10000, no negative values, no no-ops).
- New `POST /api/admin/inventory/adjustments`: original server passkey authentication, origin check, rate-limit; transaction; per-key advisory idempotency lock; shared catalog eligibility check; row-locked product inventory; compare expected available count; update available_quantity; insert audit event within SAME DB transaction; invalidate catalog cache (also on retries).
- New authenticated `GET /api/admin/inventory/adjustments` retrieves 40 recent audit events (up to 100 with limit) for admin-only history display.
- Additive migration `db/migrations/109_admin_inventory_adjustment_history.sql`: `admin_inventory_adjustments` with identity PK, unique UUID request ID, SKU foreign key, before/after/expected counts, adjustment mode, reason, delta, actor label and timestamps; no alterations to `product_inventory` or `inventory_reservations`.
- Existing `/api/admin/reservations` is read-only reused to show active, expired pending-payment and anomaly hold reviews. The UI opens actual orders for separate verification, without releasing holds.
- Domain and source invariant tests in `scripts/test-admin-v3-inventory.mjs`.

## Safety conditions preserved

- Inventory here represents **available-to-sell**, NOT measured physical stock. It is ALREADY net of reservations; no second subtraction.
- No conversion of unverified/expired payments to failures and no arbitrary reservation release.
- If checkout or another operator changed available quantity, V3 rejects an old expected count with HTTP 409 and demands refresh; no silent last-write-wins.
- An adjustment with identical UUID retried by the browser is idempotent; replay returns the prior event, not a second stock change.
- No new stock records are auto-created; missing product_inventory row causes a safe conflict rather than invented stock.
- Audit and reservation-read failures disable changes in the V3 UI. Server still validates every request independently.
- No stock writes or migration executed through these GitHub code changes; production stock remains untouched.
- No Self-Build buyer checkout enablement, no SKU mapping for Self-Build category choices, no payment/refund/shipping/Telegram modifications.

## Explicit limitations and future work

- **Low-stock labels exist; automatic push notifications do not.** Notification delivery requires a separately reviewed worker and owner decision.
- **Single SKU at a time.** Atomic multi-SKU bulk adjustment is NOT implemented and should not be simulated with parallel browser calls (partial application risk).
- Audit table starts when migration 109 is applied. Historic changes via the existing legacy PATCH endpoint are NOT retrospectively logged and are not automatically covered by this new audit flow.
- The legacy `PATCH /api/admin/inventory` is preserved for current admin compatibility; before claiming **all** admin stock writes audited, transition legacy editor to audited CAS mode with its own safety review.
- Audit `actor` is the coarse label `authenticated-admin`, not a verified unique admin user identifier.
- The new GET history lists latest 40; not a paginated complete ledger UI.
- Staging migrations MUST be applied before loading the new inventory screen. Without migration, history API fails closed and V3 adjustment controls remain disabled.
- Full production rollout requires correct cache invalidation under outage/retry, concurrency tests with order reservation/commit/release, replay-after-commit, two-admin conflict, catalog SKU deactivation, transactional rollback on audit INSERT failure, mobile UI verification and confirmation that the main storefront stock remains authoritative.

## Staging test commands

```bash
npm ci
node scripts/test-admin-v3-phase1.mjs
node scripts/test-admin-v3-phase2.mjs
node scripts/test-admin-v3-functional-integration.mjs
node scripts/test-admin-v3-inventory.mjs
npm run typecheck
npm run audit
npm run build
```

Using an isolated staging PostgreSQL database with a backup/rollback plan:
1. Run `npm run db:migrate` for migration 109, **on staging only**, after checking environment DATABASE_URL.
2. Create a staging test SKU with 5 available, 0 committed/pending reservations. Add 2 →7; Remove 1 →6; Set to 0. Confirm 3 exactly-once audit rows and refreshed public catalog.
3. Two concurrent attempts with same request ID must write exactly one audit event and one stock change; changing request inputs with same ID must be HTTP 409.
4. Two simultaneous changes with expected stock of 5: one should win, other returns STOCK_CHANGED_RELOAD; no lost update.
5. Reserve 2 pieces while attempted admin adjustment competes: resulting available never negative; reservation never deducted twice.
6. Expired unresolved payment does NOT automatically release hold. Failed/cancelled release rules from existing system remain unchanged.
7. Missing audit table must cause transaction rollback/failure (no untracked stock mutation).
8. Verify no unauthenticated access to any inventory routes and no cross-site POST writes; use actual passkey login.
9. Test 320/390/768/1440 responsive, success/failure/conflict states, back navigation and owner review.

## Operations follow-up

- **Changed:** Code, DB migration file, static tests and V3 inventory interface on non-production GitHub development branch.
- **Live verification:** None, and no live products or orders modified.
- **Deployment required now:** No. Production deployment requires staging QA and separate owner instruction.
- **SEO/GA4/Merchant Center:** None from dev-only changes. Recheck store schema/pricing only after a real production inventory change in a later approved release.
- **Recheck:** After isolated staging tests above, before requesting owner production approval.
