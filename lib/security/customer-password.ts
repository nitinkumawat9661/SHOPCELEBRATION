import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { securityConfig } from "../../config/security"
import { validation } from "../../config/validation"

function decodeHex(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null
  return Buffer.from(value, "hex")
}

export function isValidCustomerPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= validation.customerAccount.passwordMin && password.length <= validation.customerAccount.passwordMax
}

export function hashCustomerPassword(password: string) {
  if (!isValidCustomerPassword(password)) throw new Error("INVALID_PASSWORD")
  const salt = randomBytes(securityConfig.scrypt.generatedSaltBytes)
  const hash = scryptSync(password, salt, securityConfig.scrypt.generatedHashBytes)
  return `${salt.toString("hex")}:${hash.toString("hex")}`
}

export function verifyCustomerPassword(password: string, stored: string) {
  if (!isValidCustomerPassword(password)) return false
  const [saltHex, hashHex] = stored.split(":")
  if (!saltHex || !hashHex) return false
  const salt = decodeHex(saltHex)
  const expected = decodeHex(hashHex)
  if (!salt || !expected) return false
  if (salt.length < securityConfig.scrypt.minimumSaltBytes || expected.length < securityConfig.scrypt.minimumHashBytes) return false
  const actual = scryptSync(password, salt, expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
