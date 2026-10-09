# Celebration — Production Handoff & Continuation Plan

> **Purpose:** This is the single handoff document for continuing Celebration without relying on chat history. It records the product goal, architecture, deployment topology, implemented features, UI/UX/motion decisions, performance findings, current Git state, safety rules, remaining work, acceptance criteria, and exact continuation order.
>
> **Snapshot date:** 2026-09-25 (India time)
>
> **Rule:** Never put runtime secrets, private keys, tokens, passwords, UPI credentials, database credentials, or `.env` contents in this document or in Git.

---

## 1. Product goal

Celebration is a mobile-first custom gift-hamper ecommerce experience. The storefront should feel premium, simple, emotional and trustworthy while keeping the buying flow obvious:

1. pick an occasion,
2. pick a budget,
3. choose gifts,
4. add delivery details,
5. pay,
6. receive packing proof / approve where applicable,
7. track the order.

Brand:

- **Name:** Celebration
- **Tagline:** `Mharo Surprise, Thari Smile.`
- **Domain:** `shopcelebration.in`
- **Primary audience:** mobile shoppers; student/young buyer use cases are important, but the site should not look niche or cheap.
- **Visual direction:** premium warm maroon/cream/peach, clean typography, restrained editorial italic accents, strong mobile ergonomics.

The site must never become an “animation demo”. Product clarity, trust, speed and conversion are more important than decorative motion.

---

## 2. Source of truth / repository topology

### Private source-of-truth repository

`nitinkumawat9661/SHOPCELEBRATION`

- visibility: **private**
- default branch: `main`
- app lives at the **repository root** (not inside `celebration-site/`)
- this repository is the intended long-term source of truth.

### Historical/public deployment bridge

`nitinkumawat9661/trustfirst-client-portal`

Celebration historically lived under:

`celebration-site/`

This public repo was temporarily retained as a CI/deployment bridge because it already had functioning GitHub Actions → SSH → VPS connectivity while private Actions capacity was blocked/exhausted.

**Important:** Do not delete the public bridge until private CI/deployment is proven end-to-end. Deleting `celebration-site/` from the current branch also does **not** remove historical public Git objects. Historical source removal would require a separate destructive history rewrite and must be treated as an independent operation.

---

## 3. Current private Git state

At this handoff snapshot:

- `SHOPCELEBRATION/main` HEAD: `6a77336a1b5e0f4ed193f19eb095a0c780464c5a`
- latest commit message: `ui: clean mobile header and support controls`
- recent main history also contains:
  - `e8a13d16b04da77e2fb124b5caa533b66cc7564d` — `seo: keep Celebration production storefront crawlable`
  - `bb8a2c828a5ab3db40ceed0fb597e799bc198388` — `seo: make production storefront indexable by default`
  - `1d4761d071cb4dc16b89add9ad70d63c7f7cdd9d` — `perf: keep initial storefront hydration above the fold`

The old working branch:

`perf/mobile-hero-marquee`

currently points at `1d4761d071cb4dc16b89add9ad70d63c7f7cdd9d` and is **behind `main` by three commits**. It must not be treated as newer than `main`.

Before doing new work, branch from current `main` unless intentionally inspecting an older experiment.

---

## 4. Runtime / deployment topology

Production app infrastructure:

- app root: `/var/www/celebration`
- immutable releases: `/var/www/celebration/releases/github-<shortsha>`
- active release: `/var/www/celebration/current` symlink
- shared production env: `/var/www/celebration/shared/.env.production`
- each release symlinks `.env.production` to the shared env
- process manager: **PM2**
- PM2 app: `celebration-site`
- PM2 home: `/home/nitin/.pm2`
- runtime user: `nitin`
- Next.js port: `3040`
- Nginx domains:
  - `shopcelebration.in`
  - `www.shopcelebration.in`
- Nginx upstream: `127.0.0.1:3040`
- health endpoint: `https://shopcelebration.in/api/health`

Deployment design is intentionally rollback-safe:

1. create immutable release,
2. attach shared env,
3. install / audit / typecheck / build,
4. run DB migration,
5. start/restart PM2 against candidate release,
6. verify loopback health,
7. atomically switch `current`,
8. verify public health,
9. rollback if health fails.

Do not replace this with in-place edits inside `/var/www/celebration/current`.

---

## 5. Tech stack

Current application baseline:

- Next.js **16.3.5**
- React **19.3.0**
- React DOM **19.3.0**
- TypeScript **5.8.3**
- PostgreSQL via `pg` **8.16.3**
- AWS SDK S3 client **3.1137.0**
- AWS S3 presigner **3.1137.0**
- Node engine: `>=20.9.0`
- production runtime/deploy currently uses modern Node; validation has been run with Node 24.

Important scripts:

- `npm run build`
- `npm run typecheck`
- `npm audit --omit=dev`
- `npm run audit`
- `npm run db:migrate`
- `npm run config:check`
- `npm run test:domain`

`npm run audit` chains custom source, import, duplicate-import, syntax, config and domain checks.

---

## 6. Environment / secrets rules

Runtime env files are intentionally not committed.

Never commit:

- `.env`
- `.env.local`
- `.env.production`
- `.env.development`
- environment-specific secret variants
- SSH private keys
- database passwords
- R2 credentials
- signing/session secrets
- payment secrets

Private production deploy workflow expects these GitHub Actions secret names:

- `VPS_HOST`
- `VPS_PORT`
- `VPS_USER`
- `VPS_SSH_PRIVATE_KEY`
- `VPS_KNOWN_HOSTS`

GitHub secrets are write-only and must not be copied into documentation.

---

## 7. Customer storefront features already implemented

The application is substantially beyond a static landing page. Important implemented customer functions include:

### Storefront discovery

- responsive mobile-first storefront
- occasion selection
- budget tiers
- recommended/default tier handling
- product categories
- product cards and selection UX
- dynamic catalog data
- custom request section
- trust/promise sections
- conversion-focused CTA sections

### Hamper builder

Four-stage builder:

1. Budget
2. Gifts
3. Delivery
4. Payment

Includes state persistence/flow behavior, validation, budget/product constraints and summary information.

### Checkout / payment

- prepaid customized-order flow
- UPI payment flow
- transaction reference / UTR entry
- order placement
- policy consent
- confirmation UX

### Customer account / tracking

- customer signup/login/session
- account order view
- public/order tracking flow
- order lookup
- packing-video state
- packing approval where applicable
- shipping/tracking state
- issue reporting for wrong/damaged/defective/missing items

### Support / conversion

- WhatsApp support path
- custom request form
- user-facing UX messenger/toasts
- conversion event tracking hooks

---

## 8. Admin / catalog features already implemented

Admin side includes substantial operational functionality.

### Catalog management

The catalog is DB-backed at runtime. Static catalog JSON is bootstrap/fallback, not the intended live editing source.

Admin catalog supports a Draft → Preview → Publish workflow.

Migration:

`db/migrations/006_catalog_draft_publish.sql`

Important server functions include:

- `getCatalogAdminState()`
- `saveCatalogDraft(input, expectedVersion)`
- `discardCatalogDraft(expectedVersion)`
- `publishCatalogDraft(expectedVersion)`

Concurrency/version errors include:

- `CATALOG_VERSION_CONFLICT`
- `DRAFT_OUTDATED`
- `DRAFT_NOT_FOUND`

Admin APIs include:

- `GET/PATCH/DELETE /api/admin/catalog`
- `POST /api/admin/catalog/publish`
- catalog history
- image management

Preview page:

`/admin/catalog-preview`

Public catalog remains live-only while a draft exists.

### Revision history / rollback

Catalog revision history exists. Rollback is append-only in effect: it restores an older snapshot as a **new current version**, rather than erasing history.

### Product images

Private object storage workflow exists for product/catalog images with server-side validation. Supported image types include JPG/PNG/WebP with an upload size cap. Public delivery goes through application endpoints instead of exposing private storage directly.

### Operations

Admin APIs/features also include:

- orders
- status updates
- packing video
- shipping information
- custom requests
- campaigns
- analytics
- store settings

---

