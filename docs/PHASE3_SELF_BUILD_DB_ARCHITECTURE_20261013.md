# Celebration Self-Build Hampers — Final Category-Only Architecture

**Decision confirmed: 13 October 2026.** Current state is staging migrations **047 → 048 → 049** and an authenticated, admin-only category/settings API. Historical 047 and 048 are retained as already-applied migrations; **049 replaces the old SKU-oriented structure**.

## Owner's final selection model

**Self Build → Categories → category/size + quantity → gift details → checkout (future).**

The customer **does not select or see individual catalogue product SKUs**. They choose only a **category and quantity**. Celebration decides the exact included items in the selected categories during fulfilment. There is no connection to the jewellery storefront catalogue's per-product stock, retail price, name or photo. The individual product assortment in a hamper must not be advertised as buyer-chosen.

**Two modes remain conceptually separate:** existing, live **Celebration Curates** checkout is unchanged; proposed **Choose Categories for My Hamper** is **not yet available to customers**. It must remain disabled until category-level fulfilment and checkout checks are complete.

### Jewellery → Eight DB-controlled subcategories

| Order | Category label | Private budget consumption per category unit |
|---|---|---:|
| 1 | Premium Feature Necklaces | ₹60 |
| 2 | Premium Necklaces | ₹60 |
| 3 | Necklace & Stud Sets | ₹60 |
| 4 | Korean Earrings | ₹60 |
| 5 | Indian Trending Earrings | ₹60 |
| 6 | Minimal Rings | ₹60 |
| 7 | Viral Bangles | ₹150 |
| 8 | Korean Bangles | ₹150 |

There is also a separate **Bangles** top-level category at **₹150 per unit**. These are category names, **not links to actual store SKUs**. Product identifiers and catalogue-category mapping are not needed or used.

### Other DB-controlled category options

| Category | Starter | Mini | Medium | Large | Mega |
|---|---:|---:|---:|---:|---:|
| Chocolates | ₹100 | ₹200 | ₹400 | ₹600 | ₹1,000 |
| Snacks | — | ₹200 | ₹400 | ₹600 | ₹1,000 |
| Perfume | — | ₹200 | ₹400 | ₹600 | ₹1,000 |

All numbers in these tables are **internal hamper budget-consumption values**, not customer-visible unit prices. They are editable in the database through the admin API, not hardcoded in the customer UI. The externally advertised **whole-hamper tier** price is independent. Do not show a visible per-category rupee amount, or a live remaining-₹ differential that would expose it.

**Personalised Photos:** ₹50 **for each photo**. When quantity is 1, the internal consumption is ₹50; when 3, it is ₹150. Store the category as `photo` with `charge_mode='per_unit'`. Photo upload/printing support does not exist yet.

**Anything Else?** Free-text field. DB-provided prompt: “Need anything else? Describe it here. Our team will discuss your request with you.” Extra requests are not auto-charged. Team review determines availability and any separately agreed change.

### Quantity and availability

No artificial one-piece limit: a buyer can request multiple units of one category, chocolate size, snack size, perfume size or photos **subject to real category-level inventory, budget and physical hamper size**. Exact SKU mapping is not part of this architecture. Future back-office stock management can track **category/option available units** directly; no automatic reservation can be made against existing retail jewellery SKUs.

Because no per-SKU mapping exists, category fulfilment is **staff-curated within the chosen categories**. Do not imply the buyer receives a particular design or guaranteed product without owner-approved fulfillment rules. If category stock/packing information cannot be verified, keep that choice unavailable rather than accept payment for it.

## Actual DB migration 049

- Converts the eight jewellery subcategories and standalone Bangles from old `selection_kind='catalog'` to **`selection_kind='category'`**, with internal **`per_unit`** amount. All other top-level categories, labels, pricing, photo semantics and size options from 048 remain unchanged.
- Removes `self_build_catalog_product_rules` and `catalog_category` fields; therefore there is **no SKU-to-hamper/category mapping**. Migration explicitly refuses to remove the old records if any mapping already exists, to avoid silent data loss.
- Keeps category tree hierarchy, admin sorting, active flags, and option size/amounts as dynamic DB values. Bumps the settings version so outdated admin edits cannot overwrite the revised structure.
- Preserves Postgres `customer_enabled=false` and `show_item_prices=false` constraints: no accidental customer rollout or item-price exposure.
- No live jewellery retail stock, order, price, saved address, payment flow, courier workflow or ready-made hamper inventory is altered.

## Admin-only API

- `GET /api/admin/self-build`: private, authenticated read for **`version, config, categories, options`**.
- `PATCH /api/admin/self-build`: authenticated, same-origin, rate-limited, atomic, version-checked update of the above. The API **rejects old `productRules`, product IDs and `catalogCategory`**. Admin can change category names, active status, order, internal budget and size options without deploying the site.
- There is **no graphical admin editor yet**. There is **no public self-build endpoint or widget**. Never call this API from browser-side customer code: admin-only internal budget numbers must remain confidential.

## Next implementation steps (not shipped in this architecture update)

1. **Category-first customer UI** behind disabled feature flag: eight jewellery tiles, separate Bangles, Chocolates/Snacks/Perfume sizes, personalised photo quantity, other-request field, easy back/edit path. No individual SKU/photo wall.
2. **Category/option inventory model** editable by admin. Staff confirms how many units they can fulfil per category or size, rather than pretending the retail jewellery inventory provides that promise. Admin marks unavailable choices.
3. **Authoritative server quote and budget guard**: use only DB unit costs, quantity, tier capacity and verified availability. Customer receives eligibility/validation and total hamper price, **not** hidden per-item budget consumption.
4. **Order snapshot + atomic category-unit reservations and cancellation release**, validated quantity, packing/BOM, shipping/serviceability and support review for custom text, preserving the existing curated flow.
5. **Admin settings UI + integration tests** (stale admin config, category budget, duplicate submit, unavailable categories, multi-quantities, photos) and real mobile/desktop visual QA. Only after verification consider enabling self-build customer checkout with a separately reviewed change.

**No outstanding SKU mapping work.** Do not introduce it without an explicit future owner request.
