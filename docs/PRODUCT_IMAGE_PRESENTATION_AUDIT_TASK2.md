# Final polish — Task 2: photography inventory and card presentation

**Date:** 2026-10-10  
**Source:** `content/catalog.json` (seed) and `content/catalog-image-source-map.json` (same-SKU original provenance).  
**Per-SKU sheet:** [PRODUCT_IMAGE_ASSET_INVENTORY_TASK2.csv](./PRODUCT_IMAGE_ASSET_INVENTORY_TASK2.csv).  
**Status:** Code and source-identity audit complete. **True photography mix and physical-item visual sign-off remain pending.**

## What the available catalog proves

| Source group | SKU count | Catalog photos/SKU | Genuine alternate angles in seed |
| --- | ---: | ---: | ---: |
| Premium Anti-Tarnish Necklaces, first-party PNG | 22 | 1 | 0 |
| Necklace + Earrings Sets, rehosted R2 WebP | 15 | 1 | 0 |
| Trending Necklaces, rehosted R2 WebP | 28 | 1 | 0 |
| Gold-Plated Bangles & Bracelets, rehosted R2 WebP | 12 | 1 | 0 |
| Adjustable Rings, rehosted R2 WebP | 12 | 1 | 0 |
| **Total** | **89** | **1 each** | **0** |

The `67` rehosted photos retain their cryptographic provenance to the original uploaded URL, with usable `thumb`, `main` and `zoom` size derivatives. **Those WebPs are size variants of ONE image, not new angles.** The `22` necklace PNGs are already first-party photos and likewise have no additional photos in the seed. Live PostgreSQL inventory may contain changes not represented by this repository snapshot; re-audit live data before any replacement.

### What cannot honestly be concluded from URLs

The source metadata cannot reveal whether a particular source photo contains the same "model + logo + icons + A Little Sparkle" embedded composite, nor prove that an image shows a product-only, worn-on-model or real lifestyle angle. **No per-photo scene or composition has been declared verified in the CSV**; each is marked `PENDING_VISUAL_CHECK`. The user's observation of repeated composite artwork is the reason for this task; it is **not** grounds to classify every photo without looking at each actual original.

**Special hold:** The existing ownership audit detected identical rendered photo bytes for `celebration-necklace-030` and `celebration-necklace-031`. They are distinct catalog entries. Confirm the actual physical SKU before any swap, merge, image replacement or title change.

## What Task 2 changes now — without touching photographs

1. `CatalogCard` keeps `CatalogProductImage(product)` and adds a media mount around the **same, existing primary image URL**. It moves data-supported status badges into the text area, where they cannot obscure stones or labels.
2. The `clean`, `paper`, `folio` options vary surface, spacing and border. They are stable **visual frame** treatments only: the code never infers an image's content or assigns a claim such as "Model shot".
3. Card images are displayed with `object-fit: contain` and without color filters, overlays, fake textures on top of the photograph or hover zoom; the original photo (including any embedded composite copy) remains legible and unaltered.
4. The existing product identity, pricing, availability, 6-month-coverage eligibility, exact same-product fallback and checkout controls remain untouched.
5. Visual variants are responsive at 320–390px, while the existing 44px mobile cart/quantity controls and Section 1 image reliability layer remain in place.

## Genuine photo replacement queue — blocked on assets

To actually remove repeated AI-looking embedded composition, obtain **real, same-SKU, verified photo assets** with suitable permissions, and visually map them one by one. Suggested photography capture: a clean front/flatlay product-only frame, a detail/stone clasp close-up, optional correctly scaled on-model photo, and a natural lifestyle shot **only when photographed**. Do not conjure these views from CSS, another SKU or an unverified generated accessory. For each asset, record SKU, source/provenance, reference-match check, photo type established by viewing the image, aspect ratio, permission, dimensions and selected catalog role (primary/extra). Keep original image available until verified.

Once actual assets exist: update primary and optional gallery images for the matching SKU using the audited catalog source/update path. Reject mismatches before any DB write and verify product thumbnail, detail main, SEO and backup agree. Do **not** replace all images in a single blind batch. These asset changes are **not** part of this PR.

## Manual visual QA still required

- Desktop 1280px+, phone widths **320, 360, 390 and 430px**: verify original photo entirety, card readability, badge position, crop/contain treatment, hover/focus, Add to Cart touch targets and scroll behavior.
- Visually review **each of the 89 SKU photos** to classify composite/product-only/model/lifestyle *after viewing the actual bytes*. Compare with title, physical source and corresponding detail-page main image. Specifically resolve duplicate-byte SKU pair `030`/`031`.
- With a real browser and network trace, repeat critical image loading/offline/404 cases from [IMAGE_LOADING_QA_TASK1.md](./IMAGE_LOADING_QA_TASK1.md).
- Record screenshots and device/browser results before marking the visual/asset tasks `Done`.

## Deployment batching

**Owner request: no repeated VPS deployments.** Leave this Task 2 PR **unmerged** after passing CI. Subsequent numbered-task branches should build on this branch/head as needed. Bundle the approved, CI-tested work into **one final merge and one deployment** after the remaining tasks are complete. No automatic production release from this PR.
