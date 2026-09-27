import { smsConfig, smsReady } from "../../../config/sms"

export class SmsProviderError extends Error {
  constructor(public readonly code = "SMS_PROVIDER_UNAVAILABLE") {
    super(code)
  }
}

export async function sendPasswordResetOtp(phone: string, otp: string) {
  if (!smsReady() || smsConfig.provider !== "msg91") throw new SmsProviderError("SMS_OTP_UNAVAILABLE")

  const recipient = `91${phone}`
  const variable = smsConfig.msg91.otpVariable
  const response = await fetch("https://control.msg91.com/api/v5/flow", {
    method: "POST",
    headers: {
      accept: "application/json",
      authkey: smsConfig.msg91.authKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      template_id: smsConfig.msg91.templateId,
      short_url: "0",
      realTimeResponse: "1",
      recipients: [{ mobiles: recipient, [variable]: otp }]
    }),
    cache: "no-store"
  })

  const payload = await response.json().catch(() => null) as { type?: string; message?: unknown } | null
  if (!response.ok || payload?.type === "error") {
    console.error("msg91-password-reset", { status: response.status, message: payload?.message || "unknown" })
    throw new SmsProviderError()
  }
}
