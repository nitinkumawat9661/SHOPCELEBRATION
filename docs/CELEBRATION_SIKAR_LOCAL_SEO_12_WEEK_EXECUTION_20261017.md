# Celebration: Sikar Organic Search Growth Plan (12 Weeks)
**Created:** 17 October 2026 (IST) · **Owner:** Celebration (shopcelebration.in) · **Status:** Action plan, NOT deployed website changes.
**Primary goals:** improve qualified organic search traffic, verified local visibility where eligible, and genuine orders. **No one can guarantee #1 ranking** for `jewellery in Sikar` or `artificial jewellery in Sikar`.
**Keep current source of truth:** [Permanent change, catalog and SEO runbook](CELEBRATION_PERMANENT_CHANGE_AND_SEO_RUNBOOK.md). This plan is a separate execution backlog; it does not override storefront/product/payment/inventory restrictions.

## 0. Facts already known; facts requiring confirmation
- Celebration is an **e-commerce jewellery and gifting brand operated from Sikar, Rajasthan**. Treat it as an **online store**, not an advertised walk-in showroom unless one actually exists.
- The live catalogue has jewellery including necklaces, rings, bangles/bracelets and sets. Merchandising is DB-backed. **Do not advertise bridal jewellery rentals, Rajputi Aad, Kundan sets, Bajuband or earring types that are not genuinely in the live catalogue.**
- Historical recorded GSC/Bing baseline: 17 October snapshot, **95 URLs discovered** (6 static + 89 catalog). Discovered does not mean indexed. GA4 setup observed; Merchant Center was still verifying with only **4 products discovered** at the last check. These figures are **historical and require rechecking**; don't report them as current.
- Previous performance work: 67 product photographs migrated from Meesho CDN to first-party R2, 22 large original PNGs slated for responsive WebP. See [image performance plan](CELEBRATION_IMAGE_PERFORMANCE_20261017.md); independently verify production.
- **Open business-model questions (before claiming a physical local presence):** Do customers visit a genuine staffed, permanently signed Celebration retail premises in Sikar during published hours? Does Celebration staff actually meet local buyers in person or directly deliver to them (distinct from courier-only national e-commerce)? Is pickup offered? Is Sikar currently covered by checkout pincode serviceability? Which business number and operating hours are publicly approved? Use verified facts only.
- A residential/home operating address **must not** be publicly promoted as a showroom, pinned on Maps, or embedded into `LocalBusiness` with fabricated shop hours/geo-coordinates. If the address is private, keep it private.

## 1. Local SEO eligibility: choose the correct branch

| Actual business model | Google Business Profile (GBP) action | Website action |
| --- | --- | --- |
| Online-only e-commerce, third-party courier orders, no in-person customer contact | **Do not create a Maps storefront listing**. Google excludes online-only businesses. | Build helpful Sikar-serving online-commerce content, accurate shipping/serviceability, Organization/OnlineStore schema. |
| Verified staffed walk-in shop with permanent signage and customers visiting | Create/claim **one** verified GBP with the **actual** business name, authentic location, real phone and opening hours. | Add accurate shop contact, map/directions, LocalBusiness markup for the genuine location, and consistent verified NAP. |
| Genuine in-person service-area activity without a walk-in shop | Evaluate GBP service-area eligibility; **hide residential address** if customers are not served at that address. Do not confuse third-party courier shipping alone with own in-person service activity. | Explain confirmed local in-person services honestly, use appropriate public service area and verified contact info. |

**GBP policy guardrails:** The displayed GBP name should be `Celebration` (or its *verified* real-world brand name), **not** an invented `Best Artificial Jewellery Store Sikar` variant. Do not create fake satellite branches/locations. Use the closest genuinely applicable categories from Google's live category picker; no need to force `Imitation Jewellery Shop` if that exact category is unavailable. Ask **all genuine eligible customers** for **honest, unbiased reviews**. Never demand 5 stars, script review keywords, review-gate, buy reviews, or offer incentives. Do not invent a public physical address or GPS coordinates to make schema pass.

