<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:celebration-operations-rules -->

## Celebration post-change checks — mandatory for coding/operations agents

Before updating Celebration products, code, payments, catalog, tracking, policies, SEO or inventory, read [docs/CELEBRATION_PERMANENT_CHANGE_AND_SEO_RUNBOOK.md](docs/CELEBRATION_PERMANENT_CHANGE_AND_SEO_RUNBOOK.md), especially the change-type matrix and follow-up format.

After every meaningful change, summarize **what changed, live verification performed, whether a deployment was required, any Search Console/Bing/Merchant Center/GA4 follow-up, and when to recheck**. Do not assume an admin DB publish appears as a GitHub commit. Admin catalog/stock changes do **not** need deployments; GitHub main pushes DO trigger the existing production deploy and consume CI minutes.

Never invent GTIN from GSTIN, missing product claims, return/shipping fields, stock, reviews or timelines. Preserve exact product photos, catalog data, Self-Build restrictions and payment safety. No new automatic GitHub Actions workflows without explicit owner authorization.

<!-- END:celebration-operations-rules -->
