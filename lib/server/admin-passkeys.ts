import { randomBytes } from "node:crypto"
import { query, transaction } from "./db"

export type AdminPasskeyRow = {
  credential_id: string
  user_handle: string
  public_key_jwk: Record<string, unknown>
  sign_count: string | number
  transports: string[]
  backup_eligible: boolean
  backup_state: boolean
}

export async function adminPasskeyExists() {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM admin_passkeys WHERE revoked_at IS NULL) AS exists`
  )
  return Boolean(result.rows[0]?.exists)
}

export async function adminPasskeyCount() {
  const result = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM admin_passkeys WHERE revoked_at IS NULL`
  )
  return Number(result.rows[0]?.count || 0)
}

export function getOrCreateAdminUserHandle() {
  return transaction(async (client) => {
    const current = await client.query<{ user_handle: string }>(
      `SELECT user_handle FROM admin_passkey_settings WHERE id = 1 FOR UPDATE`
    )
    if (current.rows[0]?.user_handle) return current.rows[0].user_handle
    const handle = randomBytes(32).toString("base64url")
    const inserted = await client.query<{ user_handle: string }>(
      `INSERT INTO admin_passkey_settings (id, user_handle)
       VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET user_handle = admin_passkey_settings.user_handle
       RETURNING user_handle`,
      [handle]
    )
    return inserted.rows[0].user_handle
  })
}

export async function listAdminCredentialDescriptors() {
  const result = await query<{ credential_id: string; transports: string[] }>(
    `SELECT credential_id, transports
       FROM admin_passkeys
      WHERE revoked_at IS NULL
      ORDER BY created_at ASC`
  )
  return result.rows.map((row) => ({
    id: row.credential_id,
    transports: Array.isArray(row.transports) ? row.transports : []
  }))
}

export async function saveAdminPasskey(input: {
  credentialId: string
  userHandle: string
  publicKeyJwk: Record<string, unknown>
  signCount: number
  transports: string[]
  backupEligible: boolean
  backupState: boolean
}) {
  await query(
    `INSERT INTO admin_passkeys (
       credential_id, user_handle, public_key_jwk, sign_count, transports,
       backup_eligible, backup_state, last_used_at
     ) VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,now())
     ON CONFLICT (credential_id) DO NOTHING`,
    [
      input.credentialId,
      input.userHandle,
      JSON.stringify(input.publicKeyJwk),
      input.signCount,
      input.transports,
      input.backupEligible,
      input.backupState
    ]
  )
}

export async function findAdminPasskey(credentialId: string) {
  const result = await query<AdminPasskeyRow>(
    `SELECT credential_id, user_handle, public_key_jwk, sign_count, transports,
            backup_eligible, backup_state
       FROM admin_passkeys
      WHERE credential_id = $1 AND revoked_at IS NULL
      LIMIT 1`,
    [credentialId]
  )
  return result.rows[0] || null
}

export async function updateAdminPasskeyUsage(input: {
  credentialId: string
  signCount: number
  backupState: boolean
}) {
  await query(
    `UPDATE admin_passkeys
        SET sign_count = $1,
            backup_state = $2,
            last_used_at = now()
      WHERE credential_id = $3 AND revoked_at IS NULL`,
    [input.signCount, input.backupState, input.credentialId]
  )
}
