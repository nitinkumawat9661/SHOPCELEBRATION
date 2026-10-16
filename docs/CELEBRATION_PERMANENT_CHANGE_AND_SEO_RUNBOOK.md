# Celebration — Permanent Change, Catalog, SEO & Merchant Operations Runbook

**Status:** Living operational source of truth, created 17 Oct 2026 (Asia/Kolkata); merchant schema implementation recorded 17 Oct, subject to live retest.
**Site:** https://shopcelebration.in
**Repository:** nitinkumawat9661/SHOPCELEBRATION (production source; main)
**Audience:** owner, developers, coding agents, and change-monitoring agents.
**Purpose:** After EVERY meaningful Celebration site, product, inventory, policy, shipping, marketing, code, or analytics change, consult the relevant checklist below. Avoid unnecessary deployments and repeated manual indexing.

> **Important:** These are observations and business instructions, not a blanket claim that every product is indexed or Merchant Center approved. Confirm current public/backend status before reporting success.

## 1. Known baseline — verified in the 16–17 October 2026 session

| System | Verified / recorded baseline | What is NOT yet verified |
| --- | --- | --- |
| Google Search Console | Domain property shopcelebration.in verified; sitemap https://shopcelebration.in/sitemap.xml shows Success, 95 URLs discovered (6 static + 89 catalog), screenshot dated 17 Oct | Indexing of all 95 URLs / search ranking |
| Bing Webmaster Tools | Imported; sitemap Success, 95 URLs, zero sitemap errors or warnings | Indexing of all individual products |
| Google Merchant Center | Account created; website discovered 4 products when last checked; under account verification | Approval, complete catalog ingestion, feed freshness |
| Google Analytics 4 | CELEBRATION property with public measurement ID G-8F24GVDSL3; Realtime page_view, view_item, add_to_cart, begin_checkout observed | Full real-money purchase/refund end-to-end verification and stable revenue reporting |
| Google Rich Results | 17 Oct: /jewelry/celebration-necklace-001 fetched, 3 valid items: Product snippets, Merchant listings, Breadcrumbs | All catalog pages and optional warning-free schema |
| Merchant warnings on example SKU | Optional missing brand/global identifier; optional hasMerchantReturnPolicy; optional shippingDetails | Code now includes truthful brand, a link to the real return policy, free retail-jewellery shipping and handling 0–2 days; live Rich Results re-test and Google processing remain pending |
| Production | GitHub Actions deploy to VPS; immutable releases and rollback; last verified 17 Oct at commit 7c24a1d5dcf1 | Later changes need their own release/health verification |

