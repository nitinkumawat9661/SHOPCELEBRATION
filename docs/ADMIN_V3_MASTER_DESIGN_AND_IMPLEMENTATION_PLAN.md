# Celebration Admin V3 — Master Design & Implementation Plan

**Project:** Celebration / shopcelebration.in  
**Repository:** nitinkumawat9661/SHOPCELEBRATION  
**Prepared:** 17 October 2026  
**Status:** Consolidated DESIGN PROPOSAL for owner's final review; NOT implemented  
**Branch intent:** Documentation only. Do not merge or deploy merely because this document exists.

## 0. Executive decisions / non-negotiables

1. The current public Celebration store, order/payment/checkout flows, existing database records, exact-SKU product photographs, inventory reservations, Telegram order-message flow, and Shipway integration must not be disrupted.
2. Build on a dedicated development branch. Do NOT push to main until the owner approves the complete V3 and a production rollout is authorized. A main push activates the existing production deployment workflow.
3. Keep existing business rules authoritative: order transition guards; Cashfree verification/refund separation; self-build buyer checkout OFF until separately authorized; self-build internal budgets hidden from customers; no automatic retail-SKU mapping; proper reserved inventory handling.
4. Existing capabilities should be refactored/presented, not reimplemented from scratch. Proposed new features require separate backend work, data migrations and tests.
5. The production website and its page speed optimizations are OUT OF SCOPE. No unsolicited customer-facing UI redesign, SEO modifications, or Telegram refactor.
6. No invented data: use explicit loading, empty, error or not-yet-supported states; distinguish submitted order value, paid revenue, refunds, estimates and verified accounting values.
7. Accessibility: semantic forms, clear validation errors, visible focus states, keyboard navigation, touch controls >= 44px, no horizontal viewport overflow, WCAG 2.2 AA target.
8. The previous conversational proposals have been gathered into this document. Overall theme/navigation direction was explicitly accepted; final approval of all details and new features remains with the owner.

## 1. Navigation and design system

### Desktop (>= 1024px)
- Sticky 224–240px navigation sidebar, main content, compact header; do not load all admin sections simultaneously.
- Main navigation in this exact owner-visible order: Overview; Orders; Products; Inventory; Hampers (Curated, Self-Build, Custom Requests); Offers; Customers; Analytics; Reviews; Settings.
- Settings submenus: Store Information; Shipping & Delivery; Payments; Security & Passkeys; Notifications; Policies; Change History; Backup & Recovery.
- Global actions: route-aware search (search only within supported sections initially); manual refresh; view storefront; logout; optional notification indicator only for actual stored events.
- Max main content ~1440px. Long forms open in dedicated routes or panels, with explicit unsaved-edits handling.

### Mobile (< 1024px)
- Fixed bottom navigation: Home | Orders | Products | Stock | More.
- More contains Hampers, Offers, Customers, Analytics, Reviews, Custom Requests, Settings.
- One-column cards; bottom sheet for low-risk quick edits; full page for complex details; avoid hover-dependent actions. Sticky bars never obscure form fields or keyboards.

### Tokens
- Brand primary: #7A1F24; canvas: #FAF9F6; surface: #FFFFFF; dark text: #242424; muted neutral text; muted gold accent.
- Status semantics: soft green success, amber pending/warning, blue informational, red destructive/error; never communicate meaning only through color.
- Font: clean sans-serif for admin (Inter or compatible). Typographic scale: body 14–16px, field labels >= 12px, page headings 26–32px desktop / 22–26px mobile, numeric KPIs 26–32px.
- Radius: 12–16px cards; restrained 1px borders; minimal shadows and animations; skeleton, no-results and error patterns shared across screens.
- Reusable components: AdminShell, NavItem, PageHeader, KPI, StatusBadge, SearchFilterBar, ResponsiveDataList, Table, ProductMediaThumb, FormSection, SidePanel, ConfirmDialog, SafePublishReview, EmptyState, ErrorState, Skeleton, DateRangePicker, ActivityTimeline, Toast, Pagination, CurrencyField, QuantityField, CopyButton.
- Currency always INR; server money stored/calculated in paise; date/time displayed in Asia/Kolkata; server stores timezone-aware values.

