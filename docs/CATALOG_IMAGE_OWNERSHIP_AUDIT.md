# Section 1 — Celebration Catalog Image Ownership & Verification

**Recorded:** 2026-10-10 · **Scope:** Image hosting, per-SKU provenance, fallback; no product-name or image substitutions.

## Verification outcomes

- **Gate 1 — Unique SKU/source mapping:** 89 unique SKUs, 0 image URLs reused across two SKUs in the current catalog.
- **Gate 2 — Cryptographic original-source match:** 67 rehosted Meesho photographs mapped to their exact original URL's SHA-256 and the same SKU; no remaining primary Meesho URLs in live catalog.
- **Gate 3 — Gallery/backup consistency:** 67 R2 SKU main images match their hero; each fallback bound to the corresponding original image URL, never another product.
- **Gate 4 — Storage integrity:** all **201** R2 WebP variants (`thumb`, `main`, `zoom`) verified, 22 original first-party necklace URL checks passed. One exact-byte duplicate between two SKU IDs detected; it **requires visual review**.
- **Production:** 67 Meesho image sources rehosted in R2; 134 references switched; later 67 per-product original Meesho fallbacks added to PostgreSQL in a separate transaction.
- **Display priority:** Celebration-hosted image → original Meesho for that exact same photo (where applicable) → branded placeholder.
- **Not certified by these checks:** semantic correctness of every photo compared to a physical item, complete conversion of 22 pre-existing PNG photos to WebP, real-device failure simulation.

## Manual visual review required

| Product ID | Catalog label | Finding | Required action |
| --- | --- | --- | --- |
| `celebration-necklace-030` | Korean Dazzling Star Pendant Necklace – Silver | Rendered image bytes identical to `-031` | Verify against the original physical-product reference before making any change |
| `celebration-necklace-031` | Korean Dazzling Star Pendant Necklace – Sparkle | Rendered image bytes identical to `-030` | Verify against the original physical-product reference before making any change |

The title, filename and URL hash prove neither physical identity nor which image should be displayed. **Do not swap images or relabel the two SKUs by guessing.**

## Per-product URL ownership audit (NOT physical/visual sign-off)

| SKU | Product name | Current primary | Meesho fallback | Source identity |
| --- | --- | --- | --- | --- |
| `celebration-necklace-001` | Korean Fan Crystal Pendant Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-002` | Korean Bow Crystal Pendant Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-003` | Korean Four Heart Convertible Pendant Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-004` | Korean Double Heart Crystal Pendant Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-005` | Korean Love Key Crystal Pendant Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-006` | Korean Square Dancing Stone Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-007` | Korean Crown Dancing Stone Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-008` | Korean Teardrop Dancing Stone Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-009` | Korean Heart Dancing Stone Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-010` | Korean Wave Dancing Stone Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-011` | Korean Gold Flower Dancing Stone Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-012` | Korean Teddy Bear Dancing Stone Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-013` | Korean Flower Dancing Stone Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-014` | Korean Moon Heart Dancing Stone Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-015` | Korean Pearl Flower Pendant Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-016` | Korean Rose Gold Teddy Bear Crystal Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-017` | Korean Gold Flower Medallion Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-018` | Korean Open Flower Crystal Pendant Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-019` | Korean Pearl Flower Halo Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-020` | Korean Twist Dancing Stone Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-021` | Korean Spiral Flower Crystal Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-necklace-022` | Korean Heart Halo Dancing Stone Necklace | Existing Celebration PNG | Not applicable | First-party original |
| `celebration-set-001` | Korean Pearl Halo Crystal Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-002` | Korean Cute Teddy Bear Crystal Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-003` | Snap Ghost Crystal Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-004` | Korean Blue Heart Butterfly Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-005` | Korean Dolphin Crystal Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-006` | Korean Trinity Heart Pearl Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-007` | Korean Pink Love Crystal Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-008` | Korean Mother-of-Pearl Bar Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-009` | Korean Black Cat Crystal Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-010` | Korean Mother-of-Pearl Dolphin Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-011` | Korean Black Butterfly Crystal Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-012` | Korean Pearl Crescent Crystal Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-013` | Korean Butterfly Pearl Drop Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-014` | Korean Blue-Eye Cat Crystal Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-set-015` | Korean Eiffel Tower Pearl Necklace & Earrings Set | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-023` | Cute Korean Teddy Bear Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-024` | Korean Black Butterfly Drop Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-025` | Korean Crystal Butterfly Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-026` | Korean Four-Petal Flower Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-027` | Korean Pear Drop Crystal Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-028` | Korean Square Solitaire Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-029` | Korean Celestial Star Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-030` | Korean Dazzling Star Pendant Necklace – Silver | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-031` | Korean Dazzling Star Pendant Necklace – Sparkle | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-032` | Korean Dazzling Star Pendant Necklace – Minimal | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-033` | Korean Bow Ribbon Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-034` | Korean Butterfly Crystal Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-035` | Korean Clover Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-036` | Korean Emerald Butterfly Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-037` | Korean Hummingbird Crystal Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-038` | Korean Mermaid Pearl Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-039` | Korean Pearl Drop Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-040` | Korean Pearl Flower Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-041` | Korean Pink Crystal Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-042` | Korean Square Halo Crystal Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-043` | Korean Tulip Flower Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-044` | Korean Pink Stone Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-045` | Korean Butterfly Heart Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-046` | Korean Swan Pearl Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-047` | Korean Heartbeat Heart Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-048` | Korean Pink Star Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-049` | Korean Sunburst Crystal Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-necklace-050` | Korean Romantic Heart Crystal Pendant Necklace | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-bangle-001` | Korean Contemporary Open Cuff Gold Bracelet | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-bangle-002` | Korean Daisy Flower Gold Bangle | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-bangle-003` | Korean Evil Eye Nazar Gold Bracelet | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-bangle-004` | Korean Filigree Ridge Gold Bangle | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-bangle-005` | Korean Geometric Line Gold Bangle | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-bangle-006` | Korean Sculpted Open Cuff Gold Bracelet | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-bangle-007` | Korean Minimal Curve Gold Bangle | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-bangle-008` | Korean Chain Link Gold Bracelet | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-bangle-009` | Korean Heart Charm Gold Bangle | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-bangle-010` | Korean Serpent Twist Gold Bangle | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-bangle-011` | Korean Square Geometric Gold Bangle | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-bangle-012` | Korean Butterfly Charm Gold Bangle | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-ring-001` | Korean Crown Adjustable Ring | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-ring-002` | Korean Twin Heart Bypass Adjustable Ring | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-ring-003` | Korean Open Heart Adjustable Ring | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-ring-004` | Korean Geometric Arc Adjustable Ring | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-ring-005` | Korean Floral Petal Adjustable Ring | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-ring-006` | Korean Minimal Crest Adjustable Ring | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-ring-007` | Korean Love Curve Adjustable Ring | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-ring-008` | Korean Minimal Beam Adjustable Ring | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-ring-009` | Korean Crossline Geometric Adjustable Ring | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-ring-010` | Korean Sculpted Loop Adjustable Ring | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-ring-011` | Korean Heartline Adjustable Ring | Celebration R2 WebP | Same SKU original | Matched |
| `celebration-ring-012` | Korean Bypass Adjustable Ring | Celebration R2 WebP | Same SKU original | Matched |

**Summary:** 89 products = 67 R2/WebP with preserved original Meesho backup + 22 existing Celebration-hosted PNG products.
**Visual sign-off:** Not complete until original photo references are checked, especially for SKU 030 and 031.