**Public URLs:** sitemap.xml; robots.txt; /jewelry; /jewelry/<sku>; /api/health. Source: app/sitemap.ts, app/robots.ts, app/jewelry/[id]/page.tsx, features/analytics/*, current server catalog, and actual Google/Bing account screenshots.

**Do not freeze catalog size at 89.** Product count and sitemap URLs are dynamic. A newly published active SKU must appear in the sitemap automatically if the existing pipeline works. Merchant Center and Search Console may take time to re-crawl; discovered does not equal indexed or approved.

## 2. Owner-confirmed business facts (17 Oct 2026)

- Business/trading brand: **Celebration**. Products are purchased wholesale and sold under Celebration branding. Keep the real manufacturer/importer and origin declarations accurate; do not invent another company's brand or call an unlabeled product Celebration-branded before that is factual.
- Celebration holds a **GSTIN** (number not recorded in this runbook). **GSTIN is NOT GTIN**. Never add GSTIN as product GTIN, invent UPC/EAN/barcodes, or copy an unrelated product's GTIN. A truthful Celebration product brand may be added where the retail goods are actually Celebration-branded.
- Owner dispatches packages **within 0–2 days maximum**; total **order-to-delivery estimate is 3–7 days**. These are business targets, subject to courier serviceability. Do not incorrectly label 3–7 days as transit time alone. Do not invent a transit-time split merely to clear a Google warning; verify operational data first.
- Individual retail jewellery listings show delivery included / no additional standard delivery charge **where checkout actually provides it**. Curated hampers use their own inclusive-price and fulfillment policy; never unilaterally set all hamper shipping to zero.
- Wrong, damaged, defective or missing item remedies follow the *published* /policies page, statutory obligations and actual operational reporting window. Voluntary change-of-mind returns are limited. Do not express these as unconditional/free returns or invent a return window just to remove an optional warning.
- Guarantees are **only** on SKUs actually marked with the covered guarantee; never globally add anti-tarnish warranty to unmarked products.
- Never embed full GSTIN, bank account numbers, private phone, passwords, provider keys, private customer information, database credentials, tracking tokens, or other secrets in this document, public commits, analytics events or agent alerts.

## 3. Adding ONE new retail jewellery product (no code deploy)

**Actual admin implementation:** https://shopcelebration.in/admin → authenticated admin → Products/objects section (features/admin/AdminCatalogManager.tsx).

1. Before editing, check the existing live catalog and choose a new **unique stable SKU**; do NOT reuse an old SKU for a new design. Existing URLs are built from SKU (e.g. /jewelry/celebration-necklace-001). Editing an existing SKU changes a product; renaming its ID changes its URL and requires redirect/search attention.
2. Select **+ Add product**, or duplicate only as a starting point and promptly replace the copied SKU, text and images. Default new product is NOT set to individual sale: explicitly configure it.
3. Fill accurate name (design/photo match), category, description/notes/highlights, verified main product photograph and optional same-SKU gallery. **First gallery image** is the listing/card primary image. Never swap another SKU's photo, use misleading overlays, or claim false composition/material.
4. Enter current live **sale price**, truthful inclusive-tax **MRP** and legally required package declarations where applicable. Confirm current selling policy; do NOT overwrite pricing or inventory based on an old chat instruction. Distinguish ₹ rupees from values stored in paise.
5. Enable **Sell individually**, set **Active** when launch-ready, and maintain actual available stock using **Save stock** (separate from Save live). For low/zero stock, verify front-end OutOfStock; do not fake availability.
6. For prepackaged goods, populate actual generic name, net quantity, country of origin, manufacturer/packer legal name and address, importer if applicable, consumer care and MRP from package/records. Make sure seller GST/business identity and invoices are compliant; treat legal verification separately.
7. Use **Save draft** before publishing if you need review; optional **/admin/catalog-preview** can show draft. Draft does not change public site. Inspect name/photo/price/size on mobile.
8. Press **Save live** once verified. The admin uses PostgreSQL live catalog (PUT /api/admin/catalog or publish endpoint). **A code rebuild or GitHub Actions run is NOT required for database catalog edits.**
9. Verify live **/jewelry**, **/jewelry/<sku>**, primary photo and gallery, price/MRP, availability, add-to-cart, checkout totals/stock gate, and product schema. Re-open incognito/mobile to catch cache/UI mismatch.
10. Check https://shopcelebration.in/sitemap.xml for new SKU (do not re-submit an already-successful sitemap just because count changed). Spot-test new product in https://search.google.com/test/rich-results . Watch Google Merchant Center for product discovery, warning or disapproval; inspect on day 1 and day 7. Search indexing is not instantaneous.
11. Record SKU, change date, source photos, changes, preview evidence, and follow-ups in your normal change log/agent notification. Don't treat a newly published SKU as fully indexed or Merchant Center-approved until actually observed.

**Bulk additions:** Admin supports **CSV template → Bulk upload (CSV/JSON)**. Existing IDs UPDATE; new IDs ADD; import alone does NOT publish until **Save live**. Test 1–2 rows first, keep a reviewed copy of the source sheet and check duplicated IDs, source image ownership, imported declarations, price units, category, and whether individual sale was enabled. Files must comply with editor validation (currently <2 MB import). Do not silently mutate existing SKUs, pictures, or inventory.