## 2. Nine screen contracts

### 2.1 Overview
- Initial four KPI cards: verified paid revenue, paid orders, pending operational actions, average order value; click to underlying filtered data.
- Operational action center: payment checks, packing, approvals, shipping/pickup, unresolved claims, reservation anomalies, low stock.
- Date range: Today, 7d, 30d, custom when supported; show last refreshed timestamp.
- Revenue trend; latest orders; critical low-stock summary; compact quick actions for products/orders/hampers/offers.
- Backend data source must separate paid/verified orders from unpaid submissions and adjust refunds if verified refund records exist. Never label submitted value as paid revenue.
- Read-only dashboard actions except navigating to dedicated operational screens.

### 2.2 Products
- Paginated searchable gallery/table: thumbnail, exact product name, SKU, category, selling price, live stock, active state, edit.
- Filters: category, active, out of stock; sort by name/price/stock as data supports.
- Dedicated product editor: Basic Details, Images/Gallery, Pricing, Inventory (separate save), SEO, Legal Declarations.
- Gallery: exact SKU photographs only; gallery ordering, upload progress, first image primary, broken-image feedback, safe removal confirmation. Preserve existing R2 URLs and no mass remote-image substitution.
- Fast Quick Edit for supported catalog fields; explicit review before publish; SKU locked by default. Deleting an indexed product requires SEO/URL assessment, so favor deactivate/archive.
- Preserve current catalog-wide versioned draft and live publish behavior. Before publish, show all pending catalog changes, not just currently open product.
- Distinguish existing generated SEO metadata from proposed independently editable SEO fields; add schema only with intentional validation and crawl-safe migration.

### 2.3 Orders
- List filters: Active, Payment, Packing, Approval, Shipping, Issues, Closed, All, plus Delivered/Cancelled views; search order ID, customer, phone, AWB and payment reference.
- Dedicated detail: immutable purchased items and amount; independent payment and fulfillment badges; address; next valid action; packing video/media; shipping/label/AWB; customer approval; claims/refund reconciliation; verifiable event timeline.
- Enforce existing server-allowed status transitions; do not fabricate intermediate event history.
- Distinguish Shipway AWB generated / pickup requested from confirmed Shipped; verified courier movement controls shipping state.
- Cancellation does NOT execute Cashfree refund. Refund provider confirmation/status separately required. Approvals and packing media must not be bypassed.
- Self-Build snapshots and internal costing shown only as authorized admin-only data and never leaked to customer.

### 2.4 Inventory
- Independent inventory view for individually sold jewellery: total tracked SKUs, available sellable units, low stock, out-of-stock, reservation-review alert count.
- Per-SKU stock actions: Set, Add, Remove; show current value and proposed result. Default low-stock alert threshold 3, configurable in a new admin-only setting.
- The current PATCH /api/admin/inventory sets absolute available quantity; safe Add/Remove require transactional atomic operations and protection against concurrent admin/order updates.
- Available stock is already reduced by a reservation: DO NOT subtract reservations from displayed available again. Distinguish physical, available and reserved definitions; do not claim physical count without data.
- Versioned/conditional bulk adjustments with conflict handling and preview; adjustment history recorded prospectively with reason/time and actor context.
- Do not automatically release pending-payment reservations. Preserve existing reservation-review/payment reconciliation rules.
- DO NOT touch inventory while implementing other screens.

