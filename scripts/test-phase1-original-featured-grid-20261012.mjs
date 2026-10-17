import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
const read=(p)=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [grid,ring,globals,home,mediaMap,ownerMediaSource,roadmap,packageJson]=await Promise.all([
"styles/home-phase1-original-featured-grid-20261012.css",
"styles/home-restore-featured-swipe-ring-fit-20261012.css",
"app/globals.css",
"features/home/HomeCatalog.tsx",
"lib/server/home-category-media.ts",
"scripts/install-owner-category-art-v6.mjs",
"docs/CELEBRATION_COMPETITOR_UI_UX_ROADMAP.md",
"package.json"
].map(read))
assert(grid.includes(".celebrationHome .celebrationFeatured .collectionGrid") &&
  grid.includes("grid-template-columns:repeat(2,minmax(0,1fr))") &&
  grid.includes("grid-template-columns:repeat(4,minmax(0,1fr))"),
  "Homepage jewellery cards must follow original proposed 2-across phone, 4-across desktop design")
assert(grid.includes("scroll-snap-type:none") && grid.includes("overflow:visible") &&
  !grid.includes("overflow-x:auto") && !grid.includes("scroll-snap-type:x proximity"),
  "The owner explicitly rejected the previous featured swipe carousel")
assert(!ring.includes("scroll-snap") && !ring.includes("overflow-x:auto") &&
  !ring.includes("flex-basis:clamp"),
  "Earlier swipe restoration must no longer be active; ring image fit stays")
assert(ring.includes("catalogCard--featuredPortraitRing") && grid.includes("catalogCard--featuredPortraitRing") &&
  grid.includes("object-fit:contain"),
  "Keep exact SKU image formatting, including ring portrait and all other full product photos")
assert(grid.includes(".celebrationFeatured .catalogGuarantee") && grid.includes("white-space:normal") && grid.includes("text-overflow:clip"),
  "Never truncate genuine guarantee wording in the two-across mobile cards")
assert(grid.includes("line-clamp:unset") && grid.includes("max-height:none") && grid.includes("overflow:visible"),
  "Do not clip the customer's exact featured jewellery SKU titles on 320px phones")
assert(grid.includes("min-height:44px") && grid.includes("max-width:100%") &&
  grid.includes("min-width:0") && grid.includes("@media(max-width:360px)"),
  "2-column layout must keep touch cart actions, images and long labels inside narrow phones")
assert(!grid.includes(".celebrationCategories") && !grid.includes(".celebrationCategoryArt") &&
  !grid.includes(".celebrationCategoryEditorialPhoto"),
  "Absolutely no changes to category circle photos until last Phase 1 step")
assert(home.includes("categoryMedia[category.id]") &&
  home.includes("categoryMedia.__all__") &&
  home.includes("categoryMedia.__hamper__"),
  "All seven current category circles must retain their original mapped R2 photos")
assert(mediaMap.includes("category-v[123456]") &&
  ownerMediaSource.includes("catalog/editorial/category-v6/"),
  "Preserve original owner-installed category v6 assets")
assert(home.includes("photographed.map((product)") &&
  home.includes('imageVariant="thumb" preserveFeaturedPortrait') &&
  home.includes("isIndividuallySellable(item)"),
  "Feature only four real, independently purchasable exact-photo products")
assert(globals.includes('@import "../styles/home-phase1-original-featured-grid-20261012.css";') &&
  globals.indexOf("home-phase1-original-featured-grid-20261012.css") >
    globals.indexOf("home-restore-featured-swipe-ring-fit-20261012.css"),
  "New original grid must override any older featured layout")
assert(globals.trimEnd().endsWith('@import "../styles/jewelry-two-column-scroll-header-fix.css";'),
  "Protected collection listing grid must remain last")
assert(roadmap.includes("LAST STEP OF PHASE 1") &&
  roadmap.includes("Do not keep the previously requested horizontal-swipe featured cards") &&
  roadmap.includes("two product cards side by side on phones and four in a row on desktop"),
  "Record final user decision and deferral of category image replacement")
assert(packageJson.includes("test-phase1-original-featured-grid-20261012.mjs"),
  "Apply Phase 1 user preference in all audits")
console.log("Phase 1 original featured grid checks passed: 2 mobile / 4 desktop, no swipe, all seven category images deferred until last Phase 1 step.")
