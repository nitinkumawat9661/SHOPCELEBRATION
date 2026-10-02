import { toMinorUnits } from "./payment"
import { orderConfig } from "../../config/order"
import { validation } from "../../config/validation"
import { isIndividuallySellable, productById, selectedPoints, tierById, type CatalogConfig } from "./catalog"
import { localIsoDate } from "../validation/date"
import { isUuidV4 } from "../validation/identifiers"
import { digitsOnly, sanitizeText } from "../validation/text"

export type CreateOrderInput = {
  orderType?: unknown
  items?: unknown
  expectedSubtotalPaise?: unknown
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

export type OrderLineItem = {
  productId: string
  name: string
  quantity: number
  unitPricePaise: number
  lineTotalPaise: number
  imageUrl?: string
}

export type NormalizedOrder = {
  orderType: "hamper" | "individual"
  lineItems: OrderLineItem[]
  expectedSubtotalPaise?: number
  tierId: string | null
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
  paymentReference: string | null
  policyVersion: string
  idempotencyKey: string
}

export class OrderValidationError extends Error {
  constructor(public readonly code: string) {
    super(code)
  }
}

export function orderCartKey(order: Pick<NormalizedOrder, "orderType" | "tierId" | "selectedProductIds" | "lineItems">) {
  return JSON.stringify(order.orderType === "individual"
    ? [order.orderType, order.lineItems.map(({ productId, quantity }) => ({ productId, quantity })).sort((a, b) => a.productId.localeCompare(b.productId))]
    : [order.orderType, order.tierId, [...order.selectedProductIds].sort()])
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

export function normalizeOrderInput(
  input: CreateOrderInput,
  timezone: string,
  catalog: CatalogConfig,
  options: { requirePaymentReference?: boolean; checkExpectedSubtotal?: boolean } = {}
): NormalizedOrder {
  const requirePaymentReference = options.requirePaymentReference !== false
  if (input.orderType !== undefined && input.orderType !== "hamper" && input.orderType !== "individual") {
    throw new OrderValidationError("INVALID_ORDER_TYPE")
  }
  const orderType = input.orderType === "individual" ? "individual" : "hamper"
  const tierId = sanitizeText(input.tierId, validation.tierIdMax)
  const tier = tierById(catalog, tierId)
  let ids: string[] = []
  let names: string[] = []
  const lineItems: OrderLineItem[] = []
  let amountPaise = 0
  if (orderType === "individual") {
    if (typeof input.expectedSubtotalPaise !== "number" || !Number.isSafeInteger(input.expectedSubtotalPaise) || input.expectedSubtotalPaise < 100 || input.expectedSubtotalPaise > 2_147_483_647) {
      throw new OrderValidationError("INVALID_CART_TOTAL")
    }
    if (!Array.isArray(input.items) || !input.items.length) throw new OrderValidationError("EMPTY_CART")
    if (input.items.length > 20) throw new OrderValidationError("TOO_MANY_CART_ITEMS")
    for (const value of input.items) {
      const item = value && typeof value === "object" ? value as Record<string, unknown> : {}
      const product = typeof item.productId === "string" ? productById(catalog, item.productId) : undefined
      if (!product) throw new OrderValidationError("INVALID_PRODUCT")
      if (ids.includes(product.id)) throw new OrderValidationError("DUPLICATE_CART_PRODUCT")
      const quantity = item.quantity
      if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        throw new OrderValidationError("INVALID_QUANTITY")
      }
      if (!isIndividuallySellable(product)) {
        throw new OrderValidationError("PRODUCT_NOT_FOR_INDIVIDUAL_SALE")
      }
      const unitPricePaise = product.salePricePaise!
      const lineTotalPaise = unitPricePaise * quantity
      amountPaise += lineTotalPaise
      if (!Number.isSafeInteger(amountPaise) || amountPaise > 2_147_483_647) throw new OrderValidationError("CART_AMOUNT_TOO_LARGE")
      ids.push(product.id)
      names.push(`${product.name} × ${quantity}`)
      lineItems.push({ productId: product.id, name: product.name, quantity, unitPricePaise, lineTotalPaise, ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}) })
    }
    if (options.checkExpectedSubtotal !== false && amountPaise !== input.expectedSubtotalPaise) throw new OrderValidationError("CART_PRICE_CHANGED")
  } else {
    if (!tier) throw new OrderValidationError("INVALID_TIER")
    const rawIds = Array.isArray(input.selectedProductIds) ? input.selectedProductIds : []
    ids = Array.from(new Set(rawIds.filter((value): value is string => typeof value === "string")))
    const selectedProducts = ids.map((id) => productById(catalog, id)).filter(Boolean)
    if (selectedProducts.length !== ids.length) throw new OrderValidationError("INVALID_PRODUCT")
    if (ids.length > tier.maxChoices) throw new OrderValidationError("TOO_MANY_PRODUCTS")
    if (selectedProducts.some((product) => product!.minTier > tier.price)) throw new OrderValidationError("PRODUCT_NOT_ELIGIBLE_FOR_TIER")
    if (selectedPoints(catalog, ids) > tier.pointBudget) throw new OrderValidationError("PRODUCT_MIX_EXCEEDS_TIER")
    names = selectedProducts.map((product) => product!.name)
    amountPaise = toMinorUnits(tier.price)
  }

  const customerName = sanitizeText(input.customerName, validation.name.max)
  const phone = digitsOnly(input.phone)
  const receiverName = sanitizeText(input.receiverName, validation.name.max)
  const address = sanitizeText(input.address, validation.address.max)
  const city = sanitizeText(input.city, validation.city.max)
  const state = sanitizeText(input.state, validation.state.max)
  const pincode = digitsOnly(input.pincode)
  const requiredDate = sanitizeText(input.requiredDate, 10)
  const occasion = orderType === "individual" ? "Individual purchase" : sanitizeText(input.occasion, validation.occasionMax)
  const message = sanitizeText(input.message, validation.messageMax)
  const paymentReferenceValue = normalizePaymentReference(input.paymentReference)
  const paymentReference = paymentReferenceValue || null
  const policyVersion = sanitizeText(input.policyVersion, validation.policyVersionMax)
  const idempotencyKey = sanitizeText(input.idempotencyKey, validation.idempotencyKeyMax)

  const missing =
    customerName.length < validation.name.min ||
    phone.length < validation.phone.minDigits ||
    phone.length > validation.phone.maxDigits ||
    receiverName.length < validation.name.min ||
    address.length < validation.address.min ||
    (orderType === "individual" && (city.length < validation.name.min || state.length < validation.name.min)) ||
    pincode.length !== validation.pincodeDigits ||
    !requiredDate ||
    !occasion

  if (missing) throw new OrderValidationError("MISSING_REQUIRED_FIELDS")
  if (requirePaymentReference && (!paymentReference || paymentReference.length < validation.paymentReference.min)) {
    throw new OrderValidationError("INVALID_PAYMENT_REFERENCE")
  }
  if (orderType === "hamper" && !catalog.occasions.includes(occasion)) throw new OrderValidationError("INVALID_OCCASION")
  if (policyVersion !== orderConfig.policyVersion || input.policyAccepted !== true) throw new OrderValidationError("POLICY_VERSION_MISMATCH")
  if (!isUuidV4(idempotencyKey)) throw new OrderValidationError("INVALID_IDEMPOTENCY_KEY")
  if (!isRealIsoDate(requiredDate) || requiredDate < localIsoDate(timezone)) throw new OrderValidationError("INVALID_REQUIRED_DATE")

  return {
    orderType,
    lineItems,
    expectedSubtotalPaise: orderType === "individual" ? input.expectedSubtotalPaise as number : undefined,
    tierId: orderType === "individual" ? null : tier!.id,
    amountPaise,
    tierName: orderType === "individual" ? (lineItems.length === 1 ? lineItems[0].name : "Individual items") : tier!.name,
    selectedProductIds: ids,
    selectedProductNames: names,
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
