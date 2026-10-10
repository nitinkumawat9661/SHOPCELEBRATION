import type { Tier } from "./catalog"

export type HamperOrderProof = {
  tierName: string
  orderCount: number
  totalOrders: number
  sharePercent: number
}

/**
 * A public claim must describe a currently selectable hamper tier, be based
 * on enough individual orders to avoid exposing tiny cohorts, and use a
 * mathematically consistent percentage. Fail closed on corrupt/stale data.
 */
export function isPublicHamperOrderProof(
  proof: HamperOrderProof | null | undefined,
  tiers: readonly Pick<Tier, "name" | "active">[]
): proof is HamperOrderProof {
  if (!proof || typeof proof.tierName !== "string" || !proof.tierName.trim()) return false
  if (!tiers.some(t => t.active !== false && t.name === proof.tierName)) return false
  if (!Number.isSafeInteger(proof.orderCount) || !Number.isSafeInteger(proof.totalOrders) ||
      !Number.isSafeInteger(proof.sharePercent)) return false
  if (proof.totalOrders < 20 || proof.orderCount < 5 ||
      proof.orderCount > proof.totalOrders || proof.sharePercent < 20 ||
      proof.sharePercent > 100) return false
  return Math.round((proof.orderCount / proof.totalOrders) * 100) === proof.sharePercent
}
