# Celebration Telegram Order Alerts: backend handoff (13 October 2026)

**Repository:** `nitinkumawat9661/SHOPCELEBRATION`  
**Development branch:** `feat/telegram-order-messages`  
**Production:** NOT MERGED, NOT DEPLOYED, NOT MIGRATED. Customer UI deliberately unchanged.

> **STATUS UPDATE (13 Oct 2026):** This file is the *original backend design/historical checklist*, not the latest execution status. Static/security tests, isolated real PostgreSQL integration, build, backup-restore and Telegram migration 100–102 smoke tests have since PASSED on the previous feature head. The new UI, latest-main integration, production deployment, worker, webhook registration and real Telegram end-to-end test remain outstanding. **Read TELEGRAM_ORDER_SYSTEM_COMPLETE_HANDOFF_20261013.md and TELEGRAM_PRODUCTION_DEPLOYMENT_RUNBOOK_20261013.md as the current source of truth.**

## Required owner-approved behavior
Every new order, even unpaid, should create an owner alert. Further payment,
packing, cancellation, courier, delivery, issues and recorded resolution events
produce separate alerts. Telegram owner replies to the bot's original order
notification should be stored under that specific order and accessible **only
to its logged-in customer** in the future `My Orders` UI.

## Backend implemented (in feature branch, NOT live)
- `100_telegram_notification_outbox.sql`: persistent outbox on existing order
  and gateway payment event inserts; unique source-event ID.
- `101_telegram_order_messaging_and_courier.sql`: event-time snapshots, payment
  status transition events, reply storage and courier observation deduplication.
- `102_telegram_courier_watch.sql`: bounded periodic carrier polling state.
- `scripts/telegram-notification-worker.mjs`: owner-only Telegram delivery,
  retries, event-time order amount/payment, product details, cancellation info,
  courier updates. Inflight Telegram successes cannot be absolutely guaranteed
  duplicate-free if the worker crashes between Telegram and database commit.
- `app/api/integrations/telegram/webhook/route.ts`: authenticated Telegram
  incoming text reply storage. Requires Telegram secret-token header and matching
  *both* private sender ID and chat ID. Maps reply-to bot message ID through
  an existing SENT outbox entry. Arbitrary textual order IDs are NOT trusted.
- `lib/server/telegram-order-messages.ts`: persistent per-order support notes.
  Telegram `update_id` dedup; only the authenticated account owning the order
  can read/acknowledge the associated messages.
- `GET /api/account/orders/:publicId/messages`: latest 100 messages, ascending;
  includes count of unread messages, private no-store. Requires customer session.
  `POST` to same endpoint marks own messages as read and enforces same-origin.
- `lib/server/orders/courier-observations.ts`: records deduplicated authenticated
  Shipway carrier observations; calls via existing `syncOrderCourier` are wrapped
  in try/catch and never decide payment, cancellation, dispatch, or refunds.
- `POST /api/integrations/telegram/courier-poll`: off-by-default endpoint with
  dedicated private header, at most three active orders per call and five-minute
  recheck protection. `scripts/telegram-courier-cron.mjs` invokes it when enabled.
- `scripts/test-telegram-backend.mjs`: static security-contract tests and
  message-formatting fixtures (pending at event-time, paid later,
  cancellation, pickup failure).
- `scripts/test-order-integration.mjs`: additive isolated-PostgreSQL assertions
  for order event outbox, event-time pending/paid snapshots, Telegram reply
  mapping, replay deduplication, owner/customer isolation and read receipts.
  **This runner destroys only a specifically named local test database:**
  `celebration_individual_test`. Never point at the live DB.
- `config/env.ts`: private Telegram env keys, no browser `NEXT_PUBLIC` keys.

## What was deliberately NOT modified
- No storefront/customer UI changes.
- No customer-facing order summary API changes.
- No checkout, payment, refund, inventory or courier booking flow changes.
- No Appwrite.
- No production `main` merge, VPS actions, production migration, Telegram
  webhook registration, PM2 startup, or cron activation.

## Full notification coverage
- New order: existing `order_created` (pending payment included).
- Gateway payment event: `payment_events`; status change including paid,
  pending/failed/verified: `payment_status_changed`.
- Cancellation: existing `status_changed`, with available actor/source,
  before/after dispatch, Shipway cancel confirmation, refund review flag.
- Packing video, packing approval, admin status change: existing order events.
- Shipping booked: `shipping_updated`. Shipway scan/status changes and
  exceptions: verified `courier_observed` (only when observed via sync or cron).
- Customer complaint/claim: `issue_reported`. Resolution transition when
  recorded: `status_changed`.
- **Refund initiated/completed amounts cannot be asserted without verified
  refund ledger/provider records**. The system therefore labels a paid cancelled
  order as requiring refund review, never as completed automatically.
- Manual actions outside the existing database/API (e.g. courier changing
  status without a scan, external Meesho events) cannot be automatically inferred.

## Required pre-production checks (not yet executed)
1. Verify latest default `main` and production release, maintain backup and
   inspect live PostgreSQL schema; verify SQL 100-102 against an isolated DB (main's self-build capacity SQL is migration 050).
2. Run `npm run audit`, `npm run typecheck`,
   `node scripts/test-telegram-backend.mjs` and order integration regression
   tests using **dedicated local test DB only**.
3. Confirm HTTPS request routing, deploy code into a NEW release, apply migrations
   during a controlled maintenance step, then switch release atomically.
4. On the VPS only, store strong random (32+ char) secrets:
   `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_COURIER_POLL_SECRET` in
   `/var/www/celebration/shared/.env.production`. Already configured token and
   chat ID stay private; never print or commit them.
5. Register Telegram HTTPS webhook only after deployed route is verified:
   `https://shopcelebration.in/api/integrations/telegram/webhook`, using
   `secret_token=TELEGRAM_WEBHOOK_SECRET`, `allowed_updates=["message"]`.
6. Start an isolated PM2 worker running
   `node --env-file=/var/www/celebration/shared/.env.production
     /var/www/celebration/current/scripts/telegram-notification-worker.mjs`;
   supervise restarts, monitor pending outbox count, restart after new releases.
7. Optionally schedule HTTPS courier cron (5-10 min) invoking
   `scripts/telegram-courier-cron.mjs` with the shared env. Keep it off until
   Shipway traffic/rate limits are checked.
8. Test test-order notifications + paid/failed transitions + Telegram Reply
   to matching order + authenticated Customer A/Customer B isolation.
9. Only after end-to-end verification, add `My Orders` message UI and unread
   indicator using the prepared authenticated API (owner intentionally deferred UI).

## Rollback & data safety
Before production, backup DB. To stop outbound alerts, stop the standalone
Telegram PM2 worker. To stop periodic courier checks, disable cron / remove
the dedicated poll secret. Disable inbound Telegram updates with BotFather/API
webhook configuration. Do not drop message/outbox tables or revert database
migrations automatically: preserve customer message history and audit events.
Rolling back frontend release is independent of the retained additive tables.

## Explicit test limits
The **GitHub code is prepared**; sender and format fixtures have been checked
through static/manual validation. Full Next.js build, PostgreSQL migration
integration (test cases prepared but not yet run), live Shipway poll, owner Telegram webhook, end-to-end buyer
isolation, PM2 deployment and production monitoring have not yet been run.
Do NOT call this feature "live" until those checks are completed.
