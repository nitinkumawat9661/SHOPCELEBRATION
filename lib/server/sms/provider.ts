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
  const root = asObject(payload)
  if (!root) return ""
  const data = asObject(root.data)
  const result = asObject(root.result)
  const response = asObject(root.response)

  const candidates = [
    root.identifier,
    root.mobile,
    root.phone,
    data?.identifier,
    data?.mobile,
    data?.phone,
    result?.identifier,
    result?.mobile,
    result?.phone,
    response?.identifier,
    response?.mobile,
    response?.phone
  ]

  for (const candidate of candidates) {
    const value = stringValue(candidate)
    if (value) return value
  }
  return ""
}

function explicitProviderFailure(payload: unknown) {
  const root = asObject(payload)
  if (!root) return false
  const type = stringValue(root.type).toLowerCase()
  const status = stringValue(root.status).toLowerCase()
  const success = root.success
  return type === "error" || status === "error" || status === "failed" || success === false
}

export async function verifyPasswordResetAccessToken(accessToken: string) {
  if (!smsReady() || smsConfig.provider !== "msg91-widget") {
    throw new SmsProviderError("SMS_OTP_UNAVAILABLE")
  }

  const token = accessToken.trim()
  if (token.length < 20 || token.length > 8000) throw new SmsProviderError("INVALID_OTP")

  const response = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      authkey: smsConfig.msg91.authKey,
      "access-token": token
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000)
  })

  const payload = await response.json().catch(() => null)
  const identifier = verifiedIdentifier(payload)

  if (!response.ok || explicitProviderFailure(payload) || !identifier) {
    console.error("msg91-password-reset-token", {
      status: response.status,
      providerRejected: explicitProviderFailure(payload),
      identifierPresent: Boolean(identifier)
    })
    throw new SmsProviderError(response.status >= 500 ? "SMS_PROVIDER_UNAVAILABLE" : "INVALID_OTP")
  }

  return { identifier }
}