**Stock-only adjustment:** Admin Products → quantity → **Save stock**. Stock is a separate API and remains server-authoritative; do not touch product price or rewrite catalog for stock-only updates. Validate live availability/checkout. **No deployment for stock updates.**

## 4. After EVERY change — impact-specific action matrix

| Change made | Mandatory verification / notification | Deploy needed? |
| --- | --- | --- |
| Add/remove/publish a product | SKU uniqueness, images, descriptions, live price/stock, detail/category page, dynamic sitemap URL, Product/Merchant schema, Merchant Center discovery, GA4 view_item | **No**, admin DB publish |
| Product name/description/category change | Correct exact photo, visible title + meta title/description, correct category navigation, canonical unchanged, schema output, GSC/merchant recrawl later | **No**, admin DB publish |
| Product price/MRP/discount change | Check live listing + PDP + cart + verified checkout pricing (incl. coupons/GST rules), structured Offer price, Merchant Center price parity/disapproval | **No**, admin DB publish |
| Stock / sold-out / restock | Server stock quantity + stock validation, InStock/OutOfStock Product schema, cart gating; Merchant Center availability parity | **No**, stock endpoint |
| Image/gallery change | Exact-SKU media ownership, first primary image, mobile 3:4 image presentation, full image URL returns valid image, no broken product image; Google crawl access | **No** if via admin |
| Product SKU/URL change or deletion | Assess preserve SKU vs 301 redirect, update internal links & sitemap, canonical, schema and Merchant Center feed; NEVER blindly delete indexed URL | Usually **Yes** for URL routing changes |
| Homepage/category/UI change | Desktop & mobile cards, page speed, navigation, canonical/noindex on filters, live flow, GA4 page_view + conversion regression | **Yes** for source changes |
| Checkout/shipping/offer/payment change | Same-origin security, live amount server-verified, no false paid orders, genuine shipping/serviceability, failed/pending payment recovery, GA4 event integrity and privacy; smoke test | **Yes** for code changes |
| Policies/return/guarantee/delivery change | Visible policy, checkout copy, Merchant Center shipping and returns, schema truthfulness, GST/label implications; legal review | Maybe, depending on source vs admin |
| Analytics/tag changes | Realtime events: view_item, add_to_cart, remove_from_cart, begin_checkout, add_shipping_info, add_payment_info, verified purchase; no PII; compare order value and purchase transaction_id | Usually **Yes** |
| GitHub source/deployment changes | Existing production workflow only, npm audit/typecheck/build, migration compatibility, release rollback, PM2, HTTP health, robots.txt, sitemap, core checkout; no credentials/log leaks | **Yes** if production code |
| SEO schema/sitemap/robots change | Test one of each relevant SKU type (in-stock, sold-out, hamper-only); Rich Results Test, robots and sitemap, Google/Bing crawl accessibility, merchant warnings | **Yes** |

## 5. Search Console, Bing and Merchant Center: what the owner should do

**Google Search Console** (property shopcelebration.in):
- Existing successful sitemap: https://shopcelebration.in/sitemap.xml. **Do not delete or re-submit routinely.** Newly published active products appear in the generated sitemap without manual rebuild; verify the URL in live XML.
- New URL can be inspected and **Request indexing** optionally used for a few important launches. Do NOT manually request all products; indexing is discretionary and can take days or weeks.
- After significant product/site changes, check GSC Page indexing, Merchant listings/Product snippets reports (when populated), Performance, sitemap read errors and page-specific canonical/robots. Revisit 24–72 hours and 7–14 days; reports lag.
- Google test: https://search.google.com/test/rich-results . If errors: fix real issue; do not fabricate reviews, merchant identifiers, timestamps, price, delivery or returns to satisfy optional fields.