**Official guidance:**
- https://support.google.com/business/answer/13763036
- https://support.google.com/business/answer/3038177
- https://support.google.com/business/answer/7400114
- https://developers.google.com/search/docs/appearance/structured-data/local-business

## 2. Keyword/landing-page map (hypotheses, not proven search volumes)

| Priority | Search intent / sample query | Recommended page | Evidence/content required |
| --- | --- | --- | --- |
| P0 | `artificial jewellery in Sikar`, `imitation jewellery Sikar` | **One** canonical local commerce hub `/sikar/artificial-jewellery` | Genuine online shopping for Sikar users, product categories actually sold, accurate local fulfillment/pincode check, real product images, pricing, FAQs. |
| P0 | `jewellery in Sikar`, `jewellery shop Sikar` | Same hub **for online discovery**; map-pack store-intent only if genuinely GBP eligible | Explicitly identify Celebration as online shopping when there is no walk-in showroom; no fabricated `near me` store claim. |
| P1 | `artificial necklace Sikar`, `Korean necklace Sikar` | Existing `/jewelry` category or one genuine local necklace landing section if meaningful | Live SKUs, original photos, names matched to actual design. |
| P1 | `artificial rings Sikar`, `fashion rings Sikar` | Relevant catalogue filter/collection, crawlable **only if** distinct content & demand | Real rings, prices, availability. |
| P1 | `bangles bracelets Sikar`, `imitation bangles Sikar` | Relevant true collection content | Correct stock, materials and documented claims. |
| P1 | `gift hampers Sikar`, `custom hampers Sikar` | Existing curated hamper page and, if useful, one relevant local delivery FAQ/section | Actual availability, prices, fulfillment, customization conditions. |
| P2 / future ONLY | `bridal Aad on rent Sikar`, `Rajputi jewellery rental Sikar`, `Kundan chokers Sikar` | **Do not target or publish these now** | Add only after genuine inventory, rentals, customer service and proof exist. |

**Canonicalization:** Do not build 15 thin duplicates like `/jewellery-sikar`, `/artificial-jewellery-sikar`, `/jewellery-near-sikar` that say the same thing. Start with **one** strong Sikar hub; link it from homepage/footer and appropriate collections; internally link back to live `/jewelry` and real product URLs. Never canonically point a genuinely unique Sikar page to `/jewelry` or it may not index as intended. Publish only when the page has substantive unique, accurate copy, visible products, a proper canonical, metadata and sitemap integration.

**Suggested hub title AFTER verification:** `Artificial Jewellery in Sikar | Shop Rings & Necklaces | Celebration`.
**Suggested description:** `Explore Celebration artificial jewellery online for Sikar customers. Shop real necklaces, rings and bangles, check delivery by pincode and order securely.` This is intentionally not a fake `visit our Subhash Chowk showroom` claim.

**Site positioning:** Keep the national e-commerce homepage valuable for pan-India discovery, rather than replacing its main title with a claim that Celebration is a physical Sikar showroom.

## 3. Technical and on-page checklist

