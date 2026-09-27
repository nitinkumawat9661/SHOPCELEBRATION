import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto"
import { env, requireSecret } from "../../config/env"
import { securityConfig } from "../../config/security"
import { smsReady } from "../../config/sms"
import { validation } from "../../config/validation"
import { isValidCustomerPassword } from "../security/customer-password"
import { signValue, verifySignedValue } from "../security/tokens"
import { customerAccountView, findCustomerAccountByPhone, normalizeCustomerPhone, resetCustomerPassword } from "./customer-accounts"
import { query } from "./db"
import { sendPasswordResetOtp, SmsProviderError } from "./sms/provider"

export class PasswordResetError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code)
  }
}

type ChallengeRow = {
  id: string
  customer_account_id: string
  phone: string
  otp_hash: string
  expires_at: Date
  verified_at: Date | null
  consumed_at: Date | null
  attempts: number
  created_at: Date
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

function otpHash(challengeId: string, otp: string) {
  return createHmac(securityConfig.hashAlgorithm, requireSecret("passwordResetSecret"))
    .update(`password-reset:${challengeId}:${otp}`)
    .digest("hex")
}

function equalHex(a: string, b: string) {
  const left = Buffer.from(a, "hex")
  const right = Buffer.from(b, "hex")
  return left.length === right.length && timingSafeEqual(left, right)
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
  const phone = normalizeCustomerPhone(phoneInput)
  if (!smsReady() || !resetSecretReady()) throw new PasswordResetError("SMS_OTP_UNAVAILABLE", 503)

  const account = await findCustomerAccountByPhone(phone)
  const generic = {
    ok: true as const,
    requestId: randomUUID(),
    expiresInSeconds: validation.passwordReset.otpTtlSeconds,
    resendAfterSeconds: validation.passwordReset.resendCooldownSeconds
  }

  if (!account) return generic

  const latest = await query<{ id: string; created_at: Date }>(
    `SELECT id, created_at FROM customer_password_reset_challenges
      WHERE customer_account_id = $1 AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [account.id]
  )
  const latestChallenge = latest.rows[0]
  const lastCreated = latestChallenge?.created_at?.getTime() || 0
  const cooldownMs = validation.passwordReset.resendCooldownSeconds * 1000
  if (latestChallenge && lastCreated && Date.now() - lastCreated < cooldownMs) {
    return {
      ...generic,
      requestId: latestChallenge.id,
      resendAfterSeconds: Math.ceil((cooldownMs - (Date.now() - lastCreated)) / 1000)
    }
  }

  await query(
    `UPDATE customer_password_reset_challenges
        SET consumed_at = now(), updated_at = now()
      WHERE customer_account_id = $1 AND consumed_at IS NULL`,
    [account.id]
  )

  const otp = String(randomInt(10 ** (validation.passwordReset.otpDigits - 1), 10 ** validation.passwordReset.otpDigits))
  const challengeId = randomUUID()
  const expiresAt = new Date(Date.now() + validation.passwordReset.otpTtlSeconds * 1000)
  await query(
    `INSERT INTO customer_password_reset_challenges
      (id, customer_account_id, phone, otp_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [challengeId, account.id, phone, otpHash(challengeId, otp), expiresAt]
  )

  try {
    await sendPasswordResetOtp(phone, otp)
  } catch (error) {
    await query(`DELETE FROM customer_password_reset_challenges WHERE id = $1`, [challengeId]).catch(() => undefined)
    if (error instanceof SmsProviderError) throw new PasswordResetError(error.code, 503)
    throw error
  }

  return { ...generic, requestId: challengeId }
}

export async function verifyPasswordResetOtp(input: { phone?: unknown; requestId?: unknown; otp?: unknown }) {
  const phone = normalizeCustomerPhone(input.phone)
  const requestId = typeof input.requestId === "string" ? input.requestId.trim() : ""
  const otp = typeof input.otp === "string" ? input.otp.trim() : ""
  if (!requestId || !new RegExp(`^\\d{${validation.passwordReset.otpDigits}}$`).test(otp)) {
    throw new PasswordResetError("INVALID_OTP", 401)
  }

  const result = await query<ChallengeRow>(
    `SELECT id, customer_account_id, phone, otp_hash, expires_at, verified_at, consumed_at, attempts, created_at
       FROM customer_password_reset_challenges
      WHERE id = $1 AND phone = $2 LIMIT 1`,
    [requestId, phone]
  )
  const challenge = result.rows[0]
  if (!challenge || challenge.consumed_at || challenge.expires_at.getTime() <= Date.now() || challenge.attempts >= validation.passwordReset.maxOtpAttempts) {
    throw new PasswordResetError("INVALID_OTP", 401)
  }

  await query(
    `UPDATE customer_password_reset_challenges SET attempts = attempts + 1, updated_at = now() WHERE id = $1`,
    [challenge.id]
  )

  if (!equalHex(challenge.otp_hash, otpHash(challenge.id, otp))) throw new PasswordResetError("INVALID_OTP", 401)

  await query(
    `UPDATE customer_password_reset_challenges SET verified_at = now(), updated_at = now() WHERE id = $1`,
    [challenge.id]
  )

  return { ok: true as const, resetToken: createResetToken(challenge.id, challenge.customer_account_id) }
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
