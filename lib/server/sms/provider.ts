import { smsConfig, smsReady } from "../../../config/sms"

export class SmsProviderError extends Error {
  constructor(public readonly code = "SMS_PROVIDER_UNAVAILABLE") {
    super(code)
  }
}

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function verifiedIdentifier(payload: unknown) {
  const queue: JsonObject[] = []
  const root = asObject(payload)
  if (!root) return ""
  queue.push(root)

  for (let index = 0; index < queue.length && index < 12; index += 1) {
    const current = queue[index]
    for (const key of ["identifier", "mobile", "phone"]) {
      const value = stringValue(current[key])
      if (value) return value
    }
    for (const key of ["data", "result", "response", "message"]) {
      const child = asObject(current[key])
      if (child) queue.push(child)
    }
  }

  return ""
}

function explicitProviderFailure(payload: unknown) {
  const root = asObject(payload)
  if (!root) return false
  const type = stringValue(root.type).toLowerCase()
  const status = stringValue(root.status).toLowerCase()
  const code = typeof root.code === "number" ? String(root.code) : stringValue(root.code)
  const success = root.success
  return type === "error" || status === "error" || status === "failed" || code === "201" || success === false
}

function providerFailureMeta(payload: unknown) {
  const root = asObject(payload)
  if (!root) return { type: "", code: "", message: "" }
  const rawMessage = stringValue(root.message)
  return {
    type: stringValue(root.type).slice(0, 64),
    code: (typeof root.code === "number" ? String(root.code) : stringValue(root.code)).slice(0, 32),
    message: rawMessage.slice(0, 160)
  }
}

export async function verifyPasswordResetAccessToken(accessToken: string) {
  if (!smsReady() || smsConfig.provider !== "msg91-widget") {
    throw new SmsProviderError("SMS_OTP_UNAVAILABLE")
  }

  const token = accessToken.trim()
  if (token.length < 20 || token.length > 8000) throw new SmsProviderError("INVALID_OTP")

  // MSG91's server-side access-token verification endpoint expects the
  // authkey and access-token as form fields. Sending JSON can be answered
  // with HTTP 200 while the payload itself reports AuthenticationFailure.
  const body = new URLSearchParams({
    authkey: smsConfig.msg91.authKey,
    "access-token": token
  })

  const response = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(10000)
  })

  const payload = await response.json().catch(() => null)
  const identifier = verifiedIdentifier(payload)
  const providerRejected = explicitProviderFailure(payload)

  if (!response.ok || providerRejected || !identifier) {
    console.error("msg91-password-reset-token", {
      status: response.status,
      providerRejected,
      identifierPresent: Boolean(identifier),
      provider: providerFailureMeta(payload)
    })
    throw new SmsProviderError(response.status >= 500 ? "SMS_PROVIDER_UNAVAILABLE" : "INVALID_OTP")
  }

  return { identifier }
}
