# Catalog name/photo reconciliation and jewelry mobile fix — 10 October 2026

## Confirmed source issue

The website database owns photos by SKU. **Image ownership by hash alone does not prove the product title is correct.** For 15 necklace-and-earrings sets, the previously published names and descriptions were assigned based on a mismatched order. The reference document `Celebration_Meesho_Master_Catalog_2026-10-10.xlsx` lists different names for the **exact same original uploaded image URL**. The 12 bangles also have distinct reference catalog names for their exact uploaded media URL.

A deterministic comparison found **27 exact URL-to-source references** (15 sets + 12 bangles). Each upload URL matches the **same** SKU's existing R2 SHA-addressed original and `images[0].fallbackUrl` in source control. The original image is **never moved to another SKU**. We correct these titles in the fallback seed and, on production migration, only on matching legacy live catalog records.

This evidence establishes the source-sheet association; the spreadsheet itself explicitly says its statuses are not Meesho-server verified and filename duplicates are not physical SKU proof.

## Exact original-source-matched corrections

| Website SKU | Existing wrong/alternate name | New source-associated name | Excel record |
|---|---|---|---|
| `celebration-set-001` | Korean Pearl Halo Crystal Necklace & Earrings Set | **Black Crystal Cat Necklace & Earrings Set** | CEL-MASTER-0172 |
| `celebration-set-002` | Korean Cute Teddy Bear Crystal Necklace & Earrings Set | **Blue Heart Butterfly JD Stone Necklace & Earrings Set** | CEL-MASTER-0167 |
| `celebration-set-003` | Snap Ghost Crystal Necklace & Earrings Set | **Dolphin Halo JD Stone Necklace & Earrings Set** | CEL-MASTER-0168 |
| `celebration-set-004` | Korean Blue Heart Butterfly Necklace & Earrings Set | **Crystal Cat Teardrop Necklace & Earrings Set** | CEL-MASTER-0177 |
| `celebration-set-005` | Korean Dolphin Crystal Necklace & Earrings Set | **Oval Pearl Halo JD Stone Necklace & Earrings Set** | CEL-MASTER-0164 |
| `celebration-set-006` | Korean Trinity Heart Pearl Necklace & Earrings Set | **Crystal Ghost JD Stone Necklace & Earrings Set** | CEL-MASTER-0166 |
| `celebration-set-007` | Korean Pink Love Crystal Necklace & Earrings Set | **Eiffel Tower Pearl Necklace & Earrings Set** | CEL-MASTER-0178 |
| `celebration-set-008` | Korean Mother-of-Pearl Bar Necklace & Earrings Set | **Mother-of-Pearl Dolphin Necklace & Earrings Set** | CEL-MASTER-0173 |
| `celebration-set-009` | Korean Black Cat Crystal Necklace & Earrings Set | **Trinity Heart Pearl JD Stone Necklace & Earrings Set** | CEL-MASTER-0169 |
| `celebration-set-010` | Korean Mother-of-Pearl Dolphin Necklace & Earrings Set | **Black Butterfly JD Stone Necklace & Earrings Set** | CEL-MASTER-0174 |
| `celebration-set-011` | Korean Black Butterfly Crystal Necklace & Earrings Set | **Butterfly Pearl Drop Necklace & Earrings Set** | CEL-MASTER-0176 |
| `celebration-set-012` | Korean Pearl Crescent Crystal Necklace & Earrings Set | **Double Heart Pearl Necklace & Earrings Set** | CEL-MASTER-0165 |
| `celebration-set-013` | Korean Butterfly Pearl Drop Necklace & Earrings Set | **Pearl Bar Rectangle Necklace & Earrings Set** | CEL-MASTER-0171 |
| `celebration-set-014` | Korean Blue-Eye Cat Crystal Necklace & Earrings Set | **Pearl Crescent Halo Necklace & Earrings Set** | CEL-MASTER-0175 |
| `celebration-set-015` | Korean Eiffel Tower Pearl Necklace & Earrings Set | **Pink Crystal Double Heart Necklace & Earrings Set** | CEL-MASTER-0170 |
| `celebration-bangle-001` | Korean Contemporary Open Cuff Gold Bracelet | **Celebration Auric Festive Cuff Bracelet** | CEL-MASTER-0052 |
| `celebration-bangle-002` | Korean Daisy Flower Gold Bangle | **Celebration Daisy Bloom Gold Bangle** | CEL-MASTER-0053 |
| `celebration-bangle-003` | Korean Evil Eye Nazar Gold Bracelet | **Celebration Nazar Eye Gold Bracelet** | CEL-MASTER-0054 |
| `celebration-bangle-004` | Korean Filigree Ridge Gold Bangle | **Celebration Regal Ridge Gold Bangle** | CEL-MASTER-0055 |
| `celebration-bangle-005` | Korean Geometric Line Gold Bangle | **Celebration Halo Line Gold Bangle** | CEL-MASTER-0056 |
| `celebration-bangle-006` | Korean Sculpted Open Cuff Gold Bracelet | **Celebration Sculpted Arc Gold Cuff** | CEL-MASTER-0057 |
| `celebration-bangle-007` | Korean Minimal Curve Gold Bangle | **Celebration Signature Curve Gold Bangle** | CEL-MASTER-0058 |
| `celebration-bangle-008` | Korean Chain Link Gold Bracelet | **Celebration Classic Link Gold Bracelet** | CEL-MASTER-0059 |
| `celebration-bangle-009` | Korean Heart Charm Gold Bangle | **Celebration Amour Heart Gold Bangle** | CEL-MASTER-0060 |
| `celebration-bangle-010` | Korean Serpent Twist Gold Bangle | **Celebration Serpent Twist Gold Bangle** | CEL-MASTER-0061 |
| `celebration-bangle-011` | Korean Square Geometric Gold Bangle | **Celebration Geo Square Gold Bangle** | CEL-MASTER-0062 |
| `celebration-bangle-012` | Korean Butterfly Charm Gold Bangle | **Celebration Wing Charm Gold Bangle** | CEL-MASTER-0063 |

