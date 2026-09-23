import { cookies } from "next/headers"
import { scryptSync, timingSafeEqual } from "node:crypto"
import { env, requireEnv, requireSecret } from "../../config/env"
import { securityConfig } from "../../config/security"
import { validation } from "../../config/validation"
import { signValue, verifySignedValue } from "./tokens"

export const ADMIN_COOKIE_NAME = securityConfig.adminCookieName

type SessionPayload = { exp: number; version: string }

function decodeHex(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null
  return Buffer.from(value, "hex")
}

export function verifyAdminPassword(password: string) {
  if (!password || password.length > validation.adminPasswordInputMax) return false

  const stored = requireEnv("adminPasswordHash")
  const [saltHex, hashHex] = stored.split(":")
  if (!saltHex || !hashHex) return false

  const salt = decodeHex(saltHex)
  const expected = decodeHex(hashHex)
  if (!salt || !expected) return false
  if (salt.length < securityConfig.scrypt.minimumSaltBytes || expected.length < securityConfig.scrypt.minimumHashBytes) return false

  const actual = scryptSync(password, salt, expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function createAdminSession() {
  const payload: SessionPayload = {
    exp: Math.floor(Date.now() / 1000) + validation.adminSessionTtlSeconds,
    version: requireEnv("adminSessionVersion")
  }
  return signValue(Buffer.from(JSON.stringify(payload)).toString("base64url"), requireSecret("adminSessionSecret"))
}

export function validateAdminSession(value: string | undefined) {
  if (!value) return false
  const encoded = verifySignedValue(value, requireSecret("adminSessionSecret"))
  if (!encoded) return false
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload
    return payload.exp > Math.floor(Date.now() / 1000) && payload.version === env.adminSessionVersion
  } catch {
    return false
  }
}

export async function isAdminRequest() {
  return validateAdminSession((await cookies()).get(ADMIN_COOKIE_NAME)?.value)
}
