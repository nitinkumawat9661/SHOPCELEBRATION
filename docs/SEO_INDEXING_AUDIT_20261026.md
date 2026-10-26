# Celebration Search Console indexing audit (26 Oct 2026)

## Scope and safety
Repository: `nitinkumawat9661/SHOPCELEBRATION`. Base snapshot:
`019ca2ca4aee3bff238dd17b728a93eb76c87393`.
Backup ref: `backup/seo-indexing-before-20261026`.
Working branch: `fix/seo-indexing-audit-20261026`.
No production deployment, database writes, catalog edits or pricing/checkout changes are authorized by this audit.

## Source-backed findings
1. `app/robots.ts` intentionally disallows `/admin`, `/account`, `/cart`, `/payment`, `/track`, and `/api` while allowing `/api/catalog/image?key=` to expose owned, first-party product images. These rules should **not** be blindly removed. An exclusion for these private paths is expected.
2. `app/layout.tsx` and `app/robots.ts` are gated by `publicEnv.siteIndexable`. `NEXT_PUBLIC_SITE_INDEXABLE=false` makes all pages noindex and disables crawl via robots. The **repository** deployment workflow sets the production private environment flag to `true` before building, but a stale release/alternate Nginx/server deployment may behave differently. This requires a live check.
3. Filter variants `/jewelry?q=...`, `?category=...`, `?sort=...`, `?price=...` were deliberately noindex and canonical to `/jewelry`. This avoids near-duplicate URLs, but it means no dedicated category landing pages existed.
4. Before this change, `app/jewelry/[id]/page.tsx` caught catalog read errors and returned product-not-found **noindex** metadata, plus a 200 status with an outage placeholder. This is an **incorrect noindex** for an existing live SKU during a transient DB/cache outage.
5. Before this change, `app/sitemap.ts` caught catalog read errors, returning HTTP 200 XML with just seven static URLs. During an outage, the active product URLs disappeared from the sitemap. It also did not deduplicate duplicate IDs returned from catalog data.
6. The application `next.config.mjs` and `config/http-security.mjs` do **not** set `X-Robots-Tag`. No tracked Nginx configuration exists in the repository. Therefore Nginx/CDN header injection **cannot be ruled out without read-only production access**.
7. `/self-build`, `/self-build-design`, `/cart`, `/admin*`, `/account`, `/track`, `/payment/return`, `/notifications`, `/wishlist`, `/policies`, `/privacy`, `/terms` and `/compliance` have deliberate page-level noindex metadata; this PR does not remove it. Curated hampers and public content remain indexable. `/claim` is a public support page, currently indexable by design.

## Fix on review branch (NOT deployed)
- Add five verified, self-canonical, server-rendered category pages: `/jewelry/category/premium-anti-tarnish-necklaces`, `/jewelry/category/necklace-earrings-sets`, `/jewelry/category/trending-necklaces`, `/jewelry/category/gold-plated-bangles-bracelets`, `/jewelry/category/adjustable-rings`. They appear in the sitemap only while at least one active matching product exists. Legacy filter URLs remain noindex; category-query variants do not create duplicates. Category pages use the existing card, header, footer and artwork components, without editing the existing design.
- Product pages link to their approved category via existing collection anchors and structured breadcrumbs. All active product IDs keep their exact URLs.
- For catalog errors, an HTTP 5xx can be retried by crawlers. Do **not** serve a misleading 200/noindex product or incomplete 200 XML sitemap; actual deleted SKUs still return 404/noindex.
- Deduplicate sitemap SKU paths; preserve truthful current catalog, image URLs and prices.
- Keep existing robots restrictions, private routes, deployment controls, and intentional noindex directives.

## Verification gates
The PR verify workflow (`verify-pr.yml`) runs `npm ci`, `npm audit --omit=dev`, `npm run audit`, and `NEXT_PUBLIC_SITE_INDEXABLE=true npm run build`. Its trigger is PR-to-main; `deploy-production.yml` only triggers on a push to `main` or an explicit manual dispatch. **Do not merge until checks pass and owner explicitly authorizes deployment.**
The existing SEO audit script now tests five category paths, duplicate SKU removal, missing/added live products, catalog-outage failure, public/preview robots policies and first-party image paths.

