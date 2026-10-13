#!/usr/bin/env node
// Production Self-Build NO-INVENTORY prelaunch check: READ ONLY.
// Does not query or modify category stock, SKU inventory, reservation counts
// or any stock table. Customer checkout remains database-hard-gated OFF.
import pg from "pg"

const { Client } = pg

export function evaluateLaunchReadiness({ config, categories, options, tiers, expiredDrafts }) {
  if (!config || config.customer_enabled !== false || config.show_item_prices !== false) {
    throw new Error("SELF_BUILD_HARD_LAUNCH_GATE_MISMATCH")
  }
  const missing = []
  if (categories.active + options.active === 0) missing.push("no_active_customer_choices")
  if (tiers.enabled === 0) missing.push("private_tier_allowances_not_configured")
  if (expiredDrafts > 0) missing.push("review_expired_draft_cleanup")
  // Never infer that a merchant gateway / refund or production launch was
  // tested just because the source code compiles or no-stock budget is set.
  missing.push("gateway_sandbox_success_failure_retry_refund_not_signed_off")
  missing.push("private_paid_photo_delivery_retention_live_e2e_not_signed_off")
  missing.push("owner_customer_launch_approval_required")
  return {
    customerCheckoutEnabled: false,
    launchReady: false,
    inventoryRequired: false,
    activeSelectableCategories: categories.active,
    activeSizeOptions: options.active,
    activePrivateTierAllowances: tiers.enabled,
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
      SELECT COUNT(*)::integer AS active
      FROM self_build_categories WHERE active AND selection_kind IN ('category','photo')
    `)
    const options = await client.query(`
      SELECT COUNT(*)::integer AS active FROM self_build_options o
      JOIN self_build_categories c ON c.id=o.category_id
      WHERE o.active AND c.active AND c.selection_kind='variant'
    `)
    const tiers = await client.query(`
      SELECT COUNT(*) FILTER (WHERE enabled AND allowance_paise > 0)::integer AS enabled
      FROM self_build_tier_allowances
    `)
    const drafts = await client.query(`
      SELECT COUNT(*)::integer AS n FROM self_build_drafts WHERE expires_at < now()
    `)
    const result = evaluateLaunchReadiness({
      config: configRows.rows[0],
      categories: categories.rows[0],
      options: options.rows[0],
      tiers: tiers.rows[0],
      expiredDrafts: drafts.rows[0].n
    })
    await client.query("ROLLBACK")
    // Only public aggregate counts and named gates. No category stock, photo,
    // actual internal budgets, order identities or customer data is selected.
    process.stdout.write("SELF_BUILD_READ_ONLY_LAUNCH_AUDIT=" + JSON.stringify(result) + "\n")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    await client.end()
  }
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  run().catch(() => {
    console.error("Self-build readiness audit failed")
    process.exitCode = 1
  })
}