**Bing Webmaster Tools**:
- Sitemap already imported successfully, 95 URLs at baseline. Re-check whether sitemap still fetches and new URLs discovered; wait for crawling. Avoid recurring manual resubmission.
- **IndexNow** is a future integration; **do not claim it's active** unless deployed and confirmed.

**Google Merchant Center**:
- Account is still in verification stage at baseline; only 4 products were auto-discovered when last checked. That is NOT equal to all 89 approved/available.
- Check Products → Needs attention, Data sources / Found by Google, website claim, shipping/returns, identity verification and item-level disapprovals.
- Product price/availability/image/title and landing page must match Merchant Center listings. If automatic discovery does not populate the remainder, a properly deduplicated dynamic product feed can be planned **separately after approval**. Do not add duplicates by combining discovery and feed accidentally.
- GSTIN is business tax registration, **not** GTIN/UPC/EAN. For truthful private-label products, brand name may be Celebration. No invented barcodes. Check correct manufacturer/importer declarations as applicable.
- Example product (necklace-001) was eligible for 3 rich-result types with *non-critical* warnings. The Oct 17 code update adds a truthful Celebration brand for individually sold jewellery, offer-level free shipping and handling 0–2 days (no invented transit days), and a merchant return-policy link backed by global OnlineStore JSON-LD. **Verify the live Google Rich Results Test again before claiming warnings are cleared.** Google may still report optional transit details because the exact transit split is unknown.
- Verified business timing: maximum 2 days to dispatch; **3–7 days TOTAL order to delivery**. Separate handling/transit values require truthfulness; do not label all 3–7 as transit alone.

## 6. GA4, revenue and privacy

- Public GA4 stream measurement ID: **G-8F24GVDSL3**. It is not a secret; do not duplicate gtag integrations.
- 17 Oct screenshots observed page_view, first_visit, session_start, scroll, user_engagement, view_item, add_to_cart, begin_checkout. Other e-commerce events were implemented/tested in source, but **live checkout purchase/refund requires separate verification**.
- Purchase should fire **only after server verified payment**, use stable transaction_id and amount; avoid overcounting retry/redirect. Verify no double firing or personal customer fields.
- Only test real-money purchase with an authorized genuine order; do not place unnecessary live payments merely to check analytics.

## 7. Deployment and safety rules for agents

1. **Before making any change:** read this runbook, AGENTS.md, relevant current code and available operational docs. Determine whether the proposed change is database/catalog, stock-only, content, or application code.
2. **Never redeploy for admin-saved products, price or stock.** Admin **Save draft** is private; **Save live** publishes dynamically. Never force-write catalog from stale seed/migration. Do not unintentionally reset uploaded photos, inventory, orders, or categories.
3. **No new scheduled GitHub Actions workflows, recurring CI, expensive repeated QA runs or unrequested large deployment loops.** Existing production deploy pipeline on main is authoritative. Batch necessary source changes into one deliberate commit/deploy when possible. Document-only pushes to main currently ALSO trigger deploy; avoid unnecessary doc-only main commits.
4. Existing workflow: .github/workflows/deploy-production.yml. Production: /var/www/celebration/current → immutable releases, PM2 celebration-site on 127.0.0.1:3040, shared private env, Nginx. Verify https://shopcelebration.in/api/health, robots.txt, sitemap.xml, relevant pages and important checkout routes after production deploy; don't claim success before logs pass.
5. Protect security/privacy: **no .env, secrets, GSTIN value, customer identifiers, bank details, tokens** in GitHub logs, issues, or agent notifications. Never share sensitive URLs from order tracking.
6. Existing Self-Build hamper customer checkout remains owner-gated OFF unless explicitly approved. Do not treat hamper categories as retail SKUs, change internal category budget rates, enable Self-Build, or overwrite inventory for an unrelated SEO request.
7. Product images must stay exact-SKU; no invented product claims, false MRP, counterfeit GTIN, fabricated ratings, misleading warranty, unsourced delivery terms. Preserve legal rights even when voluntary returns are restricted.
8. Do not interpret a GitHub commit alone as a successful live deployment. For admin DB edits, Git history will not record a change; check live catalog separately.
9. If a new product change affects only DB and search visibility, provide an owner-friendly after-publish checklist; GSC sitemap and Bing sitemap should update without a manual code change.
10. When uncertainty remains (e.g. exact legal return period or shipping transit split), flag it and ask for authoritative data rather than guess.