- [ ] Check GSC URL Inspection on home, /jewelry, 3 live product URLs. Record **indexed/not indexed** and reason; don't infer indexation from sitemap success.
- [ ] Confirm robots.txt, sitemap.xml and canonical/meta robots all agree. Do not re-submit a successful sitemap unnecessarily.
- [ ] Confirm per-SKU Product + Offer markup has **DB-accurate name, price, INR, availability, image** and source-of-truth policies. Check Google Rich Results; don't invent GTIN, star ratings, testimonials, returns, delivery promises or manufacturer details.
- [ ] Keep truthful `Organization`/`OnlineStore` structured data. **Only** add `LocalBusiness` markup if an actual verifiable storefront/service location qualifies, with accurate `PostalAddress`, hours, phone and coordinates.
- [ ] Audit 10 photo/name mismatches if any; leave uncertain SKUs unresolved until physical-product confirmation.
- [ ] Implement the useful Sikar hub with real catalog subset, original photos, mobile purchase links, an authentic Sikar ordering/delivery FAQ, and truthful visible content for bots/users. Add a single sitemap URL; test render and canonical.
- [ ] Metadata: one unique relevant title/H1 and short helpful description per indexed page; avoid keyword stuffing, duplicate pages or impossible superlatives (`#1`, `best` without evidence).
- [ ] Images: appropriate sizes, exact-SKU thumbnails, high-priority true LCP image, lazy below-fold; don't hide critical imagery behind hydration.
- [ ] Mobile Web Vitals: aim for **LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at p75 field data**, plus a high mobile Lighthouse lab score. A 99 Lighthouse number does **not guarantee top ranking**.
- [ ] GBP-eligible only: ensure the business has real signboard, verified owner access, correct hours/services/products, real exterior/interior/team photos (no AI fake store), and consistent public NAP.
- [ ] Track GA4 organic sessions, product views, add-to-cart, checkout starts, server-verified purchases. Don't transmit address/phone/email as analytics event values.
- [ ] Check Merchant Center approval/status and catalogue discovery. Feed generation can be considered only if automatic discovery remains incomplete and duplication is prevented.
- [ ] Technical SEO changes **require** branch + tests + reviewed main merge + existing rollback-safe deploy. A live admin product/stock edit **does not** require deployment.

## 4. Daily rhythm (repeat weekly, 20–40 focused minutes per day)

| Day | One primary activity | Evidence / completion criterion |
| --- | --- | --- |
| Monday | Inspect GSC Performance filtered for `Sikar` + matching local jewellery search terms, record pages/queries/impressions/clicks/CTR/position | New dated weekly data row, compare previous 7/28 days without overinterpreting tiny numbers. |
| Tuesday | Improve **one real** product/collection page (title, useful unique copy, original photos, concise answer to a real buyer question) | Record URL/SKU, before/after, factual verification; if DB edit, publish without code deploy. |
| Wednesday | Fix **one measured technical issue** (broken image, mobile layout, indexing error, schema mismatch) | Save screenshot/log/test and root cause; batch code changes in one PR, not daily CI deployments. |
| Thursday | Create/polish **one authentic** category visual, short video, or buyer FAQ answering verified Sikar demand | Link asset to real product/service, no unverified claims or counterfeit reviews. |
| Friday | Publish one meaningful locally relevant update or earn one legitimate local relationship/link (if real connection exists) | URL, who linked/posted, whether editorial; no paid/spam directory packs. |
| Saturday | Inspect real customer experience: Android mobile, slow network, photos, cart, delivery check, available stock | Record image waterfall/errors and LCP/CLS; no false checkout or unnecessary live payments. |
| Sunday | Weekly 15-minute review: compare scoreboard, choose next week's **top two bottlenecks** | Mark completed work, blockers, metric changes and next priority in `SEO_WEEKLY_LOG.md` (template below). |

**Cadence rule:** Do not publish something low quality merely to create daily SEO activity. If no real improvement is ready, research, repair, or measure instead. Keep weekly changes batched, with explicit owners and follow-up dates.

## 5. Twelve-week milestones and weekly deliverables

### Week 1 (17–23 Oct): reality check & baseline
- [ ] Establish whether Celebration is online-only, in-person service-area, or verified staffed shop. **GBP is blocked until eligibility is answered.**
- [ ] Export GSC Performance last 28 days (queries containing Sikar/jewellery/artificial); indexed-page counts, ranking positions, country and device split. Store numbers in weekly log.
- [ ] Verify 3 mobile PageSpeed runs on home, /jewelry and representative SKU after image production deploy; identify biggest measurable delay.
- [ ] Confirm real Sikar serviceability through checkout; document shipping promise before any local landing page copy.
- [ ] Choose one local primary URL and primary search cluster; do not publish thin pages.