## 9. Security posture already implemented

Current design includes multiple defense layers:

- secure admin session cookie
- customer session
- same-origin protection on writes
- DB-backed / request rate limiting
- parameterized PostgreSQL queries
- signed tracking tokens
- private object storage
- body-size limits
- NFKC normalization
- control/null character filtering
- unsafe-sensitive-text rejection where relevant
- React escaped output
- no intentional dangerous raw HTML rendering
- custom-request rate limiting
- catalog save size limits
- image upload limits

Do **not** describe the app as “100% XSS-proof” or “unhackable”. Describe the actual defense layers.

---

## 10. UI / UX direction already locked

Before motion work, the storefront received a production UI/UX pass covering:

- responsive hierarchy
- spacing
- typography
- card density
- buttons
- forms
- mobile ergonomics
- empty/loading/success/error states
- checkout continuity
- account/order UX
- copy clarity

Customer copy was shifted toward simple English with light natural Hinglish where useful; avoid over-technical or overly Hindi-heavy storefront copy.

Current visual principle:

> Simple first. Premium second. Decorative third.

---

## 11. Motion / animation direction

Approved inspiration sources:

- Unlumen UI
- Magic UI
- SmoothUI
- RetroUI only in very limited playful contexts
- React Bits
- other high-quality component libraries only where they improve the product rather than add novelty

Approved/implemented concepts include:

- subtle blur/fade section reveals
- Unlumen-style premium 3D tilt / radial shine on selected card contexts
- product image/card motion
- stepper transitions
- premium spotlight treatment
- proof/review presentation
- text accent treatment
- React Bits-inspired **Shape Waves** background
- mobile touch feedback
- background ambient motion

Performance/accessibility rules:

- `prefers-reduced-motion` must be respected
- mobile must not depend on hover
- touch devices need explicit tap/press feedback
- motion should stop/throttle when off-screen where possible
- expensive canvas/background work must not compete with first paint

---

## 12. Mobile motion issue that was found and fixed

Initial motion implementation looked correct in source/build checks but several effects were practically invisible on phones because:

- tilt and spotlight logic returned early on touch devices,
- some CSS motion existed only inside `@media (hover:hover) and (pointer:fine)`,
- Shape Waves opacity was weak under the hero overlay,
- ambient layers could sit behind opaque section backgrounds.

The mobile-first correction added/changed:

- touch press/depth feedback
- scroll-enter product reveals
- always-visible mobile-friendly spotlight/ambient treatment
- stronger Shape Waves presentation
- section-specific background motion
- iPhone-emulated browser checks

A previous live iPhone 13 verification confirmed:

- coarse pointer mode
- ambient background animation active
- Shape Waves changed frame-to-frame
- budget section background motion active
- touch feedback active
- product reveal active
- public `/api/health` returned 200

---

## 13. Current user-requested storefront refresh

The latest requested direction is:

1. **Performance must be measured with Lighthouse, not guessed.**
2. The top service strip containing messages such as:
   - Clear hamper pricing
   - Packing video before dispatch
   - Order tracking
   - issue protection
   must **auto-move continuously** and not require manual swiping.
3. Hero must be redesigned because the previous visual felt repetitive / “same same”.
4. Typography should be simple; editorial italic can be used selectively where it improves the composition.
5. Keep the experience mobile-first.

### Implemented design for this refresh

A newer hero concept was created with:

- left-aligned editorial composition on mobile
- first line normal display serif
- second line selective italic accent
- simpler CTA area
- compact stats/facts row
- a single premium dark visual card instead of repeating the same message in another beige box
- three representative gift items rather than a large repetitive icon grid
- restrained Shape Waves behind the hero

The service strip was redesigned as a duplicated CSS marquee track so it auto-scrolls continuously without JavaScript or manual swipe.

Typography was moved away from a blocking Google Fonts CSS import toward a system sans + local/system serif stack for performance.

---

## 14. Lighthouse findings — exact first measured baseline

A real mobile Lighthouse run was executed on the production build in CI.

Measured result from the first audit:

