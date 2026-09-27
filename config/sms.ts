import { env } from "./env"

export type SmsProviderName = "msg91"

const provider = env.smsProvider === "msg91" ? "msg91" : null

export const smsConfig = {
  provider,
  msg91: {
    authKey: env.msg91AuthKey,
    templateId: env.msg91TemplateId,
    otpVariable: env.msg91OtpVariable || "OTP"
  }
} as const

export function smsReady() {
  return smsConfig.provider === "msg91" && Boolean(smsConfig.msg91.authKey && smsConfig.msg91.templateId)
}
