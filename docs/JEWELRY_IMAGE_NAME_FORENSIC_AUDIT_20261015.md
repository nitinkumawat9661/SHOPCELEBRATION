# Celebration Jewelry — Image / Product-Name Forensic Audit

**Date:** 15 October 2026 (IST)  
**Status:** Evidence collected from read-only production database and website catalog API; *visual identification and any corrections remain pending*.  
**Repository:** `nitinkumawat9661/SHOPCELEBRATION`  
**Production source revision examined:** `acdd448e50d43dce1d33d58e9bd8fec35468b8ef`  
**Safety:** No live DB updates, migration, image replacement, inventory mutation, payment operation or production deploy performed as part of this investigation.

## 1. The owner's issue

The owner reports that the **physical jewelry shown in the product photos does not match the product name**. The investigation was expressly asked to determine whether this comes from the PostgreSQL catalog data or from frontend rendering. A correctly stored URL does not itself establish that the photograph depicts the name attributed to the SKU.

## 2. What we inspected and how

### A. Repository and storefront data path

1. Read the exact production repository tree at the above SHA; reviewed server catalog loader, product normalization, API routes, collection cards, image gallery and placeholder/fallback component.
2. `lib/server/catalog.ts`: the live source is `catalog_config` row `id='primary'`, JSONB `payload`, with a monotonically changing `version`. `getCatalogConfig()` validates it with `normalizeCatalogConfig()` and decorates it with inventory availability. A seed from `content/catalog.json` is used only if the row does not exist, not as a normal replacement for existing DB state.
3. `app/api/catalog/route.ts`: dynamic GET returns the exact normalized DB-backed catalog (`Cache-Control: no-store`), not a separately mapped static frontend product list.
4. `features/catalog/CatalogCollection.tsx`: renders product tiles with `key={product.id}` and passes the whole product record to `CatalogCard`.
5. `features/catalog/CatalogCard.tsx`: renders both `<h3>{product.name}</h3>` and `primaryProductImage(product)` **from the same product record**. No random image assignment, independent index-based name/image join or cross-product fallback was found there.
6. `app/jewelry/[id]/page.tsx`: uses the route SKU to find the same catalog item by `item.id === id`. The page's heading, gallery, metadata and cart all use this one item. There is no distinct frontend mapping to blame on its face.
7. `lib/domain/catalog.ts`: `productImages()` uses `product.images` in its stored order and only prepends `product.imageUrl` if not already included. `primaryProductImage()` selects the first entry. It does **not** verify that the pictured motif matches the title.
8. `features/catalog/ProductGallery.tsx` and `SafeCatalogImage.tsx`: gallery state is keyed to the product SKU/image. `SafeCatalogImage` attempts a main/variant URL, then the supplied **same-image** fallback, then a branded unavailable-photo placeholder. A broken image could be a separate failure; it does not establish which physical jewelry is pictured.

### B. Historical image/name reconciliation checked

1. `content/catalog.json`: **89** SKU records — 22 premium necklaces, 15 necklace+earring sets, 28 trending necklaces, 12 bangles/bracelets and 12 rings.
2. `content/catalog-image-source-map.json`: **67** SKU-to-original-upload-URL / deterministic R2-image-key provenance records. The other 22 are first-party necklace PNG files stored under `public/catalog/necklaces/`.
3. `content/catalog-name-source-reconciliation-20261010.json`: **27** previously established source-linked name/description repairs — 15 necklace sets + 12 bangles. Those repairs had used earlier master-record evidence and exact original-upload URLs.
4. `db/migrations/037_catalog_image_name_exact_source_reconciliation.sql`: transactional, conservative name/description/alt repair. It checks the **prior name, same SKU, expected stored hero URL and gallery URL** before changing. It does not reassign an image to another SKU and does not edit stock, pricing, orders or inventory.
5. `scripts/test-catalog-source-name-and-mobile-grid.mjs`: source-level regression verifies these 27 known pairs against the repository seed and SQL guard. **This does not visually certify the 62 other designs, nor independently re-certify the 27 pictures by looking at the pixels.**

### C. Live production audit (October 15) — how it ran

