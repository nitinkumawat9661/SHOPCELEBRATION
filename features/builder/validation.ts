import { validation } from "../../config/validation"
import { errorMessages } from "../../lib/domain/content"
import { digitsOnly } from "../../lib/validation/text"
import type { CheckoutData } from "./types"

export type CheckoutFieldErrors = Partial<Record<keyof CheckoutData, string>>

export function todayForDateInput() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function validateCheckoutFields(checkout: CheckoutData): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {}

  if (checkout.customerName.trim().length < validation.name.min) errors.customerName = errorMessages.DETAILS_CUSTOMER_NAME_REQUIRED

  const phone = digitsOnly(checkout.phone)
  if (phone.length < validation.phone.minDigits || phone.length > validation.phone.maxDigits) {
    errors.phone = errorMessages.DETAILS_PHONE_INVALID
  }

  if (checkout.receiverName.trim().length < validation.name.min) errors.receiverName = errorMessages.DETAILS_RECEIVER_NAME_REQUIRED

  if (!checkout.requiredDate.trim()) errors.requiredDate = errorMessages.DETAILS_REQUIRED_DATE_REQUIRED
  else if (checkout.requiredDate < todayForDateInput()) errors.requiredDate = errorMessages.INVALID_REQUIRED_DATE

  if (digitsOnly(checkout.pincode).length !== validation.pincodeDigits) errors.pincode = errorMessages.DETAILS_PINCODE_INVALID
  if (checkout.address.trim().length < validation.address.min) errors.address = errorMessages.DETAILS_ADDRESS_REQUIRED

  return errors
}

export function validateCheckoutDetails(checkout: CheckoutData) {
  return Object.values(validateCheckoutFields(checkout))[0] || ""
}

export function validatePaymentReference(value: string) {
  const reference = value.trim()
  const validLength = reference.length >= validation.paymentReference.min && reference.length <= validation.paymentReference.max
  const validCharacters = /^[0-9A-Za-z-]+$/.test(reference)
  return validLength && validCharacters ? "" : errorMessages.INVALID_PAYMENT_REFERENCE
}
