# Celebration — 18 September launch checkpoint

## Code complete in this checkpoint

- Mobile-first premium Celebration storefront preserved
- Budget/product eligibility enforced client + server
- Required delivery date and customer delivery details
- Direct UPI payment intent driven only by environment config
- UTR/payment-reference capture with duplicate protection
- PostgreSQL persistent orders + idempotency
- Expiring signed customer tracking token
- Manual admin payment verification workflow
- Packing-video private R2 upload + customer approval
- Shipping provider/tracking capture before `shipped`
- Customer issue-report flow and admin resolution status
- Mobile-first tracking and admin screens
- Same-origin mutation checks, request limits and DB-backed rate limits
- Scrypt admin password, HttpOnly SameSite session cookie
- Config/content separated from feature code
- Feature-separated order repositories

## External setup still required before real orders

- Production PostgreSQL `DATABASE_URL`
- Business UPI ID + beneficiary name
- WhatsApp/support details
- Admin password/hash + session/tracking secrets
- Private Cloudflare R2 bucket credentials + CORS
- Production domain/DNS
- Final business/legal identity and operational policy values

## Verified preview checkpoint — 15 September

- Full Next.js 14 production build: PASS
- TypeScript validity check during Next.js build: PASS
- 109 source files integrity-verified before build
- `/`, `/track`, `/policies`, `/admin`: HTTP 200
- `/api/health`: HTTP 200
- CSS mobile-first structure audit: no `max-width` media queries; expansion uses 390 / 640 / 900px `min-width` breakpoints
- Source/domain/import/config audits: PASS
- Preview: `https://celebration-mvp-launch-v7.vercel.app`
- Real order E2E intentionally BLOCKED until production secrets, PostgreSQL migration, UPI and R2 configuration are supplied

## Verification before production switch

- `npm run audit`
- `npm run typecheck`
- `npm run build`
- Apply database migration
- Test one real low-value UPI order end-to-end
- Verify admin payment → preparing → video → approval → shipping → delivered
- Verify issue-report flow
- Verify 360 / 390 / 430 px plus tablet/desktop

## Issue reporting window
- Server-enforced from `ISSUE_REPORT_WINDOW_HOURS`; launch value: 24 hours.
- Window starts when admin marks the order delivered (`delivered_at`).
- Issue submission is not allowed before delivery or after the configured window.
## Reverse-proxy same-origin fix — 15 September
- Admin/customer write routes now validate Origin against the public request origin derived from trusted reverse-proxy headers (`X-Forwarded-Proto` / `X-Forwarded-Host` / `Host`) instead of the internal Next.js URL.
- This preserves CSRF same-origin protection behind Nginx HTTPS while avoiding false `CROSS_SITE_REQUEST_BLOCKED` responses.
- Celebration app remains bound to `127.0.0.1:3040`, so these forwarding headers are supplied by Nginx rather than direct public traffic.

## Checkout validation fix — 15 September
- Details step now blocks navigation to Payment until required customer/delivery fields are complete.
- Payment submission re-validates customer details before calling the order API.
- Invalid UPI UTR / transaction reference now has a specific error instead of the generic required-details error.
- Server remains authoritative for the same validation rules.

## Admin operations checkpoint — 15 September
- Admin order dashboard upgraded for operational use: search, stage filters, required-date sorting, clearer next-action guidance and compact order details.
- Packing-video UX now shows uploaded state, customer-approval wait state, replace action and authenticated admin video preview.
- Upload/status/shipping mutations now surface explicit success feedback instead of silently reloading the same card.
- Status change requires selection plus explicit Apply action; cancellation asks for confirmation.
- Admin filter configuration is isolated in `config/admin-orders.json` and validated by the config audit.

## Tracking recovery checkpoint — 15 September
- `/track` now provides secure order lookup instead of showing an invalid-link dead end when no token is present.
- Lookup requires exact Order ID + configurable last phone digits, is same-origin protected and rate-limited, and rotates a signed tracking token on success.
- Invalid/expired signed links also offer the same recovery form without exposing order PII.

- v10 tracking approval UX: explicit consent card, prominent dispatch approval CTA, approval confirmation state/timestamp.