### 2.5 Hampers
- Two independently controlled workspaces: Curated Hampers (existing catalog tiers and occasions) and Self-Build Studio (staged category-first configuration).
- Curated: budget tiers, name, price, size, max choices, default/recommended, occasion labels/order, live preview, catalog-wide Save Draft / Publish Live; real delivery-price display must match checkout.
- Current delivery pricing code adds ₹50 per hamper on top of base published tier price; no change without owner approval.
- Self-Build: tabs Categories, Options/Sizes, Rules/Notes, Availability/Private Budgets, Packaging/Boxes (box management is NEW and must be mapped against actual buyer flow).
- Preserve category-first selection: Jewellery, Chocolates, Snacks, Teddy, Flowers, Personalised Photos, Custom Requirements and approved jewellery subtypes; NO automatic SKU mapping. Redundant standalone Bangles hidden only at UI level when Jewellery already represents them.
- Private internal budget policy currently uses 80% for tiers up to ₹999 and 75% at ₹1,299+, with an allowed additional max 5 percentage points for a final selection; derive calculations from actual catalog rather than hard-coded labels. Do not conflate delivery charges with the percentage target base.
- Preserve category availability, checked reserved units, multi-quantity, version locks, and hard DB-level Self-Build buyer checkout disabled; nothing in Admin V3 may expose internal costs to buyers or auto-enable checkout.
- Personalised-photo ₹50 owner requirement needs careful price-component mapping before implementation; avoid double charge.
- Self-Build existing payment review captures references, not fund transfers. Keep distinction visible.

### 2.6 Offers & Coupons
- Existing server-validated engine: automatic vs coupon; percent vs fixed; eligibility by hamper tier or individual-cart matching; min subtotal; cap; usage limits; first-paid-order audience; scheduled start/end; no stacking.
- V3 cards: Active/Scheduled/Inactive/Expired; editable campaign detail wizard (Basics, Discount, Eligibility, Limits, Schedule, Review). Search and image-assisted product picker.
- WARNING: existing individual product eligibility checks if at least one cart product matches, then discount calculation uses the qualifying whole-cart subtotal. Do not describe as selected-items-only discounts until a separate price engine change is implemented.
- Pricing simulator must run read-only pure logic without creating reserved quotes/orders or consuming usage slots; disclose assumptions.
- Preserve stable campaign IDs for analytics. Pause is supported through active flag; Archive/Duplicate/independent persistent draft are new designs needing backend work.
- Existing campaign config has optimistic version check; final review must summarize all pending changes because save publishes configuration immediately.

### 2.7 Customers
- NEW admin-only directory and detail pages: registered name, masked phone, account status, verified linked order count, verified spend, first/last purchase, saved address (restricted), support cases, notes (NEW, with audit).
- Tabs: Overview, Orders, Addresses, Support, Activity. Order snapshots, not current catalog, provide historical paid values/items.
- Read-only by default; avoid arbitrary customer edits/merges. No password, OTP, token, private authentication info, or admin impersonation.
- Registered accounts may have no orders. Do not link guest orders to a customer based solely on phone matching.
- New/Repeat/High-value segments are computed from verified authenticated customer-order linkage; no automated marketing messages.