## 8. Reusable agent follow-up format — after a detected change

> **Celebration change detected:** [commit/SKU/URL and timestamp]. **Type:** [new SKU / pricing / stock / photo / code / policy / deployment]. **Checks completed:** [evidence only]. **Owner follow-up needed:** [only the relevant checks from §4]. **Google/Bing/Merchant Center:** [discovery status, not presumed approval]. **Recheck:** [after 24–72 hours and 7–14 days as relevant]. **No deployment needed / deployment required:** [why].

**Notify only for NEW changes, unresolved high-priority failures, or due follow-ups. Avoid hourly duplicate alerts.** For changes originating in the private admin database, use public product catalog/sitemap snapshots if accessible; a GitHub-only detector cannot prove DB edits occurred. If automatic retrieval is blocked, say so and ask the owner to report the changed SKU/URL. A monitoring agent may inspect but must not automatically deploy or mutate product inventory.

## 9. Current open tasks (17 Oct 2026)

- [ ] Merchant Center initial business/product approval — wait for review; inspect actual reason if denied.
- [ ] Assess remaining products beyond 4 auto-discovered; decide whether deduplicated product feed is needed after review.
- [x] Code: Celebration brand for individually sold jewellery, without GTIN. **Live Rich Results verification pending.**
- [x] Code: OfferShippingDetails for individually sold jewellery, ₹0 delivery and 0–2 days handling. **Exact courier transit timing still unverified and intentionally omitted; total 3–7 days remains a business estimate.**
- [x] Code: OnlineStore hasMerchantReturnPolicy linking directly to the real /policies page (no invented 7-day window or unconditional return rights). **Live Google validation pending.**
- [ ] Verify Product snippets warnings independently if Google still reports them.
- [ ] Verify GA4 live add_shipping_info/add_payment_info and verified purchase/revenue on next genuine sale; refund pipeline separately.
- [ ] Monitor Google/Bing index coverage as reports begin populating.
- [ ] Future consideration: product-feed sync, IndexNow; not implemented and not scheduled as GitHub workflows.

**Change log template** (copy into a PR/issue note or commit description): Date IST | Type | Product SKUs / URLs | Old → new | Source of truth | Admin draft/live version or Git SHA | Live checks + URLs | Merchant/GSC/Bing follow-up + next check | Owner signoff.


## 10. Merchant schema rollout note — 17 Oct 2026

Code-only changes: `lib/domain/merchant-seo.ts`, `app/layout.tsx`, `app/jewelry/[id]/page.tsx` and existing SEO regression tests. No database, payment or inventory changes. Next.js production build is required because product JSON-LD rendering changed.

After successful deployment and public health check: test `/jewelry/celebration-necklace-001` with [Rich Results Test](https://search.google.com/test/rich-results), inspect the **Merchant listings** field details, and confirm schema shows:
- Product brand Celebration, stable existing SKU and current DB price/availability.
- Free shipping (0 INR), India, handling 0–2 days. **Do not** claim a 3–7 day transit time.
- Linked official `/policies` merchant return policy; this is not an unrestricted return promise.
- All 3 pre-existing valid structured data types continue to parse.

In Merchant Center, the account-level policies may override markup. Align them with the real published policy and actual postcode-specific delivery. **No GTIN, tax registration number or fabricated delivery time was added.** If Rich Results Test still shows warnings, record the exact wording before further coding. Do not blindly redeploy for noncritical notices.
