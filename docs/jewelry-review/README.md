# Celebration Jewelry — 89-Product Photo / Name Verification Workspace

**Prepared:** 15 October 2026. **Status:** inspection only — NO product names, images, database contents, prices, stock or checkout have been edited.

## Start here

1. **[Full forensic report: what was checked, where and how](../JEWELRY_IMAGE_NAME_FORENSIC_AUDIT_20261015.md)** — read-only production database, public API, source keys, earlier 27 product name repairs, limitations and safe next steps.
2. **[Open / download the editable master CSV (89 rows)](./JEWELRY_89_SKU_VISUAL_REVIEW_20261015.csv)** — contains ID, category, current name, current photo and product links, verified original-upload links where present, historical master linkage and empty owner-review fields.
3. **Open the image comparison pages below** to inspect photos directly alongside current display names. Click any image for the large picture and use the product link to check the website.

## Product-wise picture boards

| Category | Products | Prior source/master name repair | Visual review sheet |
|---|---:|---:|---|
| Premium Anti-Tarnish Necklaces | 22 | 0 | [Photos & current names](./01-premium-necklaces.md) |
| Necklace + Earrings Sets | 15 | 15 | [Photos & current names](./02-necklace-earring-sets.md) |
| Trending Necklaces | 28 | 0 | [Photos & current names](./03-trending-necklaces.md) |
| Gold-Plated Bangles & Bracelets | 12 | 12 | [Photos & current names](./04-bangles-bracelets.md) |
| Adjustable Rings | 12 | 0 | [Photos & current names](./05-rings.md) |
| **TOTAL** | **89** | **27** | **ALL 89 REQUIRE HUMAN VISUAL VERDICT** |

**What the 27 previous repairs mean:** A master record and original source link were previously used to correct names in 15 sets and 12 bangles. The production DB currently contains those names. **Do not mark them visually verified automatically.** Previous evidence only proves the corrective source association used by the earlier process.

## How to record a decision

Open the CSV in a spreadsheet editor. Do not alter the `sku` key. For each product, fill `review_status` using exactly one of:

- `MATCH`: photograph really depicts the name; no fix necessary.
- `RENAME`: same correct SKU/photograph, but visible jewelry name/description is wrong. Supply `approved_product_name`, optionally `approved_description`, and evidence.
- `WRONG_IMAGE`: image is wrong for this SKU. Supply `approved_image_source` **only** if confirmed as the original image of that specific physical product; otherwise leave unresolved.
- `NEEDS_SOURCE`: original actual product/photo identity cannot be verified yet.
- `UNCERTAIN`: conflicting photo/name evidence; do not make changes without owner confirmation.

Fill `pictured_design_motif` in plain language (e.g. 'gold double heart with pearl', not speculative retail terms), `evidence_link_or_note`, `reviewed_by` and `review_date_IST` as available. Retain the original 89 rows and names for side-by-side comparison. Send an edited CSV back for a proposed correction list. If editing is inconvenient, reply with `SKU → photo shows → correct name` and attach the original photo for the affected SKU.

## How the CSV and visual boards were prepared

1. Used `content/catalog.json` at production source revision `acdd448e50d43dce1d33d58e9bd8fec35468b8ef`. The read-only live catalog audit found that this seed matches all 89 DB name/primary image pairs, so no storefront-vs-repo mismatch was introduced by the review sheet.
2. Joined each product by **exact SKU ID** to `content/catalog-image-source-map.json` (67 known original upload links) and `content/catalog-name-source-reconciliation-20261010.json` (27 prior, master-backed name changes). **Never joined by product-array index or by inferred visual similarity.**
3. For the 67 R2-rehosted images, the preview uses the *same SKU's* deterministic `/api/catalog/image?key=...thumb.webp` variant, with the main original retained as a clickable link. The 22 first-party necklaces use the already-published `/catalog/necklaces/...png` source.
4. The review CSV stores complete public URLs, not server paths, credentials or customer information. Each SKU also links directly to `https://shopcelebration.in/jewelry/{sku}`.
5. Checked category totals (22+15+28+12+12), 89 distinct product rows, 67 sourced records and 27 historical name repairs. All decisions initially set to **PENDING_VISUAL_REVIEW**.
6. These are **remote previews**: external image previews can sometimes be blocked by the GitHub interface or an image host. If a thumbnail does not load, click the product page / full-size image URL; a missing preview is not proof the item's image or title matches.

## Safe correction policy — read before approving

- Do not edit the live database by running a CSV import, and never change product IDs or move images to other SKUs automatically.
- After verifying a photo, write a *proposed diff* of only the affected SKU's name, description, alt text and **source-owned** image URL if truly necessary. Distinguish wrong *name* from wrong *image*.
- Take a catalog versioned snapshot first, preserve admin drafts and current order/product references, and require owner confirmation.
- Prices, guarantees, sales flags, retail declarations, inventory, product quantities, orders and payments must be left completely unchanged.
- Any code PR for fixes must pass audit/TypeScript/build, image-source ownership checks, and exact preview tests before separately authorized production deployment.

## Current status

**Production audit:** complete, read-only. **Visual comparison:** 89/89 rows awaiting owner/photo inspection. **Automatic repairs:** none. **Release:** not applicable; these are documentation-only GitHub files.
