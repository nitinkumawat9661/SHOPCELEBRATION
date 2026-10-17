# Celebration Admin V3 — Screen 10: Settings & Security

**Recorded:** 17 October 2026 (IST)  
**Branch:** `feat/admin-v3-phase1-20261017`  
**Release state:** DEVELOPMENT BRANCH ONLY. No main merge, live VPS deployment, production database migration or customer-facing changes have been executed.

## Delivered

### Settings & legal profile

- `features/admin/v3/AdminSettingsV3.tsx`: desktop/mobile Settings & Security workspace, with three tabs:
  - **Store & Support:** WhatsApp contact, customer-care email, helper title/body and default WhatsApp message. Local helper preview and test-link.
  - **Legal & Grievance:** real registered legal/proprietor name, principal address, grievance officer designation/name/contact and compliance-completeness warning.
  - **Security & Passkeys:** verified current passkey session, aggregate registered credential count, optional additional backup passkey registration, and explicit recovery limits.
- Existing store settings schema and normalizer used; no replacement of public support/content contract.
- Original field values loaded from `GET /api/admin/store-settings/v3`, which requires existing passkey-authenticated admin server gate.
- V3 publish button requires an explicit summary/confirmation. Dirty state remains local until a successful full settings write, and protects sidebar/logout/browser navigation.
- **New V3-only atomic version check**: `saveStoreSettingsVersioned(input, expectedVersion)` performs SQL `UPDATE ... WHERE version = $2 RETURNING`. If the version changed, result is HTTP 409 and user must reload/resolve; this includes concurrent writes from existing V2, since the V2 save increments the shared published version. Reuses existing normalization and invalidates public store-settings cache.
- Original V2 `saveStoreSettings()` and `AdminStoreSettings` remain unchanged, so V2 retains existing behaviour; V3's version guard does **not** turn V2 into a compare-and-swap system. The V2 writer can still overwrite another V2 writer. Before production rollout with multiple admins, consider upgrading V2 as a separate reviewed compatibility change.

### Security controls

- `GET /api/admin/security/v3` requires a verified **passkey session**, returns **only** count, method and capability flags. Never returns credential IDs, public keys, user handle, session cookies, hashes or environment secrets.
- `AdminSettingsV3` registers additional backup passkeys using original `/api/admin/passkeys/register/options` and `/api/admin/passkeys/register/verify` WebAuthn flows. Admin session, rate limit, same-origin, challenge verification and passkey storage remain in the original endpoints, not duplicated.
- **No passkey deletion/revocation, self-service recovery, bypass, password fallback, secret management, Telegram control, database config or Cashfree/Shipway key access** has been added.
- Losing all passkeys still requires operator-verified, server-side recovery. Backup enrollment should be attempted and verified on a second device; passkey count is not distinct-device count.
- All V3-specific sensitive API responses use `Cache-Control: private, no-store`; writes enforce same origin, rate limits and the existing security session gate.

### Navigation, styling & tests

- Activated `Settings` (Screen 10) in `AdminDashboardV3`, marking the **ten top-level screens** now represented as real components rather than placeholders.
- Added unsaved-settings navigation and logout confirmation in desktop/mobile V3 shell.
- Added responsive `styles/admin-v3-settings.css`, imported only in protected `/admin/v3`.
- Added `scripts/test-admin-v3-settings.mjs`: TSX syntax and source-contract checks for auth, optimistic version, WebAuthn reuse, absence of credentials/secrets and no-deploy safeguards. **Committed but not executed against a checked-out project yet.**

## Limitations and outstanding work

- **Do not mistake this milestone for finished production QA.** All ten screen components are now coded; runtime build, database integration and browser verification are still required. The initial Dashboard may still need iteration and shared editor interactions need QA.
- Public legal profile values originate in the actual existing DB and require owner's factual/legal verification; no legal/registration values were fabricated or written.
- No email verification, provider credential rotation UI, cookie/session inventory, audit events for security status reads, WebAuthn revoke, login notification or emergency account recovery form was added.
- Store settings have a single published record and no separate persisted staging draft; V3's React edits are ephemeral until published.
- A successful DB write can commit before cache invalidation; verify cache-outage behaviour in staging. Existing V2 uses same invalidate-after-write pattern.
- All previous Admin V3 milestone source tests were created on the development branch. They have NOT all been run. The repository's full typecheck, Next build and staging smoke tests remain unverified.
- Vercel preview auto-deploy was stopped/previous preview project removed separately; this milestone did not create or deploy a Vercel project.

## Mandatory test and release gate

On an isolated checkout, NOT connected to the production database:

```bash
npm ci
node scripts/test-admin-v3-phase1.mjs
node scripts/test-admin-v3-phase2.mjs
node scripts/test-admin-v3-functional-integration.mjs
node scripts/test-admin-v3-inventory.mjs
node scripts/test-admin-v3-hampers.mjs
node scripts/test-admin-v3-offers.mjs
node scripts/test-admin-v3-customers.mjs
node scripts/test-admin-v3-analytics.mjs
node scripts/test-admin-v3-reviews.mjs
node scripts/test-admin-v3-settings.mjs
npm run typecheck
npm run audit
npm run build
```

Staging acceptance cases:
1. Anonymous and expired admin sessions cannot load `/admin/v3`, `/api/admin/store-settings/v3` or `/api/admin/security/v3`.
2. Verify V3 successfully retrieves actual store settings version and full public fields, while GET reports are private no-store and do not expose secrets.
3. Edit a support field, navigate/reload without save: warning; original live values unchanged. Edit and confirm Publish: DB version increment exactly once; public content/cache updated.
4. Two concurrent V3 editors with same expected version: only the first update succeeds, second receives 409 and remains dirty. An intervening V2 save also invalidates a stale V3 version.
5. Invalid phone/email length or unsafe text is rejected by existing normalizer. Test missing/incomplete grievance details warning without inventing legal facts.
6. Passkey count is available to the authenticated passkey session only. Verify no credential IDs/session secrets in response/network payload.
7. Register a second passkey on a separately controlled device using original WebAuthn challenge flow. Verify both can log in individually. Do not intentionally revoke current access or break production bootstrap.
8. Browser 320/390/768/1440px, keyboard/focus, multi-tab edits, error recovery, expired session, and old `/admin` regression.
9. Run cross-screen order status, Shipway, Cashfree, Telegram, stock reservation, product draft/publish and Self-Build-disabled checkout regression in staging.
10. Owner verifies all public legal contact content and signs off before any eventual live publish or deployment.

## Operations status

- **GitHub development branch:** updated with Settings V3 source, API, styling, tests and this note.
- **Live VPS / customer website:** unchanged.
- **Production DB / secrets:** unchanged.
- **Vercel:** no deployment initiated.
- **Search Console, Merchant Center, GA4:** no public change to verify yet.
- **Next milestone:** integrated audit of all ten screens; run TypeScript/build and staging browser/DB checks; fix any failures; request separate production deployment approval. Do not merge into main automatically.
