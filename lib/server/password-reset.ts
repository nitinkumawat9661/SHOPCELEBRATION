import { createHmac, randomUUID } from "node:crypto"
import { env, requireSecret } from "../../config/env"
import { securityConfig } from "../../config/security"
import { smsConfig, smsReady } from "../../config/sms"
import { validation } from "../../config/validation"
import { isValidCustomerPassword } from "../security/customer-password"
import { signValue, verifySignedValue } from "../security/tokens"
import { customerAccountView, findCustomerAccountByPhone, normalizeCustomerPhone, resetCustomerPassword } from "./customer-accounts"
import { query } from "./db"
import { verifyPasswordResetAccessToken as verifyMsg91AccessToken, SmsProviderError } from "./sms/provider"

export class PasswordResetError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code)
  }
}

type ResetTokenPayload = {
  challengeId: string
  accountId: string
  exp: number
  v: 1
}

function resetSecretReady() {
  return env.passwordResetSecret.length >= securityConfig.minimumSecretLength
}

function challengeProof(challengeId: string, accessToken: string) {
  return createHmac(securityConfig.hashAlgorithm, requireSecret("passwordResetSecret"))
    .update(`msg91-widget:${challengeId}:${accessToken}`)
    .digest("hex")
}

function createResetToken(challengeId: string, accountId: string) {
  const payload: ResetTokenPayload = {
    challengeId,
    accountId,
    exp: Math.floor(Date.now() / 1000) + validation.passwordReset.verificationTtlSeconds,
    v: 1
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return signValue(`reset:${encoded}`, requireSecret("passwordResetSecret"))
}

function parseResetToken(token: unknown): ResetTokenPayload | null {
  if (typeof token !== "string" || token.length < 32 || token.length > 1000) return null
  const verified = verifySignedValue(token, requireSecret("passwordResetSecret"))
  if (!verified?.startsWith("reset:")) return null
  try {
    const payload = JSON.parse(Buffer.from(verified.slice(6), "base64url").toString("utf8")) as ResetTokenPayload
    if (payload.v !== 1 || !payload.challengeId || !payload.accountId || payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export async function requestPasswordReset(phoneInput: unknown) {
  normalizeCustomerPhone(phoneInput)
  if (!smsReady() || !resetSecretReady()) throw new PasswordResetError("SMS_OTP_UNAVAILABLE", 503)

  return {
    ok: true as const,
    widgetId: smsConfig.msg91.widgetId,
    tokenAuth: smsConfig.msg91.widgetToken,
    expiresInSeconds: validation.passwordReset.otpTtlSeconds,
    resendAfterSeconds: validation.passwordReset.resendCooldownSeconds
  }
}

export async function verifyPasswordResetAccessToken(input: { phone?: unknown; accessToken?: unknown }) {
  const phone = normalizeCustomerPhone(input.phone)
  const accessToken = typeof input.accessToken === "string" ? input.accessToken.trim() : ""
  if (!accessToken) throw new PasswordResetError("INVALID_OTP", 401)
  if (!smsReady() || !resetSecretReady()) throw new PasswordResetError("SMS_OTP_UNAVAILABLE", 503)

  let verifiedIdentifier = ""
  try {
    const verified = await verifyMsg91AccessToken(accessToken)
    verifiedIdentifier = normalizeCustomerPhone(verified.identifier)
  } catch (error) {
    if (error instanceof SmsProviderError) {
      throw new PasswordResetError(error.code === "SMS_PROVIDER_UNAVAILABLE" ? "SMS_OTP_UNAVAILABLE" : "INVALID_OTP", error.code === "SMS_PROVIDER_UNAVAILABLE" ? 503 : 401)
    }
    throw error
  }

  if (verifiedIdentifier !== phone) throw new PasswordResetError("INVALID_OTP", 401)

  const account = await findCustomerAccountByPhone(phone)
  if (!account) throw new PasswordResetError("ACCOUNT_NOT_FOUND", 404)

  await query(
    `UPDATE customer_password_reset_challenges
        SET consumed_at = now(), updated_at = now()
      WHERE customer_account_id = $1 AND consumed_at IS NULL`,
    [account.id]
  )

  const challengeId = randomUUID()
  const expiresAt = new Date(Date.now() + validation.passwordReset.verificationTtlSeconds * 1000)
  await query(
    `INSERT INTO customer_password_reset_challenges
      (id, customer_account_id, phone, otp_hash, expires_at, verified_at)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [challengeId, account.id, phone, challengeProof(challengeId, accessToken), expiresAt]
  )

  return { ok: true as const, resetToken: createResetToken(challengeId, account.id) }
}

export async function completePasswordReset(input: { resetToken?: unknown; password?: unknown }) {
  if (!resetSecretReady()) throw new PasswordResetError("SMS_OTP_UNAVAILABLE", 503)
  if (!isValidCustomerPassword(input.password)) throw new PasswordResetError("INVALID_PASSWORD", 422)
  const token = parseResetToken(input.resetToken)
  if (!token) throw new PasswordResetError("RESET_SESSION_EXPIRED", 401)

  const claimed = await query<{ customer_account_id: string }>(
    `UPDATE customer_password_reset_challenges
        SET consumed_at = now(), updated_at = now()
      WHERE id = $1
        AND customer_account_id = $2
        AND verified_at IS NOT NULL
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING customer_account_id`,
    [token.challengeId, token.accountId]
  )
  if (!claimed.rows[0]) throw new PasswordResetError("RESET_SESSION_EXPIRED", 401)

  const account = await resetCustomerPassword(token.accountId, input.password)
  return { ok: true as const, account, accountView: customerAccountView(account) }
}
