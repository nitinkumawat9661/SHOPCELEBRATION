# Celebration Telegram Order Alerts & Customer Messages — Complete Handoff

**As of 13 October 2026 (IST).** Repository: nitinkumawat9661/SHOPCELEBRATION. Implementation branch: feat/telegram-order-messages. Last tested feature commit: f589a91cfd300d846dd706747bba69ae4639a956. Latest observed main and live website release: a386af17d6920a42cd26dcbd83a73cb2ab53377d. The main branch/production can advance at any time; verify the current heads before doing work.

**STATUS: BACKEND TESTED, NOT LIVE.** Do NOT deploy the old prepared release as-is. The customer message UI, merge with latest main, fresh tests, production migration, PM2 worker, Telegram webhook and live end-to-end proof remain pending.

## Implementation update (13 October 2026, PR #149)

- Production main `a386af17d692` was incorporated into the Telegram feature via two-parent merge commit `4860b631245d`, with all Self-Build 051 files preserved and no overlapping path conflicts. No production code was switched by the merge.
- Customer My Orders now has a compact per-order Messages from Celebration panel, a bounded account-only unread summary endpoint, IST timestamps, plain-text rendering, read acknowledgment after the panel displays messages, and account-switch isolation; no customer message composer.
- Added `scripts/test-telegram-customer-ui.mjs` to `npm run audit`, plus PR-only PostgreSQL 16 integration workflow. GitHub PR #149 initially passed TypeScript, full source audits, Next.js build and real isolated PostgreSQL tests (orders/payment/Telegram).
- Read-only VPS preflight confirmed running release `github-a386af17d692`, PM2 site online, private env mode 0600, migration 051 applied, 14 existing orders and Telegram tables not yet installed.
- A **new production backup** was created on VPS at `/home/nitin/celebration-db-backups/celebration-before-telegram-20261013T093639Z.dump`. Archive list validation passed. A restore into a separate unprivileged local PostgreSQL server on a private UNIX socket successfully applied Telegram SQL migrations 100–102, retained all 14 orders and cleaned up the isolated server.
- PR includes a safer deployment workflow switch to preserve existing category photos by default, plus an automatic post-deploy webhook/PM2 activation workflow. These workflow changes remain **not deployed** until the draft PR passes final checks and merges.
- **Still pending:** final CI on any subsequent branch commits, current production pre-cutover verification, controlled production deployment/migrations, webhook and worker live health, actual owner Telegram reply, and customer A/B browser E2E. Never report the feature as live until observed.

## 1. Approved behavior

- Alert the owner via Telegram for every newly created order, including unpaid orders, and for genuine recorded payment changes, packing, status changes, cancellation, courier events, delivery and customer issues.
- Show true state at event time, not a later paid/delivered state; do not claim an unverified refund completed. External Meesho actions or manual courier actions not recorded in the platform cannot be inferred.
- Owner privately REPLIES to the original Telegram bot notification, and that text is stored against the exact corresponding order using the sent bot Telegram message ID. Never determine the target order by parsing typed text.
- The signed-in owner of that order sees the response in My Account -> My Orders -> Messages from Celebration. Other orders/accounts do not see it. No customer-to-Telegram chat input is authorized.
- Preserve existing jewelry, curated hamper, My Orders, WhatsApp, cancellation, packing, payment, courier, and Self-Build staging functionality. Do not turn on Self-Build customer checkout.

## 2. Existing feature-branch implementation

| Component | Repo path | What exists |
| --- | --- | --- |
| Durable transactional order/payment outbox | db/migrations/100_telegram_notification_outbox.sql | Adds Telegram queue on new order/payment events; no legacy order backfill |
| State snapshots, owner replies, courier dedup | db/migrations/101_telegram_order_messaging_and_courier.sql | Payment transition trigger; event-time financial/status snapshot; per-order text replies and unique Telegram update IDs |
| Optional courier state | db/migrations/102_telegram_courier_watch.sql | Independent polling state; does not itself enable cron |
| Telegram sender process | scripts/telegram-notification-worker.mjs | Separate PostgreSQL worker, 5-item batches, retries, owner-only formatted messages |
| Inbound Telegram webhook | app/api/integrations/telegram/webhook/route.ts | Secret-header validation, owner from/chat verification, private messages only, linked reply-to ID |
| Private service | lib/server/telegram-order-messages.ts | Telegram reply/order association; unique updates; customer ownership and read-ack |
| Customer GET + read-ack API | app/api/account/orders/[publicId]/messages/route.ts | Session-scoped latest 100 messages, unreadCount and same-origin POST acknowledgement |
| Courier observation integration | lib/server/orders/courier-observations.ts, lib/server/orders/courier-sync.ts | Records real deduplicated Shipway scans without changing business flow on failure |
| Optional courier poll | app/api/integrations/telegram/courier-poll/route.ts, scripts/telegram-courier-cron.mjs | Disabled unless a private separate secret/schedule is configured; max 3 shipments per call |
| Centralized private config | config/env.ts | Telegram bot token, admin chat ID, webhook secret, optional poll secret |
| Tests | scripts/test-telegram-backend.mjs, scripts/test-order-integration.mjs | Static/formatter/privacy and real isolated PostgreSQL tests |