### 2.8 Analytics & Customer Behaviour
- Sections: Overview, Sales, Products, Categories, Customers, Marketing, Profit/Expenses (NEW), Customer Behaviour (NEW).
- Existing analytics endpoint: anonymous hashed-session event counts for storefront_view, budget_selected, builder_started, checkout_reached, offer_shown and payment_started; paid/verified non-cancelled order totals, custom hamper requests, offer quotes/redemptions, campaign order performance.
- New daily/monthly trends, bestsellers, category sales and contribution calculations require safe server aggregations over historical paid order line items; don't reprice history from current catalog. Product unit sales exclude category-only hamper selections.
- GA4 client events include add_to_cart, begin_checkout, etc.; these do not automatically appear in internal DB analytics. Align definitions before presenting a unified funnel. Do not combine separate session identifiers or report cross-tool attribution without verified matching.
- Define CART ABANDONED as cart-add session with no checkout started within a chosen inactivity window (default proposal 60m); CHECKOUT ABANDONED as checkout started with no verified purchase after 60m; PAYMENT INCOMPLETE/REVIEW as distinct from abandonment; RECOVERED within configurable retrospective window (proposal 7d) when same verifiable identity/session completes paid purchase.
- Counts: anonymous aggregate abandonment, cart/checkout abandonment trend, products often left, quotes and paid recovery. Never mark all currently-open checkouts as abandoned or count the same session multiple times.
- Current individual cart and checkout draft live in browser localStorage; checkout draft expires after 7d; registered wishlist is saved to PostgreSQL, guest wishlist is local browser only. Admin cannot inspect arbitrary guests' stored carts/drafts without new opt-in server features. Identity is NOT presently stored by the internal conversion-event endpoint (explicit customerAccountId:null).
- Individual lists of abandoned customers only for securely matched registered/consenting activity with explicit access controls, retention and purpose limits. No unsolicited WhatsApp/SMS, no hidden collection of freeform address/phone, no invasive fingerprinting. Anonymous abandonment analytics works without exposing PII.
- Saved products counts use authenticated wishlist DB records. Saved cart counts would need new account-bound opt-in sync; do not imply existing server-held carts.
- Accurate net sales/ROI/true profits require refunds, purchase costs, shipping, gateway fees, packaging, overhead and tax treatment; show UNAVAILABLE or Estimated Contribution if inputs incomplete.

### 2.9 Settings & Security
- Store profile: WhatsApp/support email/helper copy/legal entity/address/grievance details already supported and publish to DB. Website brand/domain informational only, not a casual runtime toggle.
- Shipping: read-only Shipway/warehouse/service status and dedicated operations links; courier credentials and price rules not directly editable by browser.
- Payments: read-only integration health, gateway reference/reconciliation queues; no secret key exposure, refund simulation or direct payment-mode switch.
- Security: preserve existing admin WebAuthn passkeys and current password fallback lockout once passkeys exist. Passkey recovery is a deliberate server-side process. New multi-passkey management, session revoke and audit events require reviewed backend authorization controls. Never remove last passkey casually.
- Notifications: show verified order Telegram/web notification status without modifying working bot/webhook; low stock notification optional later.
- Policies: link existing pages; policy editing needs separate reviewed content workflow.
- Catalog history already exists; separate audit trail for inventory/offers/store settings NEW.
- Backup panel only displays verified status from authoritative backup/restore checks, never assumes backup exists. Catalog revisions != database backups. Distinguish permanent catalog photos from eligible private order photos; preserve 2-day post-delivery private media cleanup requirement for separately reviewed implementation.

## 3. Information architecture and route strategy

- Keep /admin as the gated entry, retaining the current admin session/passkey checks.
- Prefer internal admin navigation routes with guard at each read/mutation; avoid exposing customer PII from a publicly cacheable static route.
- Suggested UI routes (proposal only): /admin/overview, /admin/orders, /admin/orders/[id], /admin/products, /admin/products/[id], /admin/inventory, /admin/hampers, /admin/offers, /admin/customers, /admin/customers/[id], /admin/analytics, /admin/reviews, /admin/settings. Alternative component-based views acceptable if shared shell and navigation semantics are maintained.
- Keep existing endpoints/contracts working during UI migration. Add APIs only for verified unmet requirements; use same-origin checks, rate limits, idempotency where meaningful, transaction boundary and defensive validation.
- Admin pages noindex/no-store; customer data must never cross via public catalog API or analytics response. Do not make a credentials/status endpoint leak tokens.

## 4. Existing vs proposed new capability inventory

