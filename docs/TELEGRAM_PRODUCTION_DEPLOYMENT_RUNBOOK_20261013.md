# Celebration Telegram System — Safe Developer Execution Runbook

**Date:** 13 October 2026. **Read first:** TELEGRAM_ORDER_SYSTEM_COMPLETE_HANDOFF_20261013.md. This runbook is for a developer operating on VPS, PostgreSQL, Next.js and GitHub with owner authorization. The feature is **not live**. Never copy commands blindly into production; validate the actual state, repository SHA and DB identity on each phase.

## Definition of done

The Celebration owner receives event-accurate Telegram alerts from new orders (including pending payment), can press Reply on any actual bot order notification, and only the authenticated buyer of that precise order sees that reply in a compact accessible My Orders panel with correct unread/read behavior. No storefront/payment/courier regression, no leaked secrets, current Self-Build staging work retained, live smoke verified and rollback path documented.

## Phase 0 — Inventory, guardrails (read-only)

- Branch: feat/telegram-order-messages; latest feature at documentation time f589a91cfd30. Current main and active release at last check a386af17d692 (may have advanced).
- Read GitHub main and feature SHAs, commit graph, migration filenames, application account order card, API contracts and backend handoff.
- SSH: verify PM2 celebration-site working directory / process status, /var/www/celebration/current target symlink, writable /var/www/celebration/releases, disk and memory.
- Query production schema_migrations **READ ONLY**. Only migration 050_self_build_category_capacity_and_tier_allowances.sql was explicitly verified in a prior read; migration 051 status is UNKNOWN until queried again. Avoid assuming site SHA proves DB migration state.
- Verify the shared env at /var/www/celebration/shared/.env.production has strict permissions 0600 and required variables by checking presence ONLY. Never print or paste token, URL with credentials, passwords or secrets. Keep optional TELEGRAM_COURIER_POLL_SECRET unset/off until approved.
- Identify real Nginx upstream/site port, PM2 startup, current symlink strategy and existing deploy script before any cutover.
- Stop and investigate if source tree is dirty, active release is newer than source, migrations names conflict, backups do not restore, or current site is already unhealthy.

## Phase 1 — Integrate code and UI on isolated feature branch

1. Fetch current origin/main into the separate test clone at /home/nitin/celebration-telegram-test. Work only on feat/telegram-order-messages. Merge most recent main; preserve newer Self-Build order/draft/private photo/reservation code, database migration 051 and code/tests added to main. Resolve conflicts with domain tests; do not just accept ours blindly.
2. Keep Telegram migrations numbered 100_telegram_notification_outbox.sql, 101_telegram_order_messaging_and_courier.sql and 102_telegram_courier_watch.sql. Do not renumber to 050–052. Confirm no other 100–102 collisions.
3. Implement Messages from Celebration per-order foldout on features/account/CustomerAccountPage.tsx, preferably extracted into a small child component. Fetch GET /api/account/orders/{publicId}/messages only with an authenticated session and cache no-store, render as plain text, show unread count, handle errors/empty states, timestamp in IST, read acknowledgements via POST only after content successfully renders. Keep all existing controls intact. No customer chat composer.
4. Ensure unread indicators work without excessive per-order polling: bounded lazy loading and explicit refresh or a secure aggregated count endpoint scoped to logged-in customer's own orders. Do not leak messages into generic order list, tracking, admin, R2, source maps or static output.
5. Create tests covering auth, no-store, same-origin, replay, owner-to-customer order mapping, account switch/logout, mobile/desktop visual UX, no internal budget leakage. Audit new main checkout/payment events and ensure triggers cover all new order creations safely.
6. Commit only expected files and update documentation checklist with actual SHA/test results; push feature branch safely. Do not merge to main until review and CI pass.

## Phase 2 — Isolation tests and compatibility

- Static: run npm run check and node scripts/test-telegram-backend.mjs. Fix failures rather than bypassing checks.
- Build: NEXT_TELEMETRY_DISABLED=1 npm run build and verify .next/BUILD_ID. Must run **after** merge/UI, not rely on old f589 build.
- DB integration: scripts/test-order-integration.mjs DESTRUCTIVELY RESETS public schema, but is hard-guarded to loopback database celebration_individual_test only. Use TEST_DATABASE_URL pointing precisely there with the test role credential, passed through environment without history; never run on production celebration DB. Coordinate with any other test suite using this disposable DB.
- Any newer Self-Build draft/reservation DB regression scripts must run on their own allowed test DB and be checked for destructive behavior before execution; do not execute them blindly on production.
- Download/copy newest actual production pg_dump custom archive into a disposable DB (not production), restore, run all **unapplied** migration SQL including feature 100–102, verify 4 Telegram tables/3 triggers and original order count. Ensure prior 050/051 migration history compatible with latest main.
- Gate: all unit/static/DB tests green, 320/390/768/desktop browser tests green, no live-state or credential leakage. Failed gate => no production rollout.

## Phase 3 — Fresh backup / safe production release

