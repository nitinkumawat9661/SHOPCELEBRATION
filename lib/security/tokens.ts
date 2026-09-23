import { createHmac, timingSafeEqual } from "node:crypto"
import { requireSecret } from "../../config/env"
import { securityConfig } from "../../config/security"

function hmac(value: string, secret: string, encoding: "base64url" | "hex") {
  return createHmac(securityConfig.hashAlgorithm, secret).update(value).digest(encoding)
}

export function createTrackingToken(idempotencyKey: string) {
  return hmac(`track:${idempotencyKey}`, requireSecret("trackingSecret"), "base64url")
}

export function trackingTokenHash(token: string) {
  return hmac(token, requireSecret("trackingSecret"), "hex")
}

export function signValue(value: string, secret: string) {
  return `${value}.${hmac(value, secret, "base64url")}`
}

export function verifySignedValue(input: string, secret: string) {
  const dot = input.lastIndexOf(".")
  if (dot < 1) return null
  const value = input.slice(0, dot)
  const signature = input.slice(dot + 1)
  const expected = hmac(value, secret, "base64url")
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return value
}
