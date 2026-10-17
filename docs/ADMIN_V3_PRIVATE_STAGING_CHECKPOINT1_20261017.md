# Admin V3 private staging: checkpoint 1, isolation gate

**State:** Guard code committed to the Admin V3 development branch only. **No private staging service or authenticated testing is claimed.** No production deployment/DB write, main merge or Vercel preview.

## Purpose

Before a developer starts a real `/admin/v3` staging service, run `node scripts/admin-v3-staging-preflight.mjs` in the intended staging process environment. It is read-only, fails closed, prints no configuration values, opens no network connections, and never writes to DB. Validate its refusal cases with `node scripts/admin-v3-staging-preflight.test.mjs`.

This is a **configuration sanity gate, not proof of isolation**. A human must separately verify DNS, nginx routing, DB role privileges, env-file ownership and cloud provider isolation. Do not paste any real environment file, DB password, GST, customer data or payment credentials into a GitHub issue/log.

## Required environment design (not a copy-paste production env)

- Dedicated private HTTPS hostname, for example `staging.shopcelebration.in`; `APP_BASE_URL` uses this exact origin. `ADMIN_V3_STAGING_HOST` must equal hostname, and `ADMIN_V3_STAGING=isolated`.
- HTTPS TLS and **network-level privacy** via IP allowlist/VPN/restricted authentication. `noindex` is an extra safeguard, NOT an access control. Require `NEXT_PUBLIC_SITE_INDEXABLE=false`.
- Local-only isolated Postgres database `celebration_v3_staging` with dedicated **least-privilege** role `celebration_v3_staging`, on loopback port 5432. `DATABASE_SSL_MODE=disable` is appropriate only for this loopback connection.
- Staging-only `ADMIN_SESSION_SECRET`, `ADMIN_SESSION_VERSION`, `ADMIN_PASSWORD_SCRYPT`, `TRACKING_TOKEN_SECRET`, `PASSWORD_RESET_SECRET` (where needed), generated independently of production. Never reuse production passkey credential tables or production cookies.
- First checkpoint requires all Cashfree/Razorpay, Shipway, Telegram, SMS, R2 and Redis integration credentials absent. No live webhook routing, external messaging, real shipping, provider refund or customer email. Payment mode, if supplied, must be `sandbox`; sandbox provider testing needs a **separately approved** test plan and test credentials later.
- Staging test data must be generated from synthetic users/products/orders. Do not import real customer tables, photos, addresses, phones, inventory, messages or payment tokens.
- Migration `109_admin_inventory_adjustment_history.sql` and all preceding migrations must run **only on the isolated staging database** after checking DB identity/grants, with an isolated backup/restore plan.

## Verifiable order of gates

1. **Isolation gate:** Check separate DB credentials, host, TLS, private network, noindex and disabled external credentials; then run preflight and unit test.
2. **Real browser authentication:** On staging, register a test-only passkey, verify sign-in with an independent test device, expired session, anonymous rejection and same-origin/CSRF blocking. This is NOT covered by synthetic browser screenshots.
3. **Real HTTP and DB:** Seed fixture-rich data, exercise the 10 screens and authorized operations, check duplicate stock adjustment, global catalog-draft conflicts, settings version 409, verified-review paid/delivered checks, order transitions, customer PII redaction and mobile keyboard flows. No courier booking or refunds through production providers.
4. **Evidence:** Record commit SHA, staging test fixture ID (not customer PII), browser viewport results, sanitized logs, schema version, pass/fail, rollback simulation and outstanding bugs.
5. **Release gate:** Private staging PASS and owner review are required. **No merge into main or production migration/deploy without a new explicit approval.**

## This checkpoint's result

- Guard unit tests use a safe synthetic env and deliberately reject 14 unsafe variants (production host, public indexing, prod DB, wrong role, remote DB, missing isolation marker, live integrations and Vercel).
- Source guard does **not** verify the actual HTTPS endpoint, access restrictions, WebAuthn login or database privileges. Those remain **NOT TESTED**.
- No changes to storefront, catalog, inventory, Cashfree, Shipway, Telegram, SEO, Search Console, Merchant Center or GA4. No live verification is applicable. Recheck after a genuinely isolated staging instance is provisioned.
