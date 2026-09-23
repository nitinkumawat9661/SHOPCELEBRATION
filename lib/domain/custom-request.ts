import { validation } from "../../config/validation"
import { digitsOnly, hasUnsafeText, sanitizeText } from "../validation/text"

export type CustomHamperRequestInput = {
  customerName?: unknown
  phone?: unknown
  budget?: unknown
  message?: unknown
}

export type NormalizedCustomHamperRequest = {
  customerName: string
  phone: string
  budgetPaise: number
  message: string
}

export class CustomRequestValidationError extends Error {
  constructor(public readonly code: string) {
    super(code)
  }
}

export function normalizeCustomHamperRequest(input: CustomHamperRequestInput): NormalizedCustomHamperRequest {
  if (hasUnsafeText(input.customerName) || hasUnsafeText(input.message)) throw new CustomRequestValidationError("UNSAFE_TEXT")
  const customerName = sanitizeText(input.customerName, validation.name.max)
  const phone = digitsOnly(input.phone)
  const message = sanitizeText(input.message, validation.customRequest.messageMax)
  const budget = Number(input.budget)

  if (customerName.length < validation.name.min) throw new CustomRequestValidationError("INVALID_NAME")
  if (phone.length < validation.phone.minDigits || phone.length > validation.phone.maxDigits) throw new CustomRequestValidationError("INVALID_PHONE")
  if (!Number.isInteger(budget) || budget < validation.customRequest.budgetMin || budget > validation.customRequest.budgetMax) {
    throw new CustomRequestValidationError("INVALID_BUDGET")
  }
  if (message.length < validation.customRequest.messageMin) throw new CustomRequestValidationError("REQUEST_TOO_SHORT")

  return { customerName, phone, budgetPaise: budget * 100, message }
}
