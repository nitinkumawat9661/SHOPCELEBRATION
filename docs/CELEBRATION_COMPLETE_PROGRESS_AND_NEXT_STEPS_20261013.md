# Celebration — Consolidated Project Progress, Decisions, & Delivery Roadmap

**Last updated: 13 October 2026**  
**Project:** shopcelebration.in • Next.js / TypeScript • PostgreSQL • owner-admin tools  
**Repository:** nitinkumawat9661/SHOPCELEBRATION  
**Source of truth:** deployed repository code + completed migration history + owner-confirmed messages. This document is an operations record, not a claim that unimplemented work is ready.

## 0. Decision log — NEVER accidentally reverse these

1. Celebration has **two fundamentally separate jewellery and hamper offers**: retail jewellery purchases (real SKU/stock/personal product photos) and gift hampers.
2. **Curated hamper**: existing live tier-based checkout continues without changed payment/order behaviour. Owner chooses budget and occasion; Celebration decides contents.
3. **Self Build**: **CATEGORY-ONLY selection**, not individual-product selection and **NO SKU-to-category mapping** in hampers. Buyer chooses category (and option, where relevant) and quantity; Celebration chooses exact pieces at fulfilment. Never display a specific retail SKU or imply buyer selected its photo/design.
4. Eight owner-approved Jewellery subcategories (minimalist labels, editable in DB): **Premium Feature Necklaces; Premium Necklaces; Necklace & Stud Sets; Korean Earrings; Indian Trending Earrings; Minimal Rings; Viral Bangles; Korean Bangles**. A **standalone Bangles** category also exists. Viral/Korean Bangles and standalone Bangles internally consume ₹150/unit; other jewellery categories ₹60/unit. These figures are NOT retail selling prices.
5. **Chocolates**: Starter ₹100, Mini ₹200, Medium ₹400, Large ₹600, Mega ₹1000, internal budget consumption per selection × quantity. **Snacks** and **Perfume**: Mini ₹200, Medium ₹400, Large ₹600, Mega ₹1000. Medium and Large are NOT the same price.
6. **Personalised Photos** consume **₹50 per photo** (quantity 3 consumes ₹150), not one ₹50 fee for the whole selection. Actual photo upload and printing workflow is deferred.
7. Multiple quantities across applicable categories/options/photos are supported by design; later checkout must validate real category availability, hamper budget and packaging, not promise unlimited stock.
8. Any extra customer wishes: final **Anything Else?** optional textarea, editable prompt: “Need anything else? Describe it here. Our team will discuss your request with you.” Don't auto-price custom wishes.
9. **Never display item-level internal budget consumption** to customers, in customer HTML/JSON, previews, UI or analytics. A total advertised whole-hamper tier price is separate. Source-of-truth rates live in Postgres, editable via authenticated admin tools; never hardcode them into storefront components.
10. Do not create fictional chocolate/snack/perfume stock, jewellery names, guarantees, shipping estimates, category photographs or buyer orders to fill UI holes.
11. Keep personalised owner-provided jewellery photos paired with the exact retail SKU; do not use incorrect jewellery images. Self-build category tiles may use *non-SKU decorative abstract art* or typographic treatment only.
12. On homepage, owner wants stable mobile 2-column and desktop 4-card product grids, **not a swipe-only featured product rail**. Circle category imagery is a separately deferred phase-1 polish item (no unapproved substitutions).

## 1. Work completed before this UI milestone

### Phase 1 — homepage / discovery (largely completed)
- Home premium/mobile refinements: hero, header, category discovery, occasions and budget entry.
- Restore stable non-swipe featured retail collection grid; mobile 2 columns, desktop 4.
- Mobile scroll and header stability fixes, approved circle category artwork updates. **Remaining owner-requested task:** final selection of circle category imagery, explicitly deferred.
- Admin marketing content/editorial work and catalogue category visual provenance already documented in previous project files.

