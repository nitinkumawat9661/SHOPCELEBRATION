# Celebration MVP

Mobile-first custom gift-hamper commerce MVP. Business content, catalogue, workflow rules, security limits and storage rules live outside feature code.

## Architecture

- `content/` — brand/UI/catalogue/customer-facing copy
- `config/` — workflow, security, validation, database and storage configuration
- `features/` — isolated storefront, builder, tracking and admin UI/features
- `lib/domain/` — pure commerce/domain rules
- `lib/server/orders/` — isolated order creation, read, status, fulfillment and issue persistence
- `lib/security/` — request/session/token security
- `app/api/` — thin HTTP route adapters
- `db/migrations/` — PostgreSQL schema
- `styles/` — mobile-first feature styles

## Local checks

```bash
npm run audit
npm run typecheck
npm run build
```

`npm run audit` checks source/env boundaries, relative imports, duplicate imports, TypeScript syntax, config integrity and domain rules.

## Launch setup

1. Copy `.env.example` to deployment environment and fill real values.
2. Generate the admin password hash with `node scripts/hash-admin-password.mjs "<strong password>"`.
3. Run `npm run config:check`.
4. Run `npm run db:migrate` against the production PostgreSQL database.
5. Configure the private R2 bucket and browser PUT CORS for the production domain only.
6. Build and deploy; keep `NEXT_PUBLIC_SITE_INDEXABLE=false` until domain/policies are final.

No payment is marked verified from a browser redirect. Admin verifies bank credit/UTR and advances the order status manually in the MVP.

### Admin operations
The admin dashboard is optimized for day-to-day fulfillment: search/filter orders, identify the next action, upload/preview packing videos, save shipping, and safely advance workflow status. Operational grouping lives in `config/admin-orders.json`; customer/business copy remains in content/config rather than component literals.