## Required READ-ONLY VPS checks before approval
Run on VPS, without altering Nginx or PM2:
```bash
curl -sS -D - -o /dev/null https://shopcelebration.in/
curl -sS -D - -o /dev/null https://shopcelebration.in/jewelry
curl -sS -D - -o /dev/null https://shopcelebration.in/jewelry/celebration-necklace-001
curl -sS -D - -o /dev/null https://shopcelebration.in/sitemap.xml
curl -sS https://shopcelebration.in/robots.txt
curl -sS -D - -o /dev/null 'https://shopcelebration.in/api/catalog/image?key=catalog%2Frehost%2Fmeesho%2FREPLACE_WITH_REAL_SHA%2Fmain.webp'
```
The image request requires a **real** currently active catalog image key; the example above is not a valid key.
Check `x-robots-tag`, status, `content-type`, `location`, redirect chain, canonical, page `<meta name="robots">`, and robots path. For a real Googlebot test, use Search Console **URL Inspection > Test Live URL**; a curl User-Agent simulation is not proof of Google's crawl.
Review `sudo nginx -T` locally on the VPS for `add_header X-Robots-Tag`, `more_set_headers`, `robots.txt` interception, `location` blocks and any upstream/CDN header differences. Do **not** paste the full Nginx dump or secrets into a public issue.
Check the active PM2 release and private env only as a boolean, **not by printing env contents**: `grep -qc '^NEXT_PUBLIC_SITE_INDEXABLE=true$' /var/www/celebration/shared/.env.production`. This does not by itself prove the currently served build has the same flag.

## Post-deploy only after owner approval
1. Inspect live canonical, index directives and statuses for homepage, jewelry, five category pages, two live PDPs, curated hampers, and non-public pages.
2. Check sitemap XML has seven approved static URLs + active approved category paths + **each distinct active SKU**, no inactive URLs, no duplicates, valid owned product image URLs. The previous baseline with 89 active SKUs becomes **101** expected URLs if five categories remain populated; this is not the number Google has indexed.
3. Inspect Search Console example URLs for each issue class (blocked by robots.txt / excluded by noindex). Re-test representative affected public URLs with URL Inspection Live Test; validate the fix only after verified live behavior. Do not request indexing one by one.
4. Monitor Pages and Sitemaps for recrawl and canonical selection, and record before/after URLs. Search indexing is Google's decision, not guaranteed by the technical fix.

## Unverified
- Live origin Nginx configuration (Cloudflare-facing public response headers were sampled on 26 Oct 2026).
- Current Google Search Console example URL list for each exclusion reason.
- Real-time Googlebot reachability, current sitemap, and live catalog count.
- Production content and behavior (no deployment performed).

## Additional review actions (26 Oct 2026)
- Security gate uncovered a critical Next.js advisory in the original pinned dependency `next@16.3.8`. Upgraded only `next` to exact `16.4.3` in `package.json` and an npm-generated, integrity-verified `package-lock.json`; kept React, R2, PostgreSQL, payments, stock and all other direct dependencies unchanged. A PR-only ephemeral GitHub Actions test with this exact lockfile passed the full existing source audit, TypeScript, production build and `npm audit --omit=dev` (**0 vulnerabilities**). The temporary lock-generation step was removed after committing both files, so final PR verification must pass independently with production-indexable metadata enabled.
- Canonicalized public `/claim` to itself. Kept filtered jewelry URLs, including the `?view=all` alternate collection state, `noindex,follow` with canonical `/jewelry`; never index dynamic filter/sort/query variants as independent category landings.
- Updated `.github/workflows/verify-pr.yml` to run source audit and a production-indexable build before the unchanged mandatory npm security audit. The standalone SEO test separately verifies that preview/non-production mode stays blocked. Failures remain blocking. No changes to `.github/workflows/deploy-production.yml`.
- These changes have **not** been merged or deployed. Inspect the latest PR check before approving anything.