**Important UI fact:** The current feature-branch features/account/CustomerAccountPage.tsx displays the existing order cards, order status, courier tracking, packing video/approval, cancellation and WhatsApp, but DOES NOT currently fetch or render the messages API. UI is unfinished. Do not claim only deployment remains.

### Precise API contract

GET /api/account/orders/{publicId}/messages (URL-encode publicId): authenticated buyer only, returns 401 unauthenticated / 404 missing-or-not-owned / 503 DB error. Success response:

~~~json
{
  "ok": true,
  "orderId": "order-public-id",
  "messages": [
    { "id": "uuid", "sender": "celebration_support", "body": "message text", "sentAt": "ISO timestamp", "readAt": null }
  ],
  "unreadCount": 1
}
~~~

POST same URL: same-origin, authenticated, rate-limited read acknowledgement, returning success with acknowledged count. No endpoint exists for customer message submission. Responses must remain private/no-store. Backend message limit is 1–2000 plain-text characters, last 100 stored messages shown per query.

Inbound Telegram webhook URL: https://shopcelebration.in/api/integrations/telegram/webhook . Telegram must present the X-Telegram-Bot-Api-Secret-Token header, in a private chat whose chat ID and sender ID match the configured owner; text must REPLY TO the original, successfully sent bot notification, not a free-form text order ID. Unmatched replies are rejected and the owner gets a not-delivered warning.

## 3. Exact completed verification — 13 October

- Feature-branch npm run check and node scripts/test-telegram-backend.mjs both PASSED. TypeScript, security/customer-surface, storefront, Self-Build capacity, checkout, payments, shipping and Telegram formatter/source audits passed. Latest combined check after importing capacity code included Telegram source-test success.
- Actual PostgreSQL order integration PASSED on the **disposable loopback-only** database celebration_individual_test, including new unpaid snapshots, paid changes, owner reply mapping, webhook replay dedup, customer A/B isolation, read-ack and existing checkout/payment regressions. Output: TELEGRAM_POSTGRES_CHECKS_PASSED and REAL_POSTGRES_CHECKS_PASSED. **Warning:** the runner DROPS SCHEMA public CASCADE only within this explicitly named local test DB. Never run against celebration or any other DB.
- Standalone Next production build on then-current feature head PASSED: FINAL_COMBINED_PRODUCTION_BUILD: PASSED. This must be repeated after merging newer main/UI.
- Fresh custom PostgreSQL archive: /home/nitin/celebration-db-backups/celebration-before-telegram-20261013T082636Z.dump ; 286577 bytes; pg_restore --list passed. Backup restored to disposable DB, RESTORED_ORDERS=14; Telegram SQL migrations 100–102 applied in one test transaction, 4 Telegram tables + 3 triggers verified, temporary DB cleaned. Output TELEGRAM_MIGRATION_CHECK: PASSED. Production DB untouched by this verification.
- The env file /var/www/celebration/shared/.env.production had permissions 0600, and BOT_TOKEN, ADMIN_CHAT_ID, WEBHOOK_SECRET (48 characters), DATABASE_URL presence checks passed. Do NOT print or commit any secret; optional courier poll secret not verified.
- PM2 celebration-site was observed online, with /var/www/celebration/current as a symlink. Latest reported active release /var/www/celebration/releases/github-a386af17d692.
- Created source-only, NOT BUILT/ACTIVATED new directory /var/www/celebration/releases/telegram-f589a91cfd30. Do not deploy this stale release; replace by a new release built from latest merged code.
- Telegram migrations are NOT reported as applied to production; NO Telegram webhook/worker/real Telegram test was performed.

## 4. Critical merge and migrations

- Feature f589a91 already contains the earlier Self-Build capacity changes (main through e30a47e8b1ae) and migration 050_self_build_category_capacity_and_tier_allowances.sql.
- The newer main a386af17 contains further account drafts, private photos and reservations, admin/order changes, and migration 051_self_build_account_drafts_photos_and_reservations.sql. Merge the **latest** main (which may be newer again) before final implementation/deploy.
- Keep Telegram migrations numbered **100, 101, 102** to avoid 050/051 collisions; check every actual schema_migrations entry and pending filename before any DB write. Never edit an already-applied migration in place or rerun it.
- Self-Build shopper checkout is deliberately disabled; do not enable it or map its category selections to retail jewelry SKUs. Keep customer-private photo object keys and internal allowance/budget out of public order JSON, pages and Telegram client UI.
- Verify compatibility with newest create-order, gateway payment/cancel, shipment, Self-Build operations and package-script changes. The tests and build done earlier do NOT cover the newer main a386 or later.

## 5. Work remaining, in order