## Production database guard rails

`db/migrations/037_catalog_image_name_exact_source_reconciliation.sql` is included in the standard transactional migration sequence.

- A DB row can change only when the **SKU**, **original previous product name**, **main source-hash R2 image URL** and **first gallery image URL** all match the reviewed evidence. A manually edited product name or image **is not overwritten**.
- Updates name, matching image alt text, and the master-source description for 15 sets; bangles keep their existing product-specific description.
- Preserves `id`, image URL/fallback, price/MRP, all inventory, categories, warranties, payment/order and customer data. Original photo URLs are unchanged.
- Increments live catalog version and inserts a `catalog_revisions` rollback record **only when at least one target changes**.
- Preserves existing admin draft and rebases the draft when it was current; never deletes unpublished edits.
- Migration runs once, and safe source/name equality makes the repair idempotent.

**Important production caveat:** The deployment migration may update fewer than 27 rows if the admin already edited their names/images or the live data differs from the known previous snapshot. Inspect the deployment `NOTICE` count or a protected read-only DB audit for the actual number. Do not report 27 live edits until that count is observed.

## Still not automatically renamed

**62 remaining source rows require stronger evidence**, not a spreadsheet filename guess:

- 28 second-batch necklaces: uploaded URLs differ from the master and the same filename occurs in **two** catalog sections (Necklaces & Chains and Pendants).
- 12 rings: similar filenames occur in the master under other upload timestamps; filenames and similar old names alone are **not** definitive original-photo proof.
- 22 locally hosted first-batch necklaces: those 22 first-party PNGs are not linked in the master image URL table.

For these products, retain current image/name instead of making another potentially incorrect physical SKU assignment. Compare actual front-facing product images/physical products, and record a verified mapping before correcting them. In particular, `celebration-necklace-030` / `031` have a prior duplicated-image-content warning and must not be fixed by guessing a name.

## Jewelry and navigation mobile behavior

- The **Jewelry collection** route `/jewelry` and `/jewelry?view=all` uses **2 genuine product cards side by side** through 320–700px, independent of homepage cards.
- The large jewelry hero banner is shorter (around 150–162px) and scrolls away naturally.
- The six-link large mobile navigation/search area collapses on downward scroll after 180px, leaving a compact brand and account/cart bar; it reopens on upward scroll, when returning to the top, or on keyboard focus. Hidden elements are inert, preserving keyboard safety.
- All six original navigation destinations remain; no shopping functionality or checkout field removed.

## Verification / release

`scripts/test-catalog-source-name-and-mobile-grid.mjs` checks all 27 original upload hashes and resulting seed/gallery/name consistency, SQL name/photo/data guards, two-column collection CSS and mobile header behavior. Run full PR verification (`npm run audit`, `npm run typecheck`, `npm run build`), then **one combined deployment**. Actual phone screenshots and read-only production migration counts are still needed for complete acceptance.