## Read-only production baseline (26 Oct 2026)
This is a true **pre-deployment** external baseline, executed from a GitHub-hosted Ubuntu runner in the US over HTTPS; requests reached Cloudflare successfully. The temporary read-only probing job was removed from the final PR workflow after collection. Raw results: [live baseline](https://github.com/nitinkumawat9661/SHOPCELEBRATION/actions/runs/40274306653), [SKU and sitemap probe](https://github.com/nitinkumawat9661/SHOPCELEBRATION/actions/runs/40274406855).

| Live URL | HTTP | Robots / canonical / findings |
| --- | --- | --- |
| `/` | 200 | `index, follow`; canonical `https://shopcelebration.in` |
| `/robots.txt` | 200 | `Allow: /`, plus public image API; retains private `Disallow` routes; not a sitewide block |
| `/sitemap.xml` | 200 | **96** URLs total, **96** unique: 7 static pages + 89 live product URLs; **0** category landing URLs before deployment |
| `/jewelry` | 200 | `index, follow`; canonical `/jewelry` |
| `/jewelry/celebration-necklace-001` | 200 | `index, follow`; self-canonical |
| `/jewelry/celebration-necklace-020` | 200 | `index, follow`; self-canonical |
| `/curated-hampers` | 200 | Successful public response |
| `/jewelry?category=Trending%20Necklaces` | 200 | **Intended** `noindex, follow`; canonical `/jewelry` |
| `/cart` | 200 | **Intended** `noindex, nofollow` |
| `/admin` | 200 | Login route; blocked by `robots.txt`, deliberately not an indexable storefront page |
| `/jewelry/category/trending-necklaces` | 404 | Expected prior to deployment; category landing is only in this unmerged draft PR |
| `/jewelry/necklace-001` | 404 | Invalid SKU (the actual ID is `celebration-necklace-001`); correct 404 |

No `X-Robots-Tag` header appeared on sampled Cloudflare-facing successful HTTP responses; this does **not** expose hidden origin Nginx configuration or guarantee bot-specific headers are identical. The public `robots.txt` advertises a **14,400-second (4-hour)** HTTP cache lifetime, so post-deployment recrawls could initially see the cached policy. Google's own Live URL Inspection still needs to be checked against specific GSC excluded samples.

**Conclusion:** The common public paths and sampled active PDPs are already crawl-permitted and indexable at the HTTP/metadata level. The reported GSC `Excluded by noindex` and `Blocked by robots.txt` counts cannot be classified as sitewide errors: at least some represent correct exclusions of filter variants, admin/cart or API. The branch fixes demonstrated failure-mode and discoverability defects, but **do not indiscriminately remove** those intended restrictions. Do not claim the GSC issue resolved until affected URL samples are tested post-deploy.


## Final jewelry collection outage hardening (26 Oct 2026)
- Additional source review found `app/jewelry/page.tsx` still had `getPublicCatalogConfig().catch(() => null)`, which could render a public `/jewelry` HTTP 200 page with an empty collection during an outage and confuse Google's soft-404 classification. Removed that silent catch. A catalog failure now propagates as retryable HTTP 5xx while available catalogs render the **same** existing collection/filters/cards. This does not modify checkout, pricing, inventory, images or the front-end design.
- Added a regression guard to `scripts/test-seo-automatic-discovery-20261017.mjs` so accidental reintroduction of the misleading collection response fails PR CI.
- Both search-console exclusion groups require representative Google Search Console URL samples before claiming they are errors. Existing intentional private/filter exclusions remain unchanged.

## Production deployment BLOCKED — SSH host identity mismatch (26 Oct 2026)
The owner authorized release **only after comprehensive checks**. A new read-only origin/Nginx preflight was added to PR checks and tried connecting using the existing GitHub Actions VPS credentials and **StrictHostKeyChecking=yes**. The SSH server returned:
- **`WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`**
- Presented ED25519 host-key fingerprint: **`SHA256:2rrg9Yfj69KWm1VlB6vD2mIH0wklRFItgR5aHAgeMCA`**.
- GitHub secret `VPS_KNOWN_HOSTS` contains a different previously trusted key. The preflight correctly failed **before executing any remote command**, and **no production deployment was attempted**.
- Evidence: [preflight job](https://github.com/nitinkumawat9661/SHOPCELEBRATION/actions/runs/40275844983).

**Do not run `ssh-keyscan` and automatically replace the trusted key, disable host-key checking, or merge into `main`**: the production workflow uses the same SSH trust chain, and an unexpected host key can indicate an IP/server replacement, a legitimate SSH key rotation, a wrong DNS record or an active interception attempt.

Recovery requires independent server identity verification via **trusted VPS provider console, not the suspicious SSH connection**. On the trusted server console, use:
```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256
sudo cat /etc/ssh/ssh_host_ed25519_key.pub
```
Confirm this is the intended Celebration server (hostname, provider panel server ID and IP); compare the console fingerprint to the fingerprint shown by the blocked preflight. Only if both identities match, update GitHub Actions secret `VPS_KNOWN_HOSTS` to the **console-verified** appropriate host:port public known-hosts line (no private keys). Run the strict-key preflight again. Then evaluate Nginx/origin flags and pending Google Search Console URL samples. The draft PR remains **unmerged** and must not be marked ready/merged until the trust problem is resolved.
