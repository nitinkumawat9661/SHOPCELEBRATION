import { randomUUID } from "node:crypto"
import { validation } from "../../config/validation"
import { hasUnsafeText, sanitizeText } from "../validation/text"
import { hashCustomerPassword, isValidCustomerPassword, verifyCustomerPassword } from "../security/customer-password"
import { query } from "./db"
import type { OrderStatus } from "../domain/order-status"

const DUMMY_PASSWORD_HASH = `${"00".repeat(16)}:${"00".repeat(64)}`

export class CustomerAccountError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code)
  }
}

export type CustomerAccount = {
  id: string
  phone: string
  displayName: string
  createdAt: string
}

export type CustomerOrderSummary = {
  publicId: string
  amountPaise: number
  tierName: string
  selectedProductIds: string[]
  selectedProductNames: string[]
  requiredDate: string
  occasion: string
  status: OrderStatus
  paymentStatus: string
  receiverName: string
  packingVideoKey: string | null
  shippingProvider: string | null
  shippingTrackingNumber: string | null
  customerApprovedAt: string | null
  createdAt: string
  updatedAt: string
}

type AccountRow = {
  id: string
  phone: string
  display_name: string
  password_hash: string
  status: string
  created_at: Date
}

type OrderRow = {
  public_id: string
  amount_paise: number
  tier_name: string
  selected_product_ids: string[]
  selected_product_names: string[]
  required_date: string
  occasion: string
  status: OrderStatus
  payment_status: string
  receiver_name: string
  packing_video_key: string | null
  shipping_provider: string | null
  shipping_tracking_number: string | null
  customer_approved_at: Date | null
  created_at: Date
  updated_at: Date
}

export function normalizeCustomerPhone(value: unknown) {
  const raw = String(value ?? "").trim()
  const digits = raw.replace(/\D/g, "")
  const normalized = digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith("0")
      ? digits.slice(1)
      : digits
  if (!/^\d{10}$/.test(normalized)) throw new CustomerAccountError("INVALID_PHONE")
  return normalized
}

function normalizeDisplayName(value: unknown) {
  if (hasUnsafeText(value)) throw new CustomerAccountError("UNSAFE_TEXT")
  const name = sanitizeText(value, validation.customerAccount.displayNameMax)
  if (name.length < validation.name.min) throw new CustomerAccountError("INVALID_NAME")
  return name
}

function publicAccount(row: AccountRow): CustomerAccount {
  return {
    id: row.id,
    phone: row.phone,
    displayName: row.display_name,
    createdAt: row.created_at.toISOString()
  }
}

export async function createCustomerAccount(input: { phone?: unknown; password?: unknown; displayName?: unknown }) {
  const phone = normalizeCustomerPhone(input.phone)
  const displayName = normalizeDisplayName(input.displayName)
  if (!isValidCustomerPassword(input.password)) throw new CustomerAccountError("INVALID_PASSWORD")
  const passwordHash = hashCustomerPassword(input.password)
  try {
    const result = await query<AccountRow>(
      `INSERT INTO customer_accounts (id, phone, display_name, password_hash, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, phone, display_name, password_hash, status, created_at`,
      [randomUUID(), phone, displayName, passwordHash]
    )
    return publicAccount(result.rows[0])
  } catch (error) {
    const dbError = error as { code?: string; constraint?: string }
    if (dbError.code === "23505" && dbError.constraint?.includes("phone")) throw new CustomerAccountError("ACCOUNT_EXISTS", 409)
    throw error
  }
}

export async function authenticateCustomerAccount(input: { phone?: unknown; password?: unknown }) {
  const phone = normalizeCustomerPhone(input.phone)
  const password = typeof input.password === "string" ? input.password : ""
  if (!isValidCustomerPassword(password)) throw new CustomerAccountError("INVALID_CREDENTIALS", 401)
  const result = await query<AccountRow>(
    `SELECT id, phone, display_name, password_hash, status, created_at
     FROM customer_accounts WHERE phone = $1 LIMIT 1`,
    [phone]
  )
  const row = result.rows[0]
  const passwordMatches = verifyCustomerPassword(password, row?.password_hash || DUMMY_PASSWORD_HASH)
  if (!row || row.status !== "active" || !passwordMatches) throw new CustomerAccountError("INVALID_CREDENTIALS", 401)
  await query(`UPDATE customer_accounts SET last_login_at = now(), updated_at = now() WHERE id = $1`, [row.id])
  return publicAccount(row)
}

export async function findCustomerAccountById(id: string) {
  const result = await query<AccountRow>(
    `SELECT id, phone, display_name, password_hash, status, created_at
     FROM customer_accounts WHERE id = $1 AND status = 'active' LIMIT 1`,
    [id]
  )
  return result.rows[0] ? publicAccount(result.rows[0]) : null
}

export async function listCustomerOrders(accountId: string, limit = 50): Promise<CustomerOrderSummary[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const result = await query<OrderRow>(
    `SELECT public_id, amount_paise, tier_name, selected_product_ids, selected_product_names, required_date::text, occasion, status,
            payment_status, receiver_name, packing_video_key, shipping_provider, shipping_tracking_number,
            customer_approved_at, created_at, updated_at
       FROM orders
      WHERE customer_account_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [accountId, safeLimit]
  )
  return result.rows.map((row) => ({
    publicId: row.public_id,
    amountPaise: row.amount_paise,
    tierName: row.tier_name,
    selectedProductIds: row.selected_product_ids,
    selectedProductNames: row.selected_product_names || [],
    requiredDate: row.required_date,
    occasion: row.occasion,
    status: row.status,
    paymentStatus: row.payment_status,
    receiverName: row.receiver_name,
    packingVideoKey: row.packing_video_key,
    shippingProvider: row.shipping_provider,
    shippingTrackingNumber: row.shipping_tracking_number,
    customerApprovedAt: row.customer_approved_at ? row.customer_approved_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }))
}