| Domain | Verified existing | V3 new work |
|---|---|---|
| Admin authentication | Password/passkey gated session | Multi-passkey management, security audit/session controls |
| Dashboard | Orders summary, operational filters | Unified KPI, action center, trend charts |
| Products | DB catalog version/draft/live, image upload, bulk CSV, local stock action | Paged list, editor, quick edit, impact review, richer SEO editor |
| Orders | List, transition guards, packing video, Shipway, issues | Dedicated detail, reliable timeline, optimized toolbar |
| Inventory | PostgreSQL available count + reservations, absolute PATCH | Atomic deltas, audit log, bulk edit, low-stock configuration |
| Hampers | Curated tiers/occasions, Self-Build private config/capacity, previews | Unified workspace, packaging editor, impact preview |
| Campaigns | Coupon/auto offers, nonstacking, limits, versioned config | Wizard, simulation, archive/duplicate, richer browse |
| Customers | Accounts, account-owned orders/addresses, wishlist | Read-only directory, linked analytics, support notes |
| Analytics | Conversion event aggregates, paid-order/campaign totals | Product/category/series, abandonment, recovery, exports/costs |
| Store settings | Support, legal/grievance config, catalog revision restore | Safe security/integration status and backup monitoring |

## 5. Data definitions to lock before UI implementation

- **Submitted order value:** total recorded created order amounts; NOT revenue.
- **Paid/verified order value:** non-cancelled verified payment amount under the current backend policy; show refunds separately until provider-verified reconciliation supports net.
- **Net collected sales:** provider-reconciled collected amounts minus confirmed refunds, when reliably available.
- **Average order value:** paid/verified order value divided by count of corresponding orders.
- **Available stock:** quantity available for new retail orders; already reflects reserved decrements. Not equal to measured physical inventory.
- **Low stock:** available stock >0 and <= configured alert threshold (proposal default 3).
- **Wishlist saved products:** counts drawn from authenticated customer_wishlist, not estimated from guest browser localStorage.
- **Abandonment:** event/window-based estimates; clearly label cohorts/sessions rather than claiming a known number of people. Pending payments categorized independently.
- **Conversion rates:** definitions, denominator, source and period shown in tooltip; track paid purchases safely without assuming exact client-to-order identities.
- **Campaign discount:** actual recorded discount per paid order, not guessed from list/MRP.
- **Contribution:** net sales less documented variable direct costs, not accounting net profit.

## 6. Security and privacy acceptance

1. Every admin read and mutation must check admin passkey/session auth server-side; origin check and rate limiting on writes.
2. Customer directory and abandoned checkout identities are sensitive. Default masking, minimal fields, admin-only endpoints, structured audit for access to sensitive changes, no credentials, no mass exports of phone/address by default.
3. Browser cart/draft data stays browser-local unless a separately approved opt-in sync feature is implemented. New analytics events must be minimised; do not collect unneeded PII.
4. Data retention rules are documented and enforced consistently with applicable policies; delete eligible private order photos only according to the verified post-delivery retention policy.
5. Money/quantity changes are transactional and validated. No frontend calculations can authorize a discount, payment, stock or refund.
6. New fields/schema require backward compatible additive DB migration, migration checks and rollback plan; existing records must remain valid.
7. No product image swaps, synthetic ratings/reviews, guessed GTIN, or false claims in SEO, policies, reports.

## 7. Development phases — after owner approves visual prototype

**Phase 0 — Freeze/audit:** Confirm latest main SHA, read AGENTS.md and CELEBRATION_PERMANENT_CHANGE_AND_SEO_RUNBOOK.md, inventory existing APIs/routes/data shape, backup/restore readiness, current screenshots and baseline QA. Separate branch off latest main, NO production.
**Phase 1 — UI shell/design system:** Auth gate, responsive desktop/mobile nav, shared components, visual baseline; no operational business mutations.
**Phase 2 — Products and Orders:** Product list/editor against existing catalog contract and order detail against current server transitions. Test read-only / save flows against isolated environment. Ensure no inventory/repricing regressions.
**Phase 3 — Inventory:** New transactional delta/bulk endpoints, history and reservation compatibility, low-stock status. Test concurrency with checkout/reservation. This is a higher-risk phase.
**Phase 4 — Hampers and Offers:** Curated + Self-Build interface preserving separate version contracts/private budgets/checkout disabled; improve campaign editor and dry-run simulator.
**Phase 5 — Customers/Behaviour:** Read-only directory, signed-in wishlist report, privacy-safe funnel and abandoned checkout aggregates. A separately approved identified recovery capability is optional and gated.
**Phase 6 — Advanced analytics/settings:** Validated product/category sales, cost data if approved, exports, read-only integration status, security/backup visibility. No unsupported claims.
**Phase 7 — Staging QA and owner walkthrough:** Compare desktop/mobile all screens, critical live-store regressions, payment/Shipway/Telegram smoke tests, accessibility and limited-load testing. Fix and obtain explicit approval.
**Phase 8 — Controlled production release:** Only after owner approval, follow existing tested main deployment + rollback procedure, monitor PM2 health, admin auth, order processing, checkout, catalog and stock. Document required follow-ups; no additional GitHub Actions schedules.