- Record actual live commit, active PM2 working dir, symlink target, main SHA, and schema_migrations before action. If current main advanced during work, integrate again.
- Create fresh pg_dump -Fc to new timestamped file in /home/nitin/celebration-db-backups, mode 0600; validate with pg_restore --list and disposable restore. The previously tested 20261013T082636Z archive is historical and may not include new 051.
- Inspect existing live release deployment conventions. Prepare a **new** versioned release from the post-merge reviewed SHA, not /var/www/celebration/releases/telegram-f589a91cfd30. Install with npm ci, run checks and build there; keep current release untouched as immediate app rollback.
- Carefully calculate exact pending migrations from DB history and repo. Only execute verified, transactional additive migrations; be alert for newly added 052/053/main changes. Prevent accidental duplicate application and do not edit old applied files. Record results.
- Arrange controlled switch of active release (symlink + appropriate PM2 update/restart) with a short monitored maintenance window. Keep old release and verified DB backup. Test Nginx/Next health, homepage, account/login, My Orders, admin orders, product/cart, gateway initiation/return and courier tracking.
- If anything critical fails, revert the app to saved prior PM2 release/symlink and disable Telegram worker/webhook; leave additive DB tables intact. Do not restore backup over live DB as an automatic rollback (would discard new orders).

## Phase 4 — Telegram webhook + worker, after healthy app+DB

- Reverify private env presence only: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, TELEGRAM_WEBHOOK_SECRET, DATABASE_URL; check role/owner correct privately. Generated webhook secret exists on VPS; do not rotate unnecessarily.
- Verify webhook endpoint securely accepts only correct secret header and private owner ID. Do not make publicly visible test logs with webhook secrets. Ensure Nginx allows POST and Next route is healthy.
- Use Telegram Bot API setWebhook with HTTPS URL https://shopcelebration.in/api/integrations/telegram/webhook, secret_token loaded from server env only and allowed_updates containing message. Do not expose the API token in process arguments, history or access logs. Check getWebhookInfo for intended URL and delivery errors.
- Start exactly **one** PM2-supervised process running scripts/telegram-notification-worker.mjs with explicit server-only environment loaded from /var/www/celebration/shared/.env.production. Use stable release path aligned to the deployed code and document PM2 status/startup/restart persistence. Its DB user must have intended outbox access. Handle clean stop and retry monitoring.
- Optional Shipway courier poll remains OFF by default: no cron registration and no extra secret configuration without owner approval.
- Verify Telegram queue count, retries, last_error and successfully sent notifications via redacted aggregations. Never log customer PII or Bot API endpoint containing the token. Failure of Telegram service must not block checkout or customer order updates.

## Phase 5 — Real end-to-end acceptance

Use only owner-authorized test accounts/orders and a safe test/sandbox payment path. Record PASS/FAIL for each:

1. Create a new unpaid order: a correctly labeled NEW ORDER alert reaches the configured private Telegram owner; product, totals and pending payment reflect the event, not a later state.
2. Record verified payment/failed transition only through an authorized test path: corresponding truthful separate alert. Never fabricate provider capture, refunds or delivery.
3. Reply in Telegram directly to that order's bot message: stores exactly one owner message mapped to correct order; no reliance on typed order ID.
4. Login buyer A: that exact order's Messages from Celebration displays the reply, correct timestamp/unread badge; opening and ack clears badge after successful load.
5. Login buyer B and access buyer A's public ID: no message data disclosed; owner B cannot ack A's messages. Test cross-order isolation for A as well.
6. Replay same webhook update and text reply to an unknown notification: no duplicates and no wrong-customer delivery. Inbound unauthorized chat/user/header denied.
7. Mobile 320px, 390px, tablet, desktop: accordion doesn't disturb compact courier timeline, paging/card geometry, packing/cancel/payment actions; keyboard and screen reader labels present.
8. Existing storefront, jewellery, curated hampers, admin/orders, shipping/Shipway and payment retry paths unchanged; Self-Build customer checkout remains disabled.
9. Worker restart/queue transient failures handled, no duplicate worker process, webhook configured, logging redacted.

## Phase 6 — Closure report

Developer must report:
- source branch + merge/production commit SHA and whether main merged;
- exact list of changed/added files and screenshots of customer order messages UX;
- npm check, telegram tests, latest isolated PostgreSQL test and build results;
- production applied migrations list, newest backup location and test-restore results (never credentials);
- released directory, previous rollback directory, PM2 health and webhook check;
- successful test notification and Telegram Reply -> buyer A message, buyer B denied, unread/ack;
- remaining limitations (such as optional courier polling OFF, crash window of at-least-once owner alerts).
- If deployment is blocked, stop and deliver the specific blocker and safe last-known working state; don't claim work finished.

## Safety quick reference

- PROD DB: celebration. Test DB ONLY: celebration_individual_test, loopback host; integration script drops its entire public schema. Never execute tests against prod.
- Production env: /var/www/celebration/shared/.env.production (0600). Do not cat/print.
- Old archived source release: /var/www/celebration/releases/telegram-f589a91cfd30 (not production-ready).
- Latest observed active release before this handoff: /var/www/celebration/releases/github-a386af17d692 (verify current).
- Historical verified backup: /home/nitin/celebration-db-backups/celebration-before-telegram-20261013T082636Z.dump (restore-tested, 14 orders at snapshot).
- Do not ever force-push main, DROP production schema, disable customer/account permissions, auto-refund orders, remove retail stock reservations, or enable Self-Build checkout merely to finish Telegram.
