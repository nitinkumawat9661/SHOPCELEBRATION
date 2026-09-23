import { validation } from "../../config/validation"

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PUBLIC_ORDER_ID = /^[A-Z0-9][A-Z0-9-]*$/

export function isUuidV4(value: string) {
  return value.length <= validation.idempotencyKeyMax && UUID_V4.test(value)
}

export function isSafePublicOrderId(value: string) {
  return value.length > 0 && value.length <= validation.publicOrderIdMax && PUBLIC_ORDER_ID.test(value)
}