The diagnostic script was created on a **separate unmerged audit branch** (PR #200), not on production. GitHub Actions opened a preconfigured SSH session to the existing VPS, changed to `/var/www/celebration/current`, and piped the script into Node from stdin. The GitHub SSH credential was used only in the Actions runner and was not printed.

- Audit script (unmerged investigation branch): `scripts/audit-live-jewelry-name-image-readonly.cjs`.
- Workflow (unmerged investigation branch): `.github/workflows/catalog-name-image-readonly-diagnosis.yml`.
- Workflow run: https://github.com/nitinkumawat9661/SHOPCELEBRATION/actions/runs/38747147380 (SUCCESS).
- Production DB accesses were guarded by PostgreSQL `PGOPTIONS='-c default_transaction_read_only=on'` and `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`.
- Read **only** `catalog_config`, `catalog_drafts`, `schema_migrations` (migration 037) and the latest 25 `catalog_revisions`; no customer data, purchases, inventories, payments or secrets were retrieved or printed.
- Checked per SKU: name and first primary photo, first gallery image vs hero URL, alt text, repeated hero URLs, source-key provenance, 27 historical corrected names vs stored names, and live row vs tracked seed.
- Queried `http://127.0.0.1:3040/api/catalog` locally on the production VPS after database read, then compared API SKU-name-primary-photo triples against DB.
- The diagnostic printed a machine-readable summary to GitHub Actions logs. GitHub masks a small sequence resembling a protected number (`***`); interpret the unmasked summary fields, not the literal masked numbers, as evidence.
- PR #200 was closed **unmerged** after successful audit so the investigative workflow was not added to the production build. Its audit branch remains an evidence reference.

### D. Exact results (observed, not inferred)

| Check | Observation |
|---|---|
| Live catalog | 89 SKUs, version **29** |
| Last recorded live catalog update | **2026-10-10 10:37:58.824 UTC** |
| Name reconciliation migration 037 | **Applied** at that same timestamp |
| Live catalog vs repo seed | **0** differing SKU names or primary image references |
| Live DB vs public `/api/catalog` | 89/89 matched; **0** name/primary-image differences |
| Historical 27 corrected SKU titles | **0** differences from recorded corrected names |
| Primary hero vs first stored gallery image | **0** differences |
| Main image alt text vs product title | **0** differences |
| Identical primary URLs assigned to different SKUs | **0** detected |
| R2 main URL key inconsistent with the known source map | **0** detected |
| Pending admin catalog draft | **None** |
| Source/physical-name identity independently established by prior reconciliation | **27** (15 sets, 12 bangles), still worth re-viewing visually |
| Remaining without equivalent prior name/physical-design reconciliation | **62** (22 original necklaces, 28 trending necklaces, 12 rings) |

**Interpretation:** The API reproduces the DB, and the React components display the corresponding SKU's stored title and media. The reported mismatch is therefore **not explained by a DB/API synchronization error or the examined frontend product association mechanism**. It is consistent with an **incorrect semantic label, originally mis-associated physical photo, or earlier title assignment already present in the canonical catalog**. This is a *leading hypothesis*, not a confirmed visual root cause: no trained visual review of all 89 physical items has yet been completed.

**Important limits:** Matching file URLs, hashes and SKU keys proves a consistent technical mapping to an uploaded asset, **not** that a photo really shows the described ring, necklace, stone or motif. An existing wrongly titled original source could pass every technical gate. A customer screenshot may also show stale cached imagery, though no cache fault is established from this audit. No physical per-item identification has been proven for the unreviewed set.

## 3. Why an automatic mass fix would be unsafe

- A title inferred from a filename or from the source URL alone could incorrectly describe the physical piece.
- Reordering jewelry images across SKUs can affect orders, returns, reviews and customer expectations.
- Original-first neck pieces (22 PNGs) and R2-rehosted assets (67) use different paths; do not replace them with each other's fallback images.
- An admin's saved draft or a newer catalog version can supersede earlier seed data. Repair must explicitly check the current version and preserve human edits.
- Catalog has price, stock, retail declarations, publication flags and order relationships; **never** rewrite the entire JSON document to fix a few product names without a scoped, version-checked patch.

## 4. Next step — 89-product visual reconciliation

1. Create a CSV with one row per SKU; link actual live product page, current primary image (and original upload if known), category, current name, provenance status and blank review fields.
2. Provide a picture-oriented Markdown contact sheet grouped by category. **Every one of the 89 products needs a human design/name verdict**, including the earlier 27 corrected from master records.
3. Owner reviews: photographed design/motif, material/stone claims, exact approved display name, description accuracy, hero/gallery alignment. Mark `MATCH`, `RENAME`, `WRONG_IMAGE`, `NEEDS_SOURCE`, or `UNCERTAIN`.
4. Any `WRONG_IMAGE` case requires locating the **exact same physical item's verified original photo**. Never swap images based only on visual similarity or move them from another SKU without explicitly confirmed source ownership.
5. Collect reviewed decisions only; record the reviewer and evidence source (master record, exact original image, or owner-provided product photo). Retain unresolved products pending confirmation.
6. Before any real repair, take an immutable snapshot/export of `catalog_config` payload and version. Generate **a dry-run report** of exact proposed SKU-level fields and have the owner approve.
7. Apply only approved title/description/alt changes or proven photo corrections using a version-checked transaction and a catalog revision; update a concurrently existing draft carefully. Never touch pricing, inventory, orders, payment, existing review records or unreviewed SKUs.
8. Post-repair validate affected `/jewelry/{SKU}` pages, API names/hero URLs, main image, thumbnails, cart identity, source-owner hashes, accessibility alt text, and rollback readiness.

## 5. Operational log and boundaries

| Stage | Action | Outcome |
|---|---|---|
| Repo inspection | Catalog server, API, React cards, gallery, first-party and R2 files inspected | Found single product-record rendering, no independent index join |
| Provenance inspection | 89 seed SKUs, 67 R2 original-source maps, 27 documented fixes inspected | Historical corrections visible in source |
| Read-only DB/AJAX verification | Exact production catalog, migration, draft, revision and live API compared | **SUCCESS**; no DB/website name or photo URL differences |
| PR #200 | Diagnostic files created on unmerged audit branch | Audit CI successful; branch PR then closed without merge |
| Production mutations | None | No records edited; no images moved; no deployment |
| Remaining | Visual review of every SKU + owner-approved targeted changes | **OPEN** |

## 6. Permanent source / audit references

- PR #200 diagnostic and review history: https://github.com/nitinkumawat9661/SHOPCELEBRATION/pull/200
- Read-only audit job: https://github.com/nitinkumawat9661/SHOPCELEBRATION/actions/runs/38747147380
- Diagnostic source on its audited branch: https://github.com/nitinkumawat9661/SHOPCELEBRATION/blob/17657e7ecfd84aa332b526d1441c987a75453228/scripts/audit-live-jewelry-name-image-readonly.cjs
- Snapshot branch at diagnosis: https://github.com/nitinkumawat9661/SHOPCELEBRATION/tree/acdd448e50d43dce1d33d58e9bd8fec35468b8ef
- Existing migration: `db/migrations/037_catalog_image_name_exact_source_reconciliation.sql`
- Source/title evidence: `content/catalog-name-source-reconciliation-20261010.json`
- Original source provenance: `content/catalog-image-source-map.json`
- Canonical seed: `content/catalog.json`
- API and components: `app/api/catalog/route.ts`, `lib/server/catalog.ts`, `features/catalog/CatalogCard.tsx`, `features/catalog/ProductGallery.tsx`

## 7. Safety state after this report

**Investigation completed; visual identity verification is NOT completed.** Documentation and future review sheets are non-deploying source artifacts. No automatic catalog renames/image swaps are authorized by preparing this report. PR #198 (separate Self-Build packaging work) is not part of this investigation.

## 8. Owner-supplied physical-photo/name decisions — 16 October 2026

The owner has now provided a 22-row exact SKU, pictured-motif and proposed product name table for all Premium Anti-Tarnish Necklaces. The [CSV](./jewelry-review/JEWELRY_89_SKU_VISUAL_REVIEW_20261015.csv) and [photo board](./jewelry-review/01-premium-necklaces.md) preserve all 22 assessments. This does not constitute an independent image-by-image review by the assistant.

- **Keep name (11):** 001–006, 010, 013, 019, 020, 022.
- **Rename requested (11):** 007 Clover, 008 Crown Teardrop, 009 Bow Teardrop, 011 Fan Crystal, 012 Gold Clover, 014 Snowflake, 015 Moon Heart, 016 Teddy Bear, 017 Rose Gold Teddy Bear, 018 Rotating Flower, 021 Star Heart.
- **Remaining 67:** no new owner visual verdict yet; do not classify prior 27 technical name repairs as owner visual approvals.
- **Exact-title collision:** user-supplied name for 011 matches 001 exactly, despite distinct photos and SKUs. Confirm if a color/style qualifier is desired before final release; do not silently change either.
- Writing these assessments to documents does not update production DB, website images, product IDs, prices, stock, orders or payments.
