# Celebration Self-Build Hamper — Database Architecture (STAGING)

**13 October 2026 · Implementation phase: DB + secured admin API only.**  
This does **not** create a customer-facing self-build wizard, change the curated hamper, change jewellery retail prices, create warehouse stock, accept self-build payments or reserve inventory.

## A. Owner's approved interaction architecture

Customer enters **Self Build → Category chooser first**, not a product wall. Categories/subcategories and labels are **database records** editable by admin, not hardcoded React arrays. Within Jewellery, subcategories correspond to the real jewellery assortment only; customer chooses multiple quantities of eligible products. A separate **Bangles** category also exists. For Chocolates, Snacks and Perfume, customer chooses sizes, not a fake catalogue product. Personalised Photos have one fixed **total** consumption when selected, even if 2+ photos; no per-image charge. There is a final optional **Anything Else?** free-text request; the team discusses the request instead of silently charging for it.

**Do not expose item consumption prices in customer UI or public API**. Tier budget is the hamper's advertised selling price; internal consumption is not an individual jewellery selling price. Photo capture/upload is not implemented at this stage.

### Initial internal rules saved in PostgreSQL (admin editable, paise)

| Source | Internal budget | Charging behaviour | DB state |
| --- | ---: | --- | --- |
| Other eligible jewellery products | ₹60 **per item** | Category default; SKU override possible | Unmapped, not customer exposed |
| Stylish bangles (existing jewellery source category) | ₹150 **per item** | Explicit matching SKU must receive 15000-paise override | **SKU list awaiting owner verification** |
| Standalone Bangles category | ₹150 **per item** | Explicit SKU rules; multiple units supported | **SKU list awaiting owner verification** |
| Chocolates: Mini | ₹200 | Per selected pack | Staged |
| Chocolates: Medium | ₹400 | Per selected pack | Staged |
| Chocolates: Large | ₹400 | Per selected pack | Staged **same as Medium, intentionally** |
| Chocolates: Mega | ₹1,000 | Per selected pack | Staged |
| Chocolates: extra ₹100 choice | ₹100 | Per selected pack | **Inactive** until its customer-visible name is confirmed |
| Snacks: Mini / Medium / Large / Mega | ₹200 / ₹400 / ₹400 / ₹1,000 | Per selected pack | Staged |
| Perfume: Mini / Medium / Large / Mega | ₹200 / ₹400 / ₹400 / ₹1,000 | Per selected item | Staged |
| Personalised Photos | ₹50 **total when any photo count ≥1** | Once per entire category; 1 and 20 photos have the same ₹50 consumption | Staged; upload not implemented |
| Other requests | No automatic charge | Free text; contact/review required for additional items | Prompt admin editable |

**Rule hierarchy for a future verified quote:** explicit SKU `unit_budget_paise` override > category `unit_budget_paise` > config `default_catalog_item_budget_paise`, for catalog-backed items. `variant` uses the selected option's DB value × quantity. `photo` charges DB category amount **once**, regardless of the photo count (provided count >0). `notes` never automatically quotes extra products. Validate total <= selected tier and actual stock/capacity *on the server* before charging. This formula is a planned contract, **not a live checkout implementation**.

**Multiple quantities:** no arbitrary `max_quantity=1` for product, pack, or photo in this model. A future checkout must enforce real stock, remaining budget, physical packing limits and input-safety constraints; no promise of unlimited physical supply.

## B. DB tables in migration 047

- `self_build_configuration`: singleton; versioned/admin editable default budget contribution, multiple-quantity setting and discussion prompt. **DB CHECK permanently forces `customer_enabled=false` and `show_item_prices=false` for this staging migration**. Later activation requires reviewed migration + backend/payment/stock implementation.
- `self_build_categories`: dynamic tree, sort order, active state, source catalogue category mapping, kind and internal charge mode. Jewellery child categories must be created using exact owner-approved names.
- `self_build_options`: admin-editable size labels and budget amounts for variant categories; Chocolate's unnamed ₹100 option is deliberately inactive.
- `self_build_catalog_product_rules`: explicit SKU→category mapping + optional budget override; no inference from product name, another SKU's images or retail MRP. Can explicitly map a stylish bangle to a category and override it to ₹150.
- `self_build_drafts`: account-owned, expiring JSON selection draft; **no application writes yet**.
- `self_build_order_snapshots`: reserved slot for frozen itemized order rules and total; **not populated**, not a live stock reservation, and no payment integration yet.

There is no destructive modification of existing `catalog_config`, `orders`, `inventory_reservations`, `product_inventory`, payment or checkout schemas. Migration is additive and applied by existing `scripts/migrate.mjs` only after passing CI.

## C. Secured admin integration interface

- `GET /api/admin/self-build`: requires verified admin session; returns current DB configuration, categories, options, product rules and version; `Cache-Control: private, no-store`.
- `PATCH /api/admin/self-build`: verified admin session, **same-origin enforcement**, admin mutation rate limit, size-limited validated JSON; sends the complete GET payload fields `version`, `config`, `categories`, `options`, `productRules`; returns new version on success.
- The PATCH is **atomic** (transaction + row lock); requires exact version, returns HTTP 409 for stale editor writes, checks unique IDs and valid group tree, rejects nonexistent source catalog categories and fake product SKUs.
- Prices, sizes, ordering, labels, category activation and free-text prompt can change through this admin API without redeployment. Admin UI may consume this API later; **no UI widget has been introduced in this phase**.
- Both staging gates (`customerEnabled=false`, `showItemPrices=false`) must stay false. **Never consume this admin endpoint from customer JavaScript; its private monetary fields are not customer-safe.**

## D. Clarification still required BEFORE building any customer-facing picker

1. The owner's **seven real Jewellery category names**: the checked-in current catalogue has **five nonempty** distinct category labels: Premium Anti-Tarnish Necklaces, Necklace + Earrings Sets, Trending Necklaces, Gold-Plated Bangles & Bracelets, Adjustable Rings. The homepage additionally creates an empty “Earrings” shortcut and separate “All Jewellery”. Do **not** invent or substitute the remaining names. Admin will add the seven verified child categories and explicitly link their products.
2. **Which exact SKU IDs count as “stylish bangles”** at ₹150? The existing combined Gold-Plated Bangles & Bracelets category doesn't prove that every item is stylish. Do **not** apply ₹150 to all SKUs by string-matching.
3. Label for the additional **₹100 chocolate size**. DB contains a disabled choice with provisional *admin-only* label; rename before activation.
4. Which **real chocolates, snack packs and perfumes**, pack sizes, stock and packing weights are available? No SKU or inventory is fabricated by this migration.
5. Are ₹60/₹150/₹200... numbers intended as *internal budget consumption*, separate from the actual sale price of the full hamper? This architecture interprets the word “budget consume” exactly that way. The store keeps its existing jewellery prices untouched.
6. How should multiple photos be provided and printed? One per-unit charge is **not** introduced; upload and fulfilment need later specification.

## E. Production launch gate for future work

**No self-build order yet.** Before customer activation, implement catalogue/stock-backed choices, quote validation (including tier rules), SKU quantities, a frozen itemized BOM, transactional inventory reservation/expiry and cancellation release, real packing constraints, payment integration, customer privacy-safe APIs, fulfilment approval and sandbox checkout + concurrency tests. Keep current **Celebration Curates** route independent. No real ready-made bundles without owner-provided contents, media and stock.

**Guarantees in this phase:** all new monetary values are stored in DB, not hardcoded into user-facing app code; only admin can change them; disabled customer mode; no claim of payment-tested self-build orders.