### Phase 2 — retail shopping quality (completed code and browser tests; manual ownership QA still separate)
- Customer wishlist: server/account sync.
- Product-detail page PIN-based delivery ETA improvement.
- Browser regression coverage for mobile/desktop, shopping layouts, wishlist, PDP delivery. Continue verifying future deployments do not undo them.
- Previous source-image review noted a possible duplicate visual pair in a necklace collection; requires human verification against original SKU source; NEVER arbitrarily swap images.

### Phase 3 — gift hamper builder: audit and staged backend COMPLETE
- **PR #138:** audit `docs/PHASE3_HAMPER_BUILDER_AUDIT_20261013.md`. Existing builder: tier, occasion, delivery, payment, tracking, packing approval; does NOT select items and only supports *curated* fulfilment. Orphaned old `ProductStep` is NOT authoritative and should not be wired up.
- **PR #139, migration 047:** admin-only staged self-build configuration/categories/options/drafts/future order snapshot, secure GET/PATCH endpoint, live buyer mode hard-disabled and prices hidden.
- **PR #140, migration 048:** owner-confirmed eight Jewellery categories, ₹150 bangle choices, Starter/Medium/Large/Mega size corrections and personalised photos ₹50 EACH.
- **PR #141, migration 049:** final instruction **NO SKU MAPPING for hampers**. Converts jewellery to true category choices, removes the staged SKU mapping table and catalogue mapping field; keeps buyer route disabled. Category-only admin contract `GET/PATCH /api/admin/self-build` returns `version, config, categories, options` to authenticated administrators. Pricing/labels/sort/activation are DB-driven.
- Last successfully shipped backend before this milestone: `e0c9dd89eaef5021011d8fc4604845a316af1df9`, with migration 049 applied in production. Feature currently customer-disabled.
- Existing retail jewellery selling price, catalog, stock handling, courier, order, payment, saved addresses and curated checkout untouched by these migrations.

## 2. This milestone — minimalist **category-only UI design**, FIRST as authenticated preview

### Must implement
- Add an admin-authenticated review page for the visual **category-first Self-Build journey**. The preview must not have payment, ordering, stock reservation, or public customer entry.
- Render actual **current database-driven categories and variant choices** (not duplicate hardcoded jewellery options in React). Fetch privately on server, create a public-safe *sanitized visual-view payload* containing **only** IDs, labels, hierarchy, selection kind and display order; NEVER leak internal `unitBudgetPaise` or budget logic into client props/HTML/network.
- A deliberately quiet, minimalist Celebration-like visual language: neutral off-white/champagne palette, careful serif/sans hierarchy, lots of whitespace, restrained borders, no marketing template cards, no autoplay/video/heavy scroll/parallax.
- Interaction: step/category navigation, jewellery nested 8 choices, separate Bangles, Chocolate/Snack/Perfume sizes, quantity increment/decrement, photo count control and **Anything Else?** textarea; back/change/edit, selected-items summary; keyboard/mobile accessibility.
- Explicit **Preview only — not accepting orders** labeling and non-submitting final state; quantities are an **unsaved browser mock state** and no budget/stock/price promise. User can inspect the visual layout before implementing the real backend.
- Add automated guardrails for privacy, category-only structure, access gate, no payment calls and source stability; verify PR CI, Postgres migration smoke, deployment if possible.

### Non-goals for this preview
- No builder linked into public homepage, no checkout button, no payment mutation, no customer account write, no admin editing UI (separate later work), no photo upload, no inventory promise, no exact SKU/product images, no exposing confidential internal budget numbers, no production order.
- No duplicate "self-build" route in the existing curated `HamperBuilder` until the server quote and stock protections are built.
- No fake "available / in stock" badges, delivery estimates, free gifts or hardcoded prices.

## 3. Roadmap after the visual review (strict ordered slices)

**Phase 3.1 — Review UI preview & freeze approved copy:** Verify 320–430px phones, larger mobile, 768px tablet, >=1280px desktop and keyboard/screen-reader baseline; owner approves category tiles, typography and step order. Category values come from DB; preview must be read-only.

