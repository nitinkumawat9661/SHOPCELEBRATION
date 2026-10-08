import { cookies } from "next/headers"
import { scryptSync, timingSafeEqual } from "node:crypto"
import { env, requireEnv, requireSecret } from "../../config/env"
import { securityConfig } from "../../config/security"
import { validation } from "../../config/validation"
import { signValue, verifySignedValue } from "./tokens"
import { adminPasskeyExists } from "../server/admin-passkeys"

export const ADMIN_COOKIE_NAME = securityConfig.adminCookieName

export type AdminAuthMethod = "password" | "passkey"
type SessionPayload = { exp: number; version: string; method: AdminAuthMethod }

function scryptOptions() {
  return {
    N: securityConfig.scrypt.cost,
    r: securityConfig.scrypt.blockSize,
    p: securityConfig.scrypt.parallelization,
    maxmem: securityConfig.scrypt.maxmemBytes
  }
}

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

  const actual = scryptSync(password, salt, expected.length, scryptOptions())
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function createAdminSession(method: AdminAuthMethod) {
  const payload: SessionPayload = {
    exp: Math.floor(Date.now() / 1000) + validation.adminSessionTtlSeconds,
    version: requireEnv("adminSessionVersion"),
    method
  }
  return signValue(Buffer.from(JSON.stringify(payload)).toString("base64url"), requireSecret("adminSessionSecret"))
}

export function validateAdminSession(value: string | undefined): SessionPayload | null {
  if (!value) return null
  const encoded = verifySignedValue(value, requireSecret("adminSessionSecret"))
  if (!encoded) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload
    if (payload.exp <= Math.floor(Date.now() / 1000) || payload.version !== env.adminSessionVersion) return null
    if (payload.method !== "password" && payload.method !== "passkey") return null
    return payload
  } catch {
    return null
  }
}

export async function getAdminAccessState() {
  const session = validateAdminSession((await cookies()).get(ADMIN_COOKIE_NAME)?.value)
  const passkeyEnabled = await adminPasskeyExists()
  const authenticated = Boolean(session && (session.method === "passkey" || !passkeyEnabled))
  return {
    authenticated,
    passkeyEnabled,
    method: authenticated ? session?.method || null : null
  }
}

export async function isAdminRequest() {
  return (await getAdminAccessState()).authenticated
}
