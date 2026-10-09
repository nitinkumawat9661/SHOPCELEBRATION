import type { CheckoutData } from "../builder/types"
import type { DeliveryAddress } from "../../lib/domain/delivery-address"
import { deliveryFromCheckout } from "../../lib/domain/delivery-address"

const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000
const keys = ["customerName", "phone", "receiverName", "address", "city", "state", "pincode", "requiredDate", "occasion", "message"] as const
type FieldKey = typeof keys[number]

function storageKey(kind: "cart" | "hamper", owner: string) {
  return `celebration:${kind}-checkout:v1:${owner}`
}

export function readCheckoutDraft(kind: "cart" | "hamper", owner: string): { checkout: Partial<CheckoutData>; step: number } | null {
  try {
    const raw = window.localStorage.getItem(storageKey(kind, owner))
    if (!raw) return null
    const draft: unknown = JSON.parse(raw)
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) return null
    const item = draft as Record<string, unknown>
    if (item.version !== 1 || typeof item.savedAt !== "number" || Date.now() - item.savedAt > DRAFT_TTL || item.savedAt > Date.now() + 60_000) {
      window.localStorage.removeItem(storageKey(kind, owner))
      return null
    }
    const value = item.checkout
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const fields = value as Record<string, unknown>
    const checkout: Partial<CheckoutData> = {}
    for (const key of keys) {
      if (typeof fields[key] === "string" && (fields[key] as string).length <= 600) checkout[key] = fields[key] as string
    }
    return { checkout, step: Number(item.step) === 2 ? 2 : 1 }
  } catch { return null }
}

export function writeCheckoutDraft(kind: "cart" | "hamper", owner: string, checkout: CheckoutData, step: number) {
  try {
    const saved = {} as Record<FieldKey, string>
    for (const key of keys) saved[key] = checkout[key]
    window.localStorage.setItem(storageKey(kind, owner), JSON.stringify({ version: 1, savedAt: Date.now(), step: step === 1 ? 1 : 2, checkout: saved }))
  } catch { /* Browser may block storage. Autofill is still available. */ }
}

export function clearCheckoutDraft(kind: "cart" | "hamper", owner: string) {
  try { window.localStorage.removeItem(storageKey(kind, owner)) } catch { /* Ignore */ }
}

export async function loadDefaultAddress(): Promise<DeliveryAddress | null> {
  const response = await fetch("/api/account/address", { cache: "no-store" })
  if (!response.ok) throw new Error("ADDRESS_READ_FAILED")
  const body = await response.json() as { ok?: boolean; address?: DeliveryAddress | null }
  if (!body.ok) throw new Error("ADDRESS_READ_FAILED")
  return body.address || null
}

export async function saveDefaultAddress(checkout: CheckoutData): Promise<DeliveryAddress> {
  const response = await fetch("/api/account/address", { method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: deliveryFromCheckout(checkout) }) })
  if (!response.ok) throw new Error("ADDRESS_SAVE_FAILED")
  const body = await response.json() as { ok?: boolean; address?: DeliveryAddress }
  if (!body.ok || !body.address) throw new Error("ADDRESS_SAVE_FAILED")
  return body.address
}
