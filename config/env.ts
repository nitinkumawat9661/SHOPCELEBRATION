import { securityConfig } from "./security"

const read = (key: string) => process.env[key]?.trim() || ""

export const env = {
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: read("DATABASE_URL"),
  databaseSsl: read("DATABASE_SSL_MODE"),
  businessTimezone: read("BUSINESS_TIMEZONE"),
  orderIdPrefix: read("ORDER_ID_PREFIX"),
  trackingSecret: read("TRACKING_TOKEN_SECRET"),
  adminPasswordHash: read("ADMIN_PASSWORD_SCRYPT"),
  adminSessionSecret: read("ADMIN_SESSION_SECRET"),
  adminSessionVersion: read("ADMIN_SESSION_VERSION"),
  issueReportWindowHours: read("ISSUE_REPORT_WINDOW_HOURS"),
  r2AccountId: read("R2_ACCOUNT_ID"),
  r2AccessKeyId: read("R2_ACCESS_KEY_ID"),
  r2SecretAccessKey: read("R2_SECRET_ACCESS_KEY"),
  r2Bucket: read("R2_BUCKET")
} as const

export function requireEnv<K extends keyof typeof env>(key: K) {
  const value = env[key]
  if (!value) throw new Error(`Missing required environment configuration: ${String(key)}`)
  return value
}

export function requirePositiveIntegerEnv<K extends "issueReportWindowHours">(key: K) {
  const raw = requireEnv(key)
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Environment value must be a positive integer: ${String(key)}`)
  }
  return value
}

export function requireSecret<K extends "trackingSecret" | "adminSessionSecret">(key: K) {
  const value = requireEnv(key)
  if (value.length < securityConfig.minimumSecretLength) {
    throw new Error(`Environment secret is too short: ${String(key)}`)
  }
  return value
}