**Phase 3.2 — Admin category controls:** Build actual admin editor over existing secured GET/PATCH API: change names, order, per-category private costs, variant sizes, active status and prompt (never product/SKU mapping). Log/version conflicts; ensure no accidental price leaks into customer view.

**Phase 3.3 — Category/option-level fulfilment inventory:** Model available *units per category and size*, verified packing capacity, photo fulfilment limits; staff-controlled availability. Stock semantics must NOT depend on retail product SKU inventory; explicitly agree how a selected category is fulfilled.

**Phase 3.4 — Authoritative server quote:** Server retrieves current versioned DB rules and units to calculate budget consumption privately; enforce positive quantities, supported category, tier budget, capacity, availability, abuse limits. Public UI can only receive an allowance/error and the **advertised full hamper price**, never item price or invisible-cost information.

**Phase 3.5 — Account-backed draft + photo handling:** Safely persist selected categories/options + quantities and optional notes; photo attachment/upload requires explicit image constraints and private storage; preserve existing delivery preference, authentication and draft flow without rewriting curated orders.

**Phase 3.6 — Transactional self-build order creation:** Snapshot category/size and customer quantities, internal rules version, actual promised contents policy, packing and team approval state; reserve category units atomically, expire/release on failed payment/cancellation; idempotency and concurrent request tests; attach existing payment/tracking system only with separate order type and regression coverage.

**Phase 3.7 — Integrate customer-facing chooser and launch:** Enable buyer flow only when server quote, stock, packing, payment and privacy end-to-end tests pass and owner explicitly approves. Add a separately reviewed database migration to remove `customer_enabled=false` CHECK, never patch around it in JS.

**Phase 4 — Ready-made hampers (independent):** Owner supplies exact content, visuals, price and actual available quantities. Do not fabricate inventory or pack specifications and do not use SKU-based self-build mapping.

**Ongoing reliability:** Site performance, storefront QA/SEO, shipping-order lifecycle/estimated delivery, support/claims, provenance checks, stock freshness and incident/regression follow-up continue independently of self-build.

## Phase 3.2 — Self-Build Studio admin controls implemented (13 October 2026)

**Editor location:** existing authenticated `/admin` sidebar → **Catalog → Self-Build Studio** (also in mobile admin section picker and overview quick actions). This is a **settings editor**, not a customer checkout. It reuses the deployed secured `GET/PATCH /api/admin/self-build` API, whose values are stored in PostgreSQL.

Admin can edit the full dynamic category hierarchy (including 8 Jewellery subcategories, separate Bangles, Chocolates, Snacks, Perfume, Photos, Anything Else), per-category private internal amounts, labels, display order, enable/disable; add/remove categories and groups (cannot remove a group while it contains children/options); size/option labels, internal budgets, sort and enable/disable; add/remove size options; default category budget, multiple-quantity policy and final team-discussion text. **No individual SKU mapping or images.**

The editor displays unsaved status, discarding confirmation, per-field validation, authenticated same-origin submission and server authoritative read-after-save. Atomic DB transaction + optimistic version lock prevent partially applied lists and flag simultaneous admin editor conflicts for reload. Backend continues enforcing no shopper self-build checkout and no customer item-price visibility at the database level. The existing curated hamper, retail jewellery prices and stock, payments, customer order management and fulfilment are unchanged.

**Important limitation:** This phase edits future category offers and unit budget assumptions, not actual warehouse availability. **Category-level inventory, stock reservations, payment quoting, buyer checkout and order fulfilment integrations remain separate future phases (§3).** Editing an active checkbox here only controls design preview visibility, not safe sellable stock or public launch.

## Phase 3.6 — Admin order operations & scheduled expired-draft cleanup (13 October 2026)

