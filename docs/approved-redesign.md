# Approved Celebration redesign

Implemented the supplied visual reference in the existing storefront: ivory and burgundy header, gift campaign hero, category discovery, budget and occasion sections, jewelry/all-gifts collection and product detail routes, account/reset presentation, and three-step hamper builder presentation.

## Assets and motion

Three generated decorative campaigns (gift hero, jewelry satin, occasion gifts) each have 800px and 1600px WebP variants. Six files total approximately 575 KiB. Prompts and provenance are recorded in `public/images/campaign/README.md`. These are campaign imagery, not representations of catalog stock. Native CSS entrance/hover effects respect reduced-motion preferences; the homepage no longer uses the ambient canvas animation.

## Data and existing flows

Catalog products, active state, categories, product photos, hamper tiers/prices, occasions and store settings remain backed by the existing admin/server sources. Collection search, category filtering and budget sorting operate on active catalog products. Missing product photos have an explicit placeholder. Prices describe eligible hamper budgets, not individual product sale prices. No invented reviews, stock, discounts or products were added.

Account/OTP, order creation, payment APIs, security, database and admin implementation are unchanged. Builder copy now matches its existing three steps. Deferred section anchors scroll into view after loading.

## Validation

- `npm run lint` / `npm run audit`: passed source, imports, duplicates, syntax, config, domain and catalog discovery checks.
- `npm run typecheck`: passed; final production build also passed TypeScript.
- `npm run build`: passed on Next.js 16.3.8, including all existing routes and new collection/detail routes.
- `npm audit --omit=dev`: zero vulnerabilities after updating the existing Next.js dependency.
- Browser checks: desktop 1440px and mobile 390px/320px; homepage, account/reset, builder and catalog; no horizontal overflow, missing campaign images or production browser errors. Populated collection was checked with the current public catalog response using a temporary local harness, which was removed before the final build.
- Existing OTP/payment code was preserved. No live OTP, purchase or payment was initiated.

## Production limitations

The local clone has no production database credentials, so database-backed collection routes show their unavailable state locally. Populated collection verification used the real public catalog (27 products). That catalog currently has no product photos and no individual sale prices. Jewelry classification uses English product/category names until the admin schema includes an explicit collection field.

The existing GitHub production deployment workflow is blocked before execution by GitHub account billing/spending limits. No safeguards were bypassed and no production deployment succeeded. This is a build-verified implementation for review; live database/auth/payment integration and post-deployment health must be verified after deployment access is restored. No measured CLS benchmark is claimed.

Changed areas: `features/home`, `features/catalog`, `features/shell`, `app/jewelry`, scoped customer CSS, domain UI copy/discovery, audit checks and the Next.js lockfile. Generated Next.js agent guidance files are included to prevent recurring development-only dirty files.
