# Final polish — Task 3: verified dynamic catalog badges

**2026-10-10 | Source of truth:** [FINAL_POLISH_AND_AI_FEEL_REMOVAL.md](./FINAL_POLISH_AND_AI_FEEL_REMOVAL.md)

## Problem identified in the source

- The seed contains **89 product badges** as legacy percentage strings: **65 × 25%**, 11 × 50%, 1 × 58%, 2 × 24%, 4 × 30%, 4 × 35%, 2 × 44%. All must be treated as presentation requests, **not verified discount facts**.
- The previous public resolver displayed the raw operator-entered `New` and `Bestseller` labels with **no actual publish-date or fulfilled-order evidence**. This is now blocked.
- The same **“Save ₹XX”** message was repeated for the ubiquitous legacy 25% MRP gap. Card and detail pages now show the existing legitimate **MRP comparison** without that repetitive slogan. Non-template, truly computed savings may appear only when the validated MRP is higher than the sale price.
- Existing limited-stock logic required an explicit `Limited` label **and** a current live quantity of 1–3. We keep this requirement: initial inventory of one unit per product must **not automatically** make 89 products look urgently scarce.
- `Sold out` remains the highest-priority public badge and is determined by live inventory/availability, not the editable label.

## Implemented verifiable data inputs

`lib/server/product-badge-evidence.ts` derives badges from **existing Postgres tables** without migrations:

| Badge | Public requirement | Source of proof |
| --- | --- | --- |
| **Sold out** | Individually listed and live available quantity `<=0` | `product_inventory` overlaid by existing inventory service |
| **Bestseller** | Category leader with **at least five distinct verified, paid, delivered individual orders in the last 120 days** | `orders` joined to `line_items`; exclude pending/cancelled/refunded |
| **New** | First time this SKU appears as active in a published revision **after the baseline revision** and within the last **21 days**; no future timestamp | `catalog_revisions` version + `created_at` |
| **Limited · N left** | Operator explicitly requests Limited, product is available, real remaining quantity **1–3** | Admin label plus current stock; never based on label alone |
| **N% OFF** | Mathematically computed from **safe integer positive MRP and current sale price**, percent 10–90 and **not the ubiquitous template 25%** | Existing `retail.mrpPaise`, `salePricePaise` |
| **No badge** | No valid evidence for the above | Default truthful empty state |

The **Bestseller/New evidence is added in server rendering only**, cached for 120 seconds, and discarded if unavailable. The normal admin catalog save explicitly does **not** persist or accept its signal fields. Frontend catalog home, listing, detail and related-product cards receive the same trusted server-derived signals. Ties for category leader may each legitimately qualify if there are enough verified orders. No fake counts or arbitrary random badge rotation.

**Data caveat:** We have inspected **schema and badge seed distribution**, not current live sales/revision rows; therefore we **do not claim** a particular product has the right to display New/Bestseller, and the live site may display neither until evidence exists.

## UI/price treatment

- Task 2's product-first design keeps badges **beneath the image** on cards; type-specific colours, corner shapes and readable mobile wrapping are refinements only.
- On product gallery detail views the badge is small, readable and sourced from the same resolver. No product photograph or identity was changed.
- The currently saved **MRP remains visible** if greater than price even when there is no “Save ₹XX” line. The API's price and prepackaged-retail declarations are untouched.
- A discount badge and a second savings line no longer repeat each other on catalog cards.

## Verification / release hold

- `scripts/test-verified-catalog-badges.mjs` exercises the **actual TypeScript evidence mapper** for leader vs non-leader, minimum genuine paid orders, baseline vs new publication, expired/future timestamps, inactive/non-retail SKU and malformed signal values. It also checks the SQL conditions and public entry points.
- `scripts/test-individual-catalog.mjs` now verifies that unverified operator `New`/`Bestseller` claims cannot appear, admin-supplied badge evidence is stripped, and old 25% savings copy is suppressed.
- **PR #91 CI SUCCESS:** GitHub Actions run `38033173093` passed `npm run audit` and `npm run typecheck`. Real-device badge visual QA and actual live DB evidence distribution remain **pending**.
- **NO PRODUCTION DEPLOY:** Per owner's request, all task changes remain on the **unmerged** `feat/final-polish-task2-media-cards-20261010` branch (PR #91). Continue Task 4+ on that branch and deploy **once at the end**, after testing.