Read [PHASE3_SELF_BUILD_ORDER_OPERATIONS_20261013.md](./PHASE3_SELF_BUILD_ORDER_OPERATIONS_20261013.md) for precise scope and outstanding launch gates. Existing authenticated admin order cards are ready to show future self-build category/option selections, quantities, owner notes and reservation status. **Neither internal unit costs nor photo storage keys** are included in those responses. Daily scheduled private-R2 expired-draft cleanup added using protected VPS SSH access; expired payment holds are reported and deliberately not automatically released until payment gateway reconciliation exists. Existing manual/gateway checkout explicitly refuse staged Self-Build payloads. **No customer checkout, real self-build order placement or gateway integration is enabled yet.**

## 4. Verified acceptance checklist for this UI milestone

- [x] Consolidated all past work and future implementation roadmap **in this GitHub file before writing UI code** (first branch commit `dcac8536f83ee7e967ddae79d327e8f1d6dbcb15`).
- [x] Implemented admin-only route `/admin/self-build-preview`, linked from AdminDashboard. No buyer-facing navigation.
- [x] Dynamic category hierarchy and sizes read from PostgreSQL using `lib/server/self-build-preview.ts`; no static SKU array in UI.
- [x] Client props are **server-whitelisted** identifiers/labels/kinds/sort only; confidential internal budget fields excluded.
- [x] Category-first eight jewellery choices, standalone Bangles, size-options, multiple quantity controls, photo count, optional team-discussion note and summary.
- [x] Minimized card clutter: cream/champagne background, restrained burgundy accents, existing Celebration local fonts, no heavy animation/remote stock images.
- [x] **Actual Chromium tests at 320px, 390px, 768px and 1280px**: `106 PASS / 0 FAIL`; verified guest lockout, protected admin API, exact category labels, multi-quantity, Starter, three photos, custom text, review, no horizontal overflow, no JavaScript errors, no customer API writes and no confidential budget field in HTML.
- [x] GitHub PR source audit, TypeScript typecheck and production build checks passed; isolated local PostgreSQL 034/047/048/049 migration and browser tests passed.
- [ ] Production merge/deployment health confirmation — recorded separately in GitHub PR #142 deployment workflow after merge.

### Visual preview locations & limitations

**Admin only:** `/admin/self-build-preview` after passkey/admin login (not indexed). Screenshots/report from isolated Chromium run in GitHub Actions **Celebration Phase 3 Self-Build Browser QA** artifact `phase3-self-build-design-<run_id>`, retained 14 days.

**Important:** Preview selections live only in the browser's React state, and are deliberately discarded on navigation. It does not price an order, reserve category stock, upload photos, accept payment, save a draft, or promise item availability. Customers still use the unaffected curated checkout. The implementation plan in §3 documents the necessary follow-up slices; never enable the buying mode on the basis of design QA alone.


## Phase 3 next safety milestone — read-only launch readiness audit (13 October 2026)

An automated VPS-only readiness check now reads current staff-verified category/size capacity counts, enabled internal tier allowance **counts**, pending capacity holds and expired draft counts using PostgreSQL `BEGIN READ ONLY`. Results never include confidential unit budgets, customer photos, retail SKU mappings, or personally identifying data. It runs after a successful deployment, with optional workflow dispatch and verified SSH. Neither the audit nor dashboard changes public checkout availability; `customer_enabled=false` remains mandatory. Even if every unit is verified, Self-Build remains blocked until payment idempotency, paid-photo retention, lifecycle end-to-end tests and explicit owner launch approval.


### Phase 3.6 — atomic Self-Build order staging, NO customer checkout (13 October 2026)

Added `lib/server/orders/self-build-create.ts` as a **server-only unexposed** future integration primitive: validates an authenticated verified account's own unexpired saved draft, always reloads the live published catalog tier/price, ignores posted SKU IDs and private budgets, and writes the order + immutable category snapshot + locked category reservation + outbox notification in **one** PostgreSQL transaction. It is backed by exact idempotency and optimistic ownership checks; retries cannot silently convert curated orders into Self-Build orders. Insufficient verified capacity/owner mismatch/budget mismatch roll back everything. Photo-bearing orders fail closed until private paid-photo ownership and retention is implemented.