### Suggested delivery slices
A. Admin UI read-only/navigation (lowest risk) → B. existing supported editor workflows → C. inventory mutations/hampers → D. new customer and analytic data integrations/security. Do not deploy multiple unreviewed slices at once.

## 8. QA acceptance test matrix (minimum)

- All widths: mobile 320/360/390; tablet 768; desktop 1024/1440. No clipped buttons, sticky overlays, horizontal overflow.
- Auth: logged-out blocked, password-vs-passkey behavior unchanged, expired session blocked, no PII/cache leaks.
- Products: 1 SKU/edit draft/preview/publish, image failure, bulk CSV identity preservation, discard, version conflict, live storefront parity; SKU URL must not silently change.
- Orders: approved/blocked transitions; paid/pending distinction; packing video; Shipway booking vs shipped; manual fallback; claim/return, no fake refunds.
- Inventory: absolute/atomic add/remove, concurrent checkout reservation, bulk conflict, stock 0, no negative stock, no duplicate reservation release, independent stock save.
- Hampers: curated price+₹50 delivery current parity; 80%/75% internal rules; hidden category budgets; customer Self-Build OFF; no SKU mapping; outstanding reservation/payment review.
- Campaign: coupon eligibility; first paid order; automatic discount; max cap; no stacking; quote usage; version conflict; read-only simulator.
- Customers: proper account ownership; no phone-only merging; masked PII; linked orders correct; guest carts not visible.
- Behaviour analytics: no purchase / pending payment / recovered cases; 60m inactivity; repeat events deduplicated; private data minimized.
- Analytics: zero/empty states, period/tz boundaries, paid-only sums, refunds separately reconciled; large result pagination/export safely.
- Settings: no API secrets; passkey lockout; catalog history restore does not touch inventory; no unverified backup success indicators.
- Regression: public homepage/jewellery PDP/cart, payment success/failure/refund review, shipping status, Telegram worker flow, indexability/sitemap unchanged.

## 9. Release and follow-up format

For each approved PR: what changed, test evidence, affected DB migrations, impact on payments/orders/stock/SEO, deployment required, exact production verification performed, rollback instruction and when to recheck. Production acceptance is separate from design acceptance.

**STOP CONDITION:** This file is a master design specification, not authorization to implement new customer surveillance, modify checkout, rewrite payment/Telegram flows, or deploy to production.

## 10. Owner approval checklist (to finalize before implementation)

- Confirm desktop sidebar and mobile bottom tabs; choose whether Reviews and Custom Requests appear as main/secondary nav.
- Confirm dashboard metric definitions (verified vs collected/net) and date range.
- Approve Product editor behavior and catalog-wide pending-publish review.
- Approve 60-minute abandonment threshold and 7-day recovery window, or adjust; approve whether identified customer activity is desired and what consent/data retention applies.
- Approve whether new inventory Add/Remove/History/Bulk features should be part of V3 or deferred for safety.
- Confirm whether Profit & Expenses purchase costs should be manually entered, imported or deferred.
- Confirm which Store Settings pages are read-only and which are allowed to mutate runtime values.
- Sign off on the visual prototype and phased rollout. No main merge/deployment without explicit instruction.
