import { createHmac } from "node:crypto"
import { cookies } from "next/headers"
import { env, requireSecret } from "../../config/env"
import { securityConfig } from "../../config/security"
import { validation } from "../../config/validation"
import { query } from "../server/db"
import { signValue, verifySignedValue } from "./tokens"

export const CUSTOMER_COOKIE_NAME = securityConfig.customerCookieName

type CustomerSessionPayload = {
  accountId: string
  sessionVersion: number
  exp: number
  v: 3
}

type LegacyCustomerSessionPayload =
  | {
      accountId: string
      exp: number
      v: 1
    }
  | {
      accountId: string
      sessionVersion: number
      exp: number
      v: 3
    }

const PREFIX = "customer:"
const SESSION_KEY_CONTEXT = "celebration:customer-session:v3"

function customerSessionSigningKey() {
  return createHmac(securityConfig.hashAlgorithm, requireSecret("trackingSecret"))
    .update(SESSION_KEY_CONTEXT)
    .digest("base64url")
}

export function createCustomerSession(accountId: string, sessionVersion: number) {
  const payload: CustomerSessionPayload = {
    accountId,
    sessionVersion,
    exp: Math.floor(Date.now() / 1000) + validation.customerSessionTtlSeconds,
    v: 2
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return signValue(`${PREFIX}${encoded}`, customerSessionSigningKey())
}

export function validateCustomerSession(value: string | undefined) {
  if (!value) return null

  let verified = verifySignedValue(value, customerSessionSigningKey())
  let legacySignature = false
  if (!verified) {
    verified = verifySignedValue(value, requireSecret("trackingSecret"))
    legacySignature = true
  }
  if (!verified?.startsWith(PREFIX)) return null

  try {
    const payload = JSON.parse(Buffer.from(verified.slice(PREFIX.length), "base64url").toString("utf8")) as CustomerSessionPayload | LegacyCustomerSessionPayload
    if (!payload.accountId || payload.exp <= Math.floor(Date.now() / 1000)) return null

    if (legacySignature) {
      if (payload.v === 1) return { accountId: payload.accountId, sessionVersion: 1, exp: payload.exp }
      if (payload.v !== 2 || !Number.isInteger(payload.sessionVersion) || payload.sessionVersion < 1) return null
      return { accountId: payload.accountId, sessionVersion: payload.sessionVersion, exp: payload.exp }
    }

    if (payload.v !== 3 || !Number.isInteger(payload.sessionVersion) || payload.sessionVersion < 1) return null
    return { accountId: payload.accountId, sessionVersion: payload.sessionVersion, exp: payload.exp }
  } catch {
    return null
  }
}

export async function getCustomerSession() {
  const parsed = validateCustomerSession((await cookies()).get(CUSTOMER_COOKIE_NAME)?.value)
  if (!parsed) return null
  const result = await query<{ session_version: number }>(
    `SELECT session_version FROM customer_accounts WHERE id = $1 AND status = 'active' AND phone_verified_at IS NOT NULL LIMIT 1`,
    [parsed.accountId]
  )
  const row = result.rows[0]
  if (!row || row.session_version !== parsed.sessionVersion) return null
  return parsed
}

export function customerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: env.isProduction,
    path: "/",
    maxAge: validation.customerSessionTtlSeconds
  }
}