To protect existing Celebration shoppers, the production DB `CHECK(customer_enabled=false)` remains and the ordinary `/api/orders` and `/api/payments/create` continue returning `SELF_BUILD_NOT_LIVE` when passed Self-Build data. No payment gateway/network initiation was added. Next separate gate: connect trustworthy verified provider payment events to the reserved Self-Build batch in the same transaction, with cancellation, expiry/retry reconciliation and provider sandbox E2E; do not publish a checkout route until owner approves and real available units + tier allowances are verified.


### Phase 3.7 — trusted-provider payment settlement **STAGING ONLY**, 13 October 2026

Implemented `lib/server/self-build-payment-settlement.ts`: a transaction-scoped, unexposed helper for a future **signature-verified** gateway payment path. Before touching category capacity, it requires an actual Self-Build reservation ledger, an existing verified `payment_events` record for the provider event, matching current `payment_attempts`, the provider order reference and the exact frozen amount. To avoid order/capacity deadlocks, the integration contract **requires locking `self_build_capacity_control` before any payment attempt/order `FOR UPDATE`** in the same transaction. On a fresh verified, non-expired paid event it commits reserved category quantity once; a verified final current-attempt failure releases reserved units once. Stale callback, already released/paid conflict, paid after cancellation or expiry remain held for staff manual review, not automatic refund/restock. Unpaid or unknown gateway state never triggers speculative capacity release.

A real isolated PostgreSQL integration test exercises verified amount, unknown event failure, idempotent paid and failed callback, paid-after-expiry, reconciliation and complete separation of legacy curated hampers. **Do not mistake staged fixtures for actual gateway sandbox confirmation.** No live payment handler, Self-Build customer checkout, stock, tier allowance, refund API or database migration is altered. Production's `CHECK(customer_enabled=false)` remains. Before enabling customer checkout: connect this helper into signed-provider transaction while obeying lock ordering; test payment SDK sandbox and cancellation/refund races; implement persistent paid-photo ownership, owner-approved real availability and internal tier budgets.


### Phase 3.8 — Private Personalised Photos, **48 hours AFTER DELIVERED** (13 October 2026)

**User requirement:** Photos must be automatically deleted **two days after successful delivery completion**, not two days after order, dispatch, pickup, shipping label, or estimated date.

Architecture implemented:
- Private R2 WebP (metadata/GPS/EXIF already stripped by the existing upload path) stays in the owner's authenticated private bucket. No public CDN, filename, raw R2 key or private cost is sent to the browser.
- During future staged Self-Build checkout, `transferSelfBuildPhotosToOrderWithClient` atomically migrates DB custody from `self_build_draft_photos` to `self_build_order_photos` with the SAME PostgreSQL order + category reservation transaction. It requires a photo per selected personalisation quantity; missing photos fail and roll back checkout. Physical R2 keys are NOT duplicated or moved; draft expiry/customer draft deletion cannot delete an order-owned image.
- Only authenticated admin order photo routes can list/view order-owned files for fulfilment, with `Cache-Control: private, no-store`, strict order and UUID scoping, and no private key response. Collapsed “Personalised photos” panel in the Admin Self-Build packing list fetches only when needed.
- `orders.delivered_at` is authoritative. The separate hourly scheduled GH Action (workflow `self-build-delivered-photo-retention.yml`) calls the production VPS cleanup service; photos become eligible **no earlier than 48 elapsed hours** after actual delivered status (also valid if a later issue is reported/resolved), and only for paid orders. It takes PostgreSQL session advisory lock plus per-photo transactional order + photo locks; deletes from private R2 **before** setting `deleted_at` and nulling `object_key`. Interrupted uploads/network failures retry next hour; no physical files are removed on only “Shipped” / out for delivery / preview dates. Admin reads are disallowed at the 48-hour deadline even if cron is delayed.
- Existing 14-day abandoned unpaid-draft photo cleanup remains separate; it cannot touch transferred files. No automatic cancellation/refund-photo removal policy is invented without owner direction.
- **Safety:** Migration 104 is additive, no live photos are fabricated, no product/inventory/catalog images or packing videos are touched. Self-Build shopper checkout and live provider handler remain OFF/unwired; provider sandbox and stock/budget approvals are still outstanding. The hourly cleanup's actual completion can lag the 48-hour eligibility due to GitHub Actions scheduling/outages; on storage error the job fails closed and retries, not silently claims deletion.


