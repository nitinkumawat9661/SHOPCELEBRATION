#!/usr/bin/env node
// Production self-build readiness inventory: strictly READ-ONLY. Never print
// confidential unit budgets, full availability counts, photo keys or customer data.
// Buyer checkout is intentionally disabled regardless of aggregate readiness.
import pg from "pg"

const { Client } = pg

export function evaluateLaunchReadiness({ config, categories, options, tiers, openHolds, expiredDrafts }) {
  if (!config || config.customer_enabled !== false || config.show_item_prices !== false) {
    throw new Error("SELF_BUILD_HARD_LAUNCH_GATE_MISMATCH")
  }
  const missing = []
  if (categories.active > categories.ready || options.active > options.ready) {
    missing.push("staff_verified_capacity_required")
  }
  if (categories.ready + options.ready === 0) missing.push("no_sellable_category_capacity_verified")
  if (tiers.enabled === 0) missing.push("private_tier_allowances_not_configured")
  if (openHolds > 0) missing.push("review_payment_reservation_holds")
  if (expiredDrafts > 0) missing.push("review_expired_draft_cleanup")
  // These gates cannot be established from DB counts; deliberately NOT
  // inferred from staging tables, owner-facing admin controls or preview UI.
  missing.push("gateway_payment_and_order_idempotency_e2e_not_signed_off")
  missing.push("private_paid_order_photo_retention_not_signed_off")
  missing.push("owner_customer_launch_approval_required")
  return {
    customerCheckoutEnabled: false,
    launchReady: false,
    activeSelectableCategories: categories.active,
    categoriesWithVerifiedFreeCapacity: categories.ready,
    activeSizeOptions: options.active,
    optionsWithVerifiedFreeCapacity: options.ready,
    activePrivateTierAllowances: tiers.enabled,
    unresolvedReservationHolds: openHolds,
    expiredDraftsWaitingCleanup: expiredDrafts,
    remainingGates: missing
  }
}

export async function run() {
  if (!process.env.DATABASE_URL) throw new Error("Missing production database connection")
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL_MODE === "disable" ? false : { rejectUnauthorized: true }
  })
  await client.connect()
  try {
    await client.query("BEGIN READ ONLY")
    await client.query("SET LOCAL statement_timeout = '8000ms'")
    const configRows = await client.query(
      "SELECT customer_enabled,show_item_prices FROM self_build_configuration WHERE id='primary'"
    )
    const categories = await client.query(`
      SELECT COUNT(*)::integer AS active,
             COUNT(*) FILTER (WHERE cap.verified IS TRUE
               AND cap.available_units > cap.reserved_units)::integer AS ready
      FROM self_build_categories c
      LEFT JOIN self_build_category_capacity cap ON cap.category_id=c.id
      WHERE c.active AND c.selection_kind IN ('category','photo')
    `)
    const options = await client.query(`
      SELECT COUNT(*)::integer AS active,
             COUNT(*) FILTER (WHERE cap.verified IS TRUE
               AND cap.available_units > cap.reserved_units)::integer AS ready
      FROM self_build_options o
      JOIN self_build_categories c ON c.id=o.category_id
      LEFT JOIN self_build_option_capacity cap ON cap.option_id=o.id
      WHERE o.active AND c.active AND c.selection_kind='variant'
    `)
    const tiers = await client.query(`
      SELECT COUNT(*) FILTER (WHERE enabled AND allowance_paise > 0)::integer AS enabled
      FROM self_build_tier_allowances
    `)
    const holds = await client.query(`
      SELECT COUNT(*)::integer AS n FROM self_build_order_reservation_batches
      WHERE status = 'reserved'
    `)
    const drafts = await client.query(`
      SELECT COUNT(*)::integer AS n FROM self_build_drafts WHERE expires_at < now()
    `)
    const result = evaluateLaunchReadiness({
      config: configRows.rows[0],
      categories: categories.rows[0],
      options: options.rows[0],
      tiers: tiers.rows[0],
      openHolds: holds.rows[0].n,
      expiredDrafts: drafts.rows[0].n
    })
    await client.query("ROLLBACK")
    // Aggregates and named safety gates only. Never expose confidential
    // allowances, true warehouse unit counts, personal photos or phone numbers.
    process.stdout.write("SELF_BUILD_READ_ONLY_LAUNCH_AUDIT=" + JSON.stringify(result) + "\n")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    await client.end()
  }
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  run().catch(error => {
    console.error("Self-build readiness audit failed:", error instanceof Error ? error.message : "UNKNOWN_ERROR")
    process.exitCode = 1
  })
}