### Week 2 (24–30 Oct): entity trust and address safety
- [ ] Audit website About, contact, policies, canonical brand name, support email, phone and business description.
- [ ] If genuinely eligible, claim/verify GBP **as Celebration**, choose truthful category, photos, hours and public address/service area; otherwise explicitly mark GBP not eligible and continue online-only SEO.
- [ ] Audit any existing local citations; remove wrong telephone or fabricated storefront address. Avoid mass directories.
- [ ] Note verified public contact details in a **private owner record**, not this public GitHub repo.

### Week 3 (31 Oct–6 Nov): high-quality local landing page
- [ ] Draft and fact-check unique `/sikar/artificial-jewellery` content with 200–500 genuinely useful words only if buyer-relevant (not word count padding).
- [ ] Add authentic selection, prices/stock from live catalog, Sikar serviceability/pincode CTA, a real FAQ, title, H1, canonical, OG image and internal links.
- [ ] Add to sitemap and deploy through existing reviewed flow; validate mobile purchase links and Search Console URL Inspection.
- [ ] Record publish date; wait for actual indexing before claiming it.

### Week 4 (7–13 Nov): 10 listing improvements
- [ ] Improve 10 **existing** product pages where descriptions are sparse, prioritizing true necklace, ring, and bangle intent.
- [ ] Verify SKU/photo/name/variant/stock/price before each edit. Add care/material details only if documented.
- [ ] Add useful internal links from hub/collections to relevant products; measure views, clicks and checkout starts.

### Week 5 (14–20 Nov): image search and photo performance
- [ ] Run image-source ownership checks. Remove broken external browser image requests; preserve R2 originals and exact-SKU identity.
- [ ] Compress/resize any remaining heavy product visuals without altering design; inspect loading/eager/lazy logic using mobile waterfalls.
- [ ] Evaluate Google Images indexing for key product URLs; add meaningful alt text (describe actual photographed piece, not `best Sikar jewellery`).

### Week 6 (21–27 Nov): real collection content
- [ ] Produce one original buyers' guide: e.g. choosing daily-wear artificial necklaces, real quality/care expectations, actual Celebration stock.
- [ ] Improve /jewelry navigation, category hierarchy and filter discoverability without indexing thin filtered URL combinations.
- [ ] Link article → matching category/products → approved local hub; test tap targets and responsive layout.

### Week 7 (28 Nov–4 Dec): legitimate reviews and customer questions
- [ ] After **genuine** orders, invite unbiased customer reviews without asking for 5 stars or specific words.
- [ ] Add anonymized consented real customer FAQs; reviews shown on product pages must pass actual verified-purchase moderation.
- [ ] GBP review workflow **only if verified/eligible**. Never invent store traffic or local testimonials.

### Week 8 (5–11 Dec): local authority, not artificial link building
- [ ] Identify relevant real Sikar businesses, creators, gift/event planners or community initiatives with authentic collaboration opportunities.
- [ ] Pursue one editorial local mention or partnership **only if it truly occurs**; record link and referring page.
- [ ] Audit social and legitimate directories for name/URL/category consistency. Skip fake profiles and paid link farms.

### Week 9 (12–18 Dec): answer real regional queries
- [ ] Use GSC rising local queries, product questions, and customer support to choose a high-intent FAQ/guide.
- [ ] If shoppers demonstrably ask about bridal/Kundan/Rajputi jewellery, discuss only what Celebration actually sells; do not create rental pages without rentals.
- [ ] Expand the Sikar hub only when new real local info is available (delivery, available collections, order process).

### Week 10 (19–25 Dec): performance & technical revisit
- [ ] Compare mobile Lighthouse medians and GSC CWV field data against Week 1; isolate LCP element, render-blocking JS, image TTFB and long tasks.
- [ ] Fix highest-impact confirmed bottleneck; run full tests before merge; monitor existing production health/rollback.
- [ ] Confirm no indexing regressions on new hub/product pages and no breakage in payment/shipping.