- **Performance:** 77
- **Accessibility:** 91
- **Best Practices:** 93
- **SEO:** 60
- **FCP:** 1.0 s
- **LCP:** 2.9 s
- **TBT:** 710 ms
- **CLS:** 0
- **Speed Index:** 1.4 s

This failed the temporary gate.

The audit was useful: the hero text was being wrapped in an observer-driven `Reveal`, so key above-the-fold/LCP content could remain initially hidden until client-side logic ran. The Shape Waves canvas also started work too early for a mobile-first performance budget.

### Performance corrections made after that audit

- hero above-the-fold copy/visual changed to immediate render rather than reveal-observer gated render
- Shape Waves mobile DPR reduced
- Shape Waves mobile frame rate reduced
- geometry density reduced
- animation start deferred after initial paint/idle window
- canvas still retains off-screen visibility checks
- mobile navbar backdrop blur removed in coarse-pointer mode
- heavy reveal blur disabled on touch
- below-fold sections use `content-visibility:auto` / intrinsic sizing where appropriate
- remote Google Fonts import removed in favor of system/local stacks

Subsequent private source history includes `perf: keep initial storefront hydration above the fold`, indicating this optimization was integrated into `main` before the later SEO/header commits.

**Next continuation task:** run Lighthouse again against the current `main` / deployed equivalent and record the new scores. Do not assume the first 77 score still represents current source.

---

## 15. SEO state

The original Lighthouse pass reported SEO 60. Later current-main commits explicitly changed production crawlability/indexing behavior:

- `seo: make production storefront indexable by default`
- `seo: keep Celebration production storefront crawlable`

Therefore the old SEO 60 is historical baseline data and must not be presented as the score of current `main` without a new Lighthouse run.

Before final production sign-off verify:

- page is indexable in production
- canonical/meta behavior is appropriate
- robots are not accidentally `noindex`
- semantic headings/links remain correct
- Lighthouse SEO score is re-measured

---

## 16. GitHub Actions / billing history

The GitHub account consumed its included private Actions allocation:

- 2,000 / 2,000 Actions minutes used in that billing cycle

This caused private repo hosted-runner jobs to fail before a runner/step started (`runner_id=0` behavior during diagnosis).

Repo Action permissions were already set to allow actions; the exhausted quota was the material blocker.

Because of this, validation/deployment temporarily used the existing public bridge workflow infrastructure.

Do not confuse:

- a source/build failure
- an Actions runner allocation/billing failure
- unrelated vulnerabilities/tests in the root TrustFirst/Mangalam app

They are separate failure domains.

---

## 17. Validation strategy

Every significant Celebration change should pass, in this order:

1. `npm ci`
2. `npm audit --omit=dev`
3. `npm run audit`
4. `npm run typecheck`
5. `npm run build`
6. targeted browser/interaction checks
7. Lighthouse mobile performance audit for significant storefront changes
8. immutable production deployment
9. loopback health
10. public health
11. real mobile-render verification after deployment

For motion changes additionally verify:

- coarse-pointer behavior
- reduced-motion behavior
- no layout break at ~390 px width
- no dependence on hover for primary interaction
- moving backgrounds do not produce text readability problems
- no runaway canvas work when hidden/off-screen

---

## 18. Performance targets for production sign-off

These are **targets**, not claims about current score:

### Lighthouse mobile target

- Performance: **>= 90 preferred**
- Accessibility: **>= 95 preferred**
- Best Practices: **>= 95 preferred**
- SEO: **>= 95 preferred**

### Web-vitals-oriented target

- LCP: aim **<= 2.5 s** under Lighthouse mobile simulation
- CLS: **<= 0.1**, preferably near 0
- TBT: aim substantially below the historical 710 ms; ideally **< 200–300 ms** in the controlled audit

Do not destroy the approved visual identity simply to chase 100/100. Optimize the largest real bottlenecks first.

---

## 19. Exact next-work priority order

### P0 — refresh current truth

1. Treat private `main` as source of truth.
2. Do not continue from stale `perf/mobile-hero-marquee`; it is behind `main`.
3. Verify whether latest `main` commit `6a77336...` is the exact currently deployed production source.
4. If not, validate/deploy current `main` before declaring live state.

