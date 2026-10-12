# Celebration — Self-Build Hamper Architecture (admin-only staging)

**Owner-confirmed settings: 13 October 2026.** Effective data model: migrations **047 + 048**. Historical values in 047 (Large ₹400, photo once-only, unnamed ₹100 chocolate) are corrected by the applied-once 048 amendment; **do not edit historical migration 047**.

**Phase boundary:** PostgreSQL structure, seeded dynamic category/rate records, and secured admin read/write API. There is **no buyer-facing Self Build flow or private price leak**, no self-build checkout or inventory reservation, and no populated ready-made hamper stock. Existing curated hampers, jewellery selling prices, payment, invoices and courier logic are untouched. PostgreSQL constraints enforce `customer_enabled=false`, `show_item_prices=false`.

## Buyer experience to build later (not live)

1. Buyer chooses **Build Your Own Hamper**, then first sees **categories rather than products**.
2. Opening **Jewellery** shows eight named subcategories. Opening a subcategory later shows **only its accurately mapped available SKUs** with quantity controls. A standalone top-level Bangles category also exists; do not fabricate duplicate stock.
3. Chocolates, Snacks and Perfume expose DB-driven Starter/size options as applicable. Multiple quantities are allowed, constrained later by true stock, actual tier budget and packaging capacity — **no arbitrary one-item quantity limit**.
4. Personalised Photos: **₹50 per individual photo** of any count, never ₹50 for the whole group; photo upload/print workflow is not implemented yet.
5. Final **Anything Else?** field: buyer writes anything missing; the team discusses the request. Nothing additional is silently charged.
6. Buyer sees **no item-level prices**, no internal budget-consumption figures, and never receives the protected admin API data. The overall tier's advertised selling price is a distinct concept.

## Confirmed DB-driven Jewellery subcategories

The short first display label follows the owner's direction to keep wording compact:

| Order | Stored admin-editable display label | Private budget consumption per SKU × quantity |
| --- | --- | ---: |
| 1 | **Premium Feature Necklaces** | ₹60 |
| 2 | **Premium Necklaces** | ₹60 |
| 3 | **Necklace & Stud Sets** | ₹60 |
| 4 | **Korean Earrings** | ₹60 |
| 5 | **Indian Trending Earrings** | ₹60 |
| 6 | **Minimal Rings** | ₹60 |
| 7 | **Viral Bangles** | ₹150 |
| 8 | **Korean Bangles** | ₹150 |

All eight records have `parent_id='jewellery'`, `selection_kind='catalog'`, `charge_mode='per_unit'`, a numeric internal unit budget and editable `display_order`. These are **customer category labels confirmed by the owner**, **not a claim of existing catalogue product availability**. The storefront source catalogue currently has five differently named categories; the new labels are **not automatically mapped by fuzzy name**. Explicit `self_build_catalog_product_rules` SKU links remain to be supplied/verified through admin before showing actual products. In particular, Korean Earrings and Indian Trending Earrings do not imply any earring SKUs already exist.

Standalone top-level **Bangles** remains its own category at **₹150 per SKU per piece**. The owner-confirmed Viral/Korean Bangle categories also consume ₹150; there is no inferred price change to existing jewellery shop listings.

## Confirmed dynamic option amounts (private)

| Category | Starter | Mini | Medium | Large | Mega |
| --- | ---: | ---: | ---: | ---: | ---: |
| **Chocolates** | ₹100 | ₹200 | ₹400 | **₹600** | ₹1,000 |
| **Snacks** | — | ₹200 | ₹400 | **₹600** | ₹1,000 |
| **Perfume** | — | ₹200 | ₹400 | **₹600** | ₹1,000 |

The existing `chocolate-extra-100` option is renamed **Starter** and activated. Large is ₹600 **for all three groups**, Medium remains ₹400. These are **internal tier-budget consumption amounts**, not publicly displayed individual selling prices. Chocolates, Snacks and Perfume records represent **selection options, not verified warehouse goods**: actual availability, sizes, packing weight, brand/content and procurement must be confirmed before ordering is enabled.

**Personalised Photos:** `selection_kind='photo'`, `charge_mode='per_unit'`, `unit_budget_paise=5000`. The future authoritative server calculation must use **photo count × database unit budget**. E.g. count 1 → ₹50 internally, count 3 → ₹150 internally. Zero photos → ₹0. Admin may edit the amount and allowed charge mode later; there must be no customer-facing per-photo price. This migration intentionally updates the PostgreSQL charge-mode constraint to allow the new semantics.

**Other eligible mapped jewellery:** the fallback config contains **₹60** (`default_catalog_item_budget_paise=6000`). Within category budget, SKU-specific overrides can take priority, but only with verified SKU ownership.

## Storage and administration

- **`self_build_configuration`** — versioned, protected feature gates, default catalog-item internal budget, quantity policy and editable “Anything Else?” copy.
- **`self_build_categories`** — dynamic tree, sorting/activation, category kind, mapping and rate.
- **`self_build_options`** — edit any option label/rate/order/enabled state; new sizes can be added without a source-code deploy.
- **`self_build_catalog_product_rules`** — explicit verified SKU-to-category mapping, per-SKU overrides, activation. **No fake SKU rows seeded.**
- **`self_build_drafts`** — account-owned expiring draft storage; not wired to customer UI yet.
- **`self_build_order_snapshots`** — future immutable line-item and budget reference for accepted transactions; not wired to orders yet.

**Secured API:** `GET /api/admin/self-build` and `PATCH /api/admin/self-build` are admin-session-only with same-origin enforcement on writes, admin rate limits, private no-store response headers, strict normalization, atomic row-locked replacement, catalogue ID verification and optimistic-version conflict protection. The admin **API exists**, but the graphical admin editor does not yet exist. No public/customer route exports internal values. The backend contains no hardcoded item prices: the seed migration is initial editable DB data.

## Required before customer self-build can go live

1. Map real product IDs to the eight jewellery subcategories and standalone Bangles in admin. Verify each correct product image/SKU; do not infer Korean/Viral or special features from a random name/photo.
2. Confirm actual availability, units and packing economics for Chocolate, Snack and Perfume options; implement product quantity/stock and chocolate/food safety handling where applicable. Nothing here reserves inventory.
3. Implement a **private server quote** using versioned DB costs, valid quantities, tier remainder, physical capacity and real inventory. `per_unit` photos multiply by the count. Keep internal SKU costs out of buyer JSON, HTML, analytics and UI.
4. Implement transactional item stock reservation/expiry/cancellation release and immutable BOM for self-build orders before any payment action. Preserve existing curated hamper and individual retail paths.
5. Build the category-first selection UI, multi-quantity controls, photo handling, free-text discussion and mobile/desktop QA. Confirm no visible item prices, unexpected delivery promises or fabricated merchandise.
6. Add reviewed migration to remove the DB `customer_enabled=false` hard gate **only after** end-to-end safe fulfilment and payment tests pass.

**Status:** Owner's category labels, per-photo cost, Large rate and Starter label have no open wording questions. **Still pending:** exact SKU mapping to eight labels and physically available non-jewellery inventory/photographs. Those unresolved data must never be fabricated.