### Phase 3.9 — Owner-approved NO-INVENTORY Self-Build payment & cancellation reconciliation (13 Oct 2026)

**Owner requirement:** "Inventory ko kuch bhi touch nahi karna." The Self-Build customer workflow is category/option selection **only**; owner fulfils designs manually. All existing retail jewelry inventory, category/option capacity services, their reservations and production quantity values remain unmodified. No fake stock or SKU mapping is added.

A separate `lib/server/orders/self-build-no-inventory.ts` safely stages order+private selection snapshot+photo ownership in ONE transaction without reading/writing ANY stock or category/option capacity table. It reuses trusted published hamper tier price, authentic account-bound draft, validated live category/option settings and owner-defined **private category spending limits** (not inventory). Retries match exact original selected choices, notes and internal budget; changed data and cross-account drafts fail closed. The existing older capacity-based staging code remains archived/uninvoked and has no new entrypoints.

A dedicated authenticated, CSRF-protected `POST /api/payments/self-build/create` is prepared for the existing Razorpay/Cashfree signed gateway payment attempt, with retry/idempotency and no external charge before an approved launch. Production's database hard gate `customer_enabled=false` remains unchanged: this route currently replies `SELF_BUILD_NOT_LIVE` before calling the gateway. Existing `/api/payments/create` and `/api/orders` and all jewelry/curated inventory flows remain unchanged.

Manual refund safety uses additive migration 105 `self_build_payment_reviews` with order-status trigger. Paid cancellation, or money received after cancellation, queues an OWNER review; no automatic provider refund or money movement. Authenticated Admin → Self-Build Studio shows pending cases and accepts a gateway/bank reference **only after real-world manual verification**. Documenting the reference does NOT change `orders.payment_status` or make a refund happen.

**Remaining launch gates:** owner internal budget allowance configuration (distinct from inventory), live-provider sandbox success/failed/retry/refund tests with real merchant credentials, enablement through a separately owner-approved DB/route review, an approved customer Self-Build builder launch/surface, and real cancelled/undelivered personal photo retention policy. None of these are silently activated from an AI-generated migration.


### Phase 3.10 — mobile-ready Self-Build buyer experience, **gated OFF until approved**

A separate customer `/self-build` flow and order payment gateway steps were implemented without touching jewellery inventory/stock, category capacity tables, or existing customer/curated hamper checkout. The browser flow is category/size quantity selection, private notes, tier price, OTP/password account login, account-backed draft, stripped-metadata private JPG/PNG/WebP upload (one file per selected photo; 3 MB each), recipient/delivery preference, order/payment, verified gateway callback, status check and retry without duplicate orders. Razorpay/Cashfree use the same existing checkout SDKs and **server-side signed verification**, not client trust. Cashfree mobile full-screen redirects can recover the account-scoped order ID from sessionStorage. Private buyer data, internal unit costs and photo keys never appear in props.

Only when `self_build_configuration.customer_enabled=true` does the customer page render checkout and the homepage nav show the entrypoint (the latter cached for 120s); otherwise `/self-build` only shows a factual “coming soon” notice. **Production hard CHECK(customer_enabled=false) stays unmodified.** That is intentional: owner must approve deployment and release after merchant sandbox test + real internal allowance configuration. No real payments or customer-upload trial is possible until that separate launch approval. The existing admin preview is unchanged. The design has narrow-mobile category rows, accessible quantity buttons, no artificial big promotional hero and visible delivery+48h personalised-photo retention copy.