### Week 11 (26 Dec–1 Jan): conversion + merchant discovery
- [ ] Review organic landing page → product → cart → checkout funnel in GA4; identify specific drop-off without claiming causality from bounce alone.
- [ ] Check Merchant Center verified status, item errors, shipping/returns parity and product feed coverage; don't invent GTIN.
- [ ] Improve one high-friction mobile buying step while preserving secure server-verified payment.

### Week 12 (2–8 Jan 2027): audit, keep/stop/scale decision
- [ ] Export identical GSC metrics, GA4 organic e-commerce metrics, indexed URLs, GBP visibility if eligible, and p75 CWV.
- [ ] Compare Week 1 vs Week 12 using same date-window lengths and seasonality notes; show wins and unresolved problems.
- [ ] Keep pages with real conversion/engagement value; improve underperforming pages, merge overlapping thin pages, and write next 12-week priority backlog.
- [ ] Never label work `rank #1 achieved` without a dated query/location/device SERP observation and corroborating GSC evidence.

## 6. Weekly reporting scoreboard (fill each Sunday)

| Week ending (IST) | GSC local impressions | GSC local clicks | CTR | Average position* | Target hub indexed? | GA4 organic sessions | Organic genuine orders | Mobile LCP p75 | GBP calls/directions** | Work shipped | Next action |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | --- | --- | --- |
| **Baseline not yet fetched** | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | N/A unless eligible | Image optimization release check pending | Confirm business model, GSC baseline, production image results |

`*` GSC average position is an aggregate, not a guaranteed ranking at a specific street/device. Record exact filter query set and date window. `**` Only a genuinely eligible verified GBP can supply these.

**Success measures:** indexable verified local hub; growing relevant impressions/clicks; increased organic product views and server-verified orders; fewer broken photos; improving p75 CWV. Treat 99 Lighthouse as a separate mobile performance **lab target**, never as proof of top Google ranking.

## 7. Every task change: release and safety checklist

- For every proposed action: **date, source, target query, exact URL/SKU, fact-check proof, rollback method**.
- For product DB edits: verify product/picture/price/stock; use admin save-live. No GitHub push and no forced redeploy.
- For code: branch → tests/typecheck/build → reviewed PR → single existing main deploy → verify HTTP health, images, SEO/schema, cart/order behavior.
- For local GBP: verify real in-person eligibility, public NAP and correct service model. No false profile, no public personal residence if not customer-facing.
- For search: inspect sitemap/robots, use URL Inspection only for important changes; GSC/Bing reports lag.
- For analytics: do not attribute a short-term ranking change to one isolated edit; allow time for crawling and compare multiple 28-day windows.
- **No automatic recurring GitHub Actions, no unsupervised production writes, no fabricated local branches/showrooms, no fake 5-star reviews or keyword-stuffed business names.**

## 8. Suggested one-sentence daily execution request

> Use `docs/CELEBRATION_SIKAR_LOCAL_SEO_12_WEEK_EXECUTION_20261017.md`, `docs/CELEBRATION_PERMANENT_CHANGE_AND_SEO_RUNBOOK.md` and the latest completed weekly log. Check live source-of-truth evidence. Pick **today's highest-value single unfinished SEO action**, execute only within authorized access, verify it, record evidence/status and say whether deploy/Search Console/Merchant follow-up is needed. Do not duplicate yesterday's work or imply unverified rankings.

## 9. Reference / accuracy policy
Official Google material checked on 17 Oct 2026:
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/appearance/page-experience
- https://developers.google.com/search/docs/appearance/core-web-vitals
- https://developers.google.com/search/docs/appearance/structured-data/local-business
- https://developers.google.com/search/docs/appearance/structured-data/organization
- https://support.google.com/business/answer/13763036
- https://support.google.com/business/answer/3038177
- https://support.google.com/business/answer/7400114

**Never substitute a speculative location, query volume, review rating, Google category, opening hours, claim of product rental, instant delivery or SEO result for verified real information.**
