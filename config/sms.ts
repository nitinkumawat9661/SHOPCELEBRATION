import { env } from "./env"

export type SmsProviderName = "msg91-widget"

const provider = env.smsProvider === "msg91-widget" ? "msg91-widget" : null

export const smsConfig = {
  provider,
  msg91: {
    widgetId: env.msg91WidgetId,
    widgetToken: env.msg91WidgetToken,
    authKey: env.msg91AuthKey
  }
} as const

export function smsReady() {
  return smsConfig.provider === "msg91-widget" && Boolean(
    smsConfig.msg91.widgetId &&
    smsConfig.msg91.widgetToken &&
    smsConfig.msg91.authKey
  )
}
