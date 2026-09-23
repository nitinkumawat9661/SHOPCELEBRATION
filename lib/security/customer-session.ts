import { cookies } from "next/headers"
import { env, requireSecret } from "../../config/env"
import { securityConfig } from "../../config/security"
import { validation } from "../../config/validation"
import { signValue, verifySignedValue } from "./tokens"

export const CUSTOMER_COOKIE_NAME = securityConfig.customerCookieName

type CustomerSessionPayload = {
  accountId: string
  exp: number
  v: 1
}

const PREFIX = "customer:"

export function createCustomerSession(accountId: string) {
  const payload: CustomerSessionPayload = {
    accountId,
    exp: Math.floor(Date.now() / 1000) + validation.customerSessionTtlSeconds,
    v: 1
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return signValue(`${PREFIX}${encoded}`, requireSecret("trackingSecret"))
}

export function validateCustomerSession(value: string | undefined): CustomerSessionPayload | null {
  if (!value) return null
  const verified = verifySignedValue(value, requireSecret("trackingSecret"))
  if (!verified?.startsWith(PREFIX)) return null
  try {
    const payload = JSON.parse(Buffer.from(verified.slice(PREFIX.length), "base64url").toString("utf8")) as CustomerSessionPayload
    if (payload.v !== 1 || !payload.accountId || payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export async function getCustomerSession() {
  return validateCustomerSession((await cookies()).get(CUSTOMER_COOKIE_NAME)?.value)
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