1. Read current repo/main, feature branch, production PM2/symlink, and production migration history. Merge current main into feature branch, fix conflicts without losing main work. Push updated feature branch via authorized GitHub access, not password authentication. Do not force push main.
2. Implement minimal per-order message panel in features/account/CustomerAccountPage.tsx or an extracted component: collapsible Messages from Celebration, accurate unread indicator, local IST timestamp, loading/empty/error states and retry, accessible keyboard focus/aria-expanded, mobile 320/390/768 and desktop. Reuse site typography/colors; keep card compact; no generic customer chat composer. Fetch only buyer-owned order messages with cache no-store. Acknowledge AFTER successful display. Handle account changes/logouts, stale requests and an order being removed. Unread badge must refresh meaningfully without unbounded polling of all orders; add a safe bounded batch unread API if required, with full access checks.
3. Add source, UI, test DB and browser tests for unknown order, Account A vs B, update replay, nonreply Telegram text, malformed webhook, read-ack, network failure, pending/paid transitions, non-HTML output, 100-message cap, and responsive behavior. Ensure no changes to existing order/checkout/payment/cancel/packing/Shipway routes.
4. Rerun npm run check, node scripts/test-telegram-backend.mjs, and carefully scoped database tests on celebration_individual_test only; run npm run build on combined latest code. Review schema diffs on a new isolated restored DB, especially the newer 051 migration. No shortcuts.
5. Before any production write: fresh pg_dump -Fc backup AFTER latest production changes, list/test restore, inspect production running release and actual applied migrations including 051. Existing backup from 08:26 UTC may predate 051 and therefore is not the final rollout backup.
6. Prepare a brand-new versioned release in /var/www/celebration/releases based on the merged tested SHA; npm ci with lockfile, check, build, healthy deployment configuration and shared env kept at 0600. Don't reuse the stale telegram-f589a91cfd30 source-only directory.
7. Coordinate brief safe cutover and transactional migration 100–102 after checking pending migrations; switch symlink and PM2 using existing live conventions; verify /api/health, storefront, login, My Orders, cart/payment, admin orders and tracking. Keep old release as rollback, and do not remove the additive Telegram tables during app rollback.
8. After code+DB are live, register the Telegram HTTPS webhook with the private server-side token/secret without logging URLs containing secrets. Start ONE separately supervised PM2 Telegram worker (with private env); verify webhook details, worker retries, queue and no duplicate running worker.
9. Run authorized non-destructive real E2E: new unpaid test order -> Telegram owner alert; payment change verified with test/sandbox procedure -> subsequent alert; owner Telegram Reply to original order bot notification -> correct customer's My Orders panel and unread badge; unrelated account/order cannot view it; read acknowledgement works; no token leaks. Never run unauthorized real paid test purchases.
10. Leave optional Shipway cron polling OFF unless owner specifically approves and provider limits are reviewed. Provide written completion report with SHAs, backup path, migration output, PM2 status, webhook check (no credentials), positive/negative customer privacy tests, observed errors and rollback route.

## 6. Security, risk and non-goals

- Only Telegram owner can initiate messages; customer ownership is verified by session account ID, NOT by public order ID alone. No unauthenticated customer message read or mark-as-read.
- Keep webhook secret constant-time verified; private-only Telegram from/chat validation; do not expose server credentials to browser. Ensure full message text is escaped when rendered.
- Existing outbox worker can deliver an owner alert twice if it crashes after Telegram accepted the message but before its DB commit. Do not claim exactly-once network delivery; dedup inbound updates and monitor the queue.
- Keep existing PM2 app, earlier releases, database and orders intact until smoke tests pass; prohibit destructive production DB test/restore/schema reset, branch force-push, credential printing, customer data exports and unreviewed payment/refund behavior.
- New events are queued only AFTER triggers are installed; do not promise retroactive Telegram notifications for the existing 14 orders in an earlier backup.

## 7. Signoff checklist

- [x] Backend services, SQL 100–102, worker, webhook, customer API and optional poll implementation present on feature branch.
- [x] Security/TypeScript checks, isolated PostgreSQL integration and feature-only production build passed.
- [x] Migration 100–102 restore smoke on earlier production snapshot passed; old orders preserved.
- [x] Owner Telegram credentials presence checked securely.
- [x] Source-only obsolete release staged without cutting over production.
- [ ] Merge feature with latest production main, retaining migration 051 and newer changes.
- [ ] Customer My Orders messages panel and unread indicator implemented and tested.
- [ ] New combined tests, current-schema PostgreSQL restore test and production build passed.
- [ ] New verified backup after newest production migration created and restore tested.
- [ ] Fresh built release deployed and migrations 100–102 applied/verified.
- [ ] Webhook registered, one separate Telegram worker running and monitored.
- [ ] Real owner notification, actual reply-to routing, A/B privacy and mobile UX verified.
- [ ] Owner receives deployment SHA, tests, smoke status and safe rollback instructions.

Related documents: TELEGRAM_ORDER_BACKEND_HANDOFF_20261013.md (original backend design), TELEGRAM_PRODUCTION_DEPLOYMENT_RUNBOOK_20261013.md (execution plan).
