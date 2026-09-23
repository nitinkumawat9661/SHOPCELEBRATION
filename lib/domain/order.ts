import { toMinorUnits } from "./payment"
import { orderConfig } from "../../config/order"
import { validation } from "../../config/validation"
import { productById, selectedPoints, tierById, type CatalogConfig } from "./catalog"
import { localIsoDate } from "../validation/date"
import { isUuidV4 } from "../validation/identifiers"
import { digitsOnly, sanitizeText } from "../validation/text"

export type CreateOrderInput = {
  tierId?: unknown
  selectedProductIds?: unknown
  requiredDate?: unknown
  customerName?: unknown
  phone?: unknown
  receiverName?: unknown
  address?: unknown
  city?: unknown
  state?: unknown
  pincode?: unknown
  occasion?: unknown
  message?: unknown
  paymentReference?: unknown
  policyVersion?: unknown
  policyAccepted?: unknown
  idempotencyKey?: unknown
  offerQuoteId?: unknown
}

export type NormalizedOrder = {
  tierId: string
  amountPaise: number
  tierName: string
  selectedProductIds: string[]
  selectedProductNames: string[]
  requiredDate: string
  customerName: string
  phone: string
  receiverName: string
  address: string
  city: string
  state: string
  pincode: string
  occasion: string
  message: string
  paymentReference: string
  policyVersion: string
  idempotencyKey: string
}

export class OrderValidationError extends Error {
  constructor(public readonly code: string) {
    super(code)
  }
}

function normalizePaymentReference(value: unknown) {
  const raw = sanitizeText(value, validation.paymentReference.max)
  if (!raw || !/^[0-9A-Za-z-]+$/.test(raw)) return ""
  return raw.toUpperCase()
}

function isRealIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function normalizeOrderInput(input: CreateOrderInput, timezone: string, catalog: CatalogConfig): NormalizedOrder {
  const tierId = sanitizeText(input.tierId, validation.tierIdMax)
  const tier = tierById(catalog, tierId)
  if (!tier) throw new OrderValidationError("INVALID_TIER")

  const rawIds = Array.isArray(input.selectedProductIds) ? input.selectedProductIds : []
  const ids = Array.from(new Set(rawIds.filter((value): value is string => typeof value === "string")))
  const selectedProducts = ids.map((id) => productById(catalog, id)).filter(Boolean)
  if (selectedProducts.length !== ids.length) throw new OrderValidationError("INVALID_PRODUCT")
  if (ids.length > tier.maxChoices) throw new OrderValidationError("TOO_MANY_PRODUCTS")
  if (selectedProducts.some((product) => product!.minTier > tier.price)) throw new OrderValidationError("PRODUCT_NOT_ELIGIBLE_FOR_TIER")
  if (selectedPoints(catalog, ids) > tier.pointBudget) throw new OrderValidationError("PRODUCT_MIX_EXCEEDS_TIER")

  const customerName = sanitizeText(input.customerName, validation.name.max)
  const phone = digitsOnly(input.phone)
  const receiverName = sanitizeText(input.receiverName, validation.name.max)
  const address = sanitizeText(input.address, validation.address.max)
  const city = sanitizeText(input.city, validation.city.max)
  const state = sanitizeText(input.state, validation.state.max)
  const pincode = digitsOnly(input.pincode)
  const requiredDate = sanitizeText(input.requiredDate, 10)
  const occasion = sanitizeText(input.occasion, validation.occasionMax)
  const message = sanitizeText(input.message, validation.messageMax)
  const paymentReference = normalizePaymentReference(input.paymentReference)
  const policyVersion = sanitizeText(input.policyVersion, validation.policyVersionMax)
  const idempotencyKey = sanitizeText(input.idempotencyKey, validation.idempotencyKeyMax)

  const missing =
    customerName.length < validation.name.min ||
    phone.length < validation.phone.minDigits ||
    phone.length > validation.phone.maxDigits ||
    receiverName.length < validation.name.min ||
    address.length < validation.address.min ||
    pincode.length !== validation.pincodeDigits ||
    !requiredDate ||
    !occasion

  if (missing) throw new OrderValidationError("MISSING_REQUIRED_FIELDS")
  if (paymentReference.length < validation.paymentReference.min) throw new OrderValidationError("INVALID_PAYMENT_REFERENCE")
  if (!catalog.occasions.includes(occasion)) throw new OrderValidationError("INVALID_OCCASION")
  if (policyVersion !== orderConfig.policyVersion || input.policyAccepted !== true) throw new OrderValidationError("POLICY_VERSION_MISMATCH")
  if (!isUuidV4(idempotencyKey)) throw new OrderValidationError("INVALID_IDEMPOTENCY_KEY")
  if (!isRealIsoDate(requiredDate) || requiredDate < localIsoDate(timezone)) throw new OrderValidationError("INVALID_REQUIRED_DATE")

  return {
    tierId: tier.id,
    amountPaise: toMinorUnits(tier.price),
    tierName: tier.name,
    selectedProductIds: ids,
    selectedProductNames: selectedProducts.map((product) => product!.name),
    requiredDate,
    customerName,
    phone,
    receiverName,
    address,
    city,
    state,
    pincode,
    occasion,
    message,
    paymentReference,
    policyVersion,
    idempotencyKey
  }
}