### P0 — Lighthouse / performance

1. Run Lighthouse mobile on current source/current deployment.
2. Record full report, not only the score.
3. Inspect:
   - LCP element and phase breakdown
   - main-thread work
   - long tasks
   - unused JS/CSS
   - render-blocking resources
   - network payload
   - third-party work
   - accessibility failures
   - SEO failures
4. Fix highest-impact items only.
5. Re-run until acceptable.

Likely areas to re-check:

- Storefront client component/hydration size
- large below-fold hydrated builder/catalog code on initial route
- client analytics initialization
- canvas initialization cost
- duplicate/legacy CSS loaded globally
- non-critical admin/account CSS imported globally
- any synchronous fetch/state setup that can be deferred

### P0 — top marquee strip

Acceptance requirements:

- auto-moving continuously
- no horizontal manual swipe required
- seamless loop
- readable speed on phone
- stops/does not animate for `prefers-reduced-motion`
- no JS timer needed if CSS can do it
- no layout shift

### P0 — hero final visual check

Acceptance requirements:

- clearly different from the old repetitive hero
- simple composition
- selective italic only
- one obvious primary CTA
- secondary action remains easy to understand
- motion visible but background does not compete with heading
- no duplicate copy between left side and visual card
- works at 360/390 px widths
- no tiny unreadable labels

### P1 — live browser verification

After deployment capture/inspect at least:

- top viewport at 390×844-ish
- top viewport after 2–3 seconds to prove motion
- budget section
- product section
- builder first step

### P1 — deployment cutover cleanup

Once private Actions/deploy is reliably available:

1. configure exact required private repo deploy secrets
2. run one successful private deploy
3. verify public health and actual page
4. disable public Celebration deploy workflow
5. remove Celebration source from public default branch
6. separately decide whether historical Git source purge is worth the risk

Never perform a destructive public-history rewrite casually.

---

## 20. Mobile-first UX rules for future work

- Design at ~360–390 px first.
- 44 px minimum touch target for primary interactive controls.
- No essential interaction may require hover.
- Sticky UI must not consume excessive viewport height.
- Avoid multiple stacked sticky bars unless clearly justified.
- Keep copy short above the fold.
- Use one dominant CTA per section.
- Avoid horizontally scrollable UI when an auto/marquee or wrapped layout is more appropriate.
- Product images/content should remain primary, not the background effect.
- Motion should be slow enough to feel premium, not game-like.

---

## 21. Content / trust rules

Do not invent customer testimonials, order counts, ratings, sales numbers or “verified review” claims.

The site may show:

- real order-derived social proof
- real tracking/progress proof
- real packing-video proof
- real payment/order process proof
- real reviews when available

If review data is unavailable, keep the premium proof UI but do not fabricate quotes.

---

## 22. Production safety rules

### Never do

- commit `.env` files
- expose credentials in logs/docs/chat
- edit production release in place
- force-push `main` without an explicit recovery reason
- delete old healthy release before new one is proven
- remove the public deployment bridge before private cutover is verified
- rewrite public Git history without backup and explicit intent
- confuse unrelated TrustFirst root app failures with Celebration failures

### Always do

- work on isolated branch for non-trivial changes
- validate before promotion
- fast-forward where possible
- preserve rollback path
- verify `/api/health`
- visually inspect actual rendered mobile output for UI/motion tasks

---

## 23. Important application files / areas

High-value continuation paths:

- `app/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `features/home/Storefront.tsx`
- `features/home/Hero.tsx`
- `features/home/ProofAndReviews.tsx`
- `features/shell/TrustStrip.tsx`
- `features/motion/`
- `features/catalog/`
- `features/builder/`
- `features/checkout/`
- `features/account/`
- `features/tracking/`
- `features/admin/`
- `styles/base.css`
- `styles/home.css`
- `styles/motion.css`
- `styles/mobile-background-motion.css`
- `styles/production-polish.css`
- any current hero-refresh/performance override stylesheet present in main
- `lib/server/catalog.ts`
- `lib/domain/content.ts`
- `content/store.json`
- `content/ui.json`
- `db/migrations/`
- `.github/workflows/deploy-production.yml`

Before changing style behavior, inspect cascade/order in `app/globals.css`; several historical CSS layers exist and a later override can make an earlier implementation appear “not working”.

---

## 24. Current hero/trust refresh implementation concept

The refresh work introduced the following design intent:

### Trust strip

- duplicated groups inside a moving track
- continuous linear CSS animation
- service promises auto-pass through the viewport
- no manual horizontal scrolling requirement

### Hero

- `Make their day.` as strong main display line
- `Your way.` as selective italic accent
- left-aligned mobile editorial layout
- facts row for budget/options/personalization
- one premium dark hamper-summary card
- reduced repeated text/icons
- Shape Waves retained as background texture, not main visual content

### Performance intent

- system font stacks instead of render-blocking external font CSS
- immediate above-fold rendering
- lower canvas density/DPR/FPS on coarse pointers
- animation starts after initial render window
- below-fold rendering deferral where safe

If current `main` has evolved past these files, preserve the intent rather than blindly restoring an old branch.

---

## 25. Final production-readiness checklist

Do not call the storefront “done” until all of these are checked:

### Functional

- [ ] catalog loads
- [ ] budget selection works
- [ ] product selection works
- [ ] builder completes
- [ ] validation messages work
- [ ] payment flow opens/works as configured
- [ ] order placement works
- [ ] customer account works
- [ ] tracking works
- [ ] packing-video/approval states work
- [ ] issue submission works
- [ ] custom request works
- [ ] admin catalog draft/preview/publish works
- [ ] admin order operations work

### UI/UX

- [ ] 360 px mobile
- [ ] 390 px mobile
- [ ] tablet
- [ ] desktop
- [ ] top strip auto moves
- [ ] hero no longer looks repetitive
- [ ] sticky header height acceptable
- [ ] typography readable
- [ ] no horizontal overflow
- [ ] all touch controls reachable

### Motion

- [ ] Shape Waves visible but subtle
- [ ] ambient motion visible
- [ ] reduced-motion behavior correct
- [ ] touch feedback works
- [ ] no hover-only critical UX
- [ ] no stutter during first interaction

### Performance / quality

- [ ] `npm ci`
- [ ] production dependency audit
- [ ] custom audit
- [ ] TypeScript
- [ ] production build
- [ ] current Lighthouse mobile run recorded
- [ ] LCP/TBT/CLS reviewed
- [ ] accessibility issues reviewed
- [ ] SEO issues reviewed

### Production

- [ ] immutable deploy successful
- [ ] DB migration successful/idempotent
- [ ] loopback health 200
- [ ] public health 200
- [ ] actual mobile browser render inspected
- [ ] rollback path still valid

---

## 26. Immediate continuation instruction

If another engineer/agent picks this up now, do this first:

1. Read this file.
2. Fetch `SHOPCELEBRATION/main` HEAD and compare with this snapshot.
3. Ignore stale branch assumptions.
4. Inspect the latest hero, trust strip, Shape Waves, header, globals/CSS import order and storefront hydration code on current `main`.
5. Run a fresh mobile Lighthouse audit against current production-equivalent code.
6. Use the report to choose the next performance fix.
7. Rebuild and re-audit.
8. Visually inspect 390×844 output.
9. Promote only after validation.
10. Deploy with immutable release + health verification.
11. Update this document if architecture/state changes materially.

---

## 27. Status summary

### Done

- private source repo created and populated
- source migration validated with no committed runtime env
- Next/React/security dependency hardening
- production immutable deployment pipeline
- live health endpoint
- dynamic catalog
- Draft → Preview → Publish admin workflow
- catalog history/rollback
- customer/account/tracking/order flows
- custom requests
- operational admin APIs
- baseline UI/UX production pass
- premium motion layer
- mobile-first motion correction
- live mobile motion verification
- first Lighthouse mobile audit
- first performance corrections
- production indexing/crawlability follow-up commits
- mobile header/support cleanup in latest private main

### Still to finish / verify

- fresh Lighthouse run on **current main / exact deployed equivalent**
- confirm new Performance/LCP/TBT/SEO scores after latest optimizations
- fix remaining Lighthouse bottlenecks based on evidence
- final hero visual inspection on current source
- final auto-marquee inspection on current source
- final sticky header viewport-density check
- final live production mobile screenshots after the newest source is deployed
- private GitHub Actions/deploy cutover when runner quota/billing/secrets permit
- retire public bridge only after private deployment is proven
- optional historical public Git purge only as a separately planned destructive operation

---

**End of handoff.**

## Google Analytics 4

GA4 ecommerce tracking is optional and remains disabled unless the production build has:

`NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX`

Tracked ecommerce events:
- `view_item`
- `add_to_cart`
- `begin_checkout`
- `purchase`

The purchase event is emitted only after server-confirmed payment and uses the Celebration public order ID as GA4 `transaction_id`. Customer names, phone numbers, delivery addresses and other PII are not sent to GA4.

---

## 2026-10-10 operational audit update (supersedes the Sep 25 continuation snapshot)

Production source: `nitinkumawat9661/SHOPCELEBRATION`, `main`. Follow the latest `main` and its green immutable-release GitHub Action, not the historical commit/bridge instructions above.

**Verified from repository and Actions:** Next.js/TypeScript/PostgreSQL store; DB-backed catalog and inventory; paid-order checkout and idempotent payment webhook handling; account, order, admin, campaign, tracking, Shipway integration; 35 DB migrations; public health check in the deployment workflow. Recent PRs #65–72 completed the Cart, Delivery, saved-address persistence and customer-facing collection search/filter improvements. The deploy workflow builds, tests, migrates, performs loopback and external public health checks, and rolls back on failure. A passing health check is not a substitute for actual user interaction or courier settlement verification.

**Bootstrap-catalog discrepancy fixed in this audit:** `content/catalog.json` retained *old* names, prices and image URLs for 12 adjustable rings even though DB migrations #030–032 had corrected the live products. The seed is aligned with the canonical migration values, with an automated parity regression check. This does **not** overwrite the live published DB catalog or prices.

**Checks reported completed by store operator:** checkout flow, payment, stock deduction, saved addresses, cancelled-order customer tracking, admin analytics and progress UI. These are user-performed operational checks, not independently reproduced from a cloud browser in this audit.

**Still pending verification / decisions (do not silently mark complete):**

- Actual courier pickup, Shipway AWB lifecycle, shipment tracking accuracy, and delivered-state propagation. Operator plans a physical shipment verification.
- WhatsApp automatic notifications await a separate Celebration SIM and Meta Cloud API onboarding, templates, consent and operational send verification. No notifications are currently deployed; personal WhatsApp must remain untouched.
- Automatic refunds are deliberately out of scope per operator instruction. Paid cancellations may still require an **external/manual financial reconciliation**; never label a cancelled paid order `refunded` without provider evidence.
- Abandoned pending payments can leave stock reserved: current `releaseExpiredWithClient` releases expired holds only for orders marked `failed` or `cancelled`. Do not blindly release unresolved pending holds because delayed successful gateway events can otherwise cause overselling. Before enabling automatic recovery, design and test gateway reconciliation, hold expiry, late-payment handling, and audit visibility.
- Estimated delivery dates depend on Shipway supplying a trustworthy `estimatedDeliveryDate` after booking. Pre-order checkout currently confirms serviceability, not a guaranteed ETA. Do not invent a delivery promise.
- Run fresh real-device browser checks at 360/390px, tablet and desktop, Lighthouse/Core Web Vitals, accessibility/keyboard tests and checkout-to-tracking smoke tests after deploy. CI/typecheck/health do not cover these.
- Review whether to introduce server-side pagination as live catalog size scales; 89 products are in the bootstrap seed as of this audit, but live DB catalog can differ.

**Next action after this seed consistency fix:** physical Shipway shipment-status and ETA verification, followed by payment-reservation reconciliation design. Record evidence and only then consider further growth/UI features. No refunds or WhatsApp API work until the explicit prerequisites are met.
