import { validation } from "../../config/validation"
import { storeContent } from "../domain/content"
import { hasUnsafeText, sanitizeText } from "../validation/text"
import { query } from "./db"

export type StoreSettings = {
  whatsapp: string
  assistTitle: string
  assistBody: string
  supportMessage: string
}

type SettingsRow = { payload: StoreSettings; version: number }

export const defaultStoreSettings: StoreSettings = {
  whatsapp: storeContent.support.whatsapp,
  assistTitle: storeContent.support.assistTitle,
  assistBody: storeContent.support.assistBody,
  supportMessage: storeContent.support.supportMessage
}

export class StoreSettingsError extends Error {
  constructor(public readonly code: string) { super(code) }
}

function text(value: unknown, max: number, fallback = "") {
  if (hasUnsafeText(value)) throw new StoreSettingsError("UNSAFE_TEXT")
  return sanitizeText(value, max) || fallback
}

function whatsapp(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "")
  const normalized = digits.length === 10 ? `91${digits}` : digits
  if (!/^\d{11,15}$/.test(normalized)) throw new StoreSettingsError("INVALID_WHATSAPP")
  return normalized
}

export function normalizeStoreSettings(input: unknown): StoreSettings {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  return {
    whatsapp: whatsapp(raw.whatsapp ?? defaultStoreSettings.whatsapp),
    assistTitle: text(raw.assistTitle, validation.storeSettings.shortTextMax, defaultStoreSettings.assistTitle),
    assistBody: text(raw.assistBody, validation.storeSettings.shortTextMax, defaultStoreSettings.assistBody),
    supportMessage: text(raw.supportMessage, validation.storeSettings.messageMax, defaultStoreSettings.supportMessage)
  }
}

export async function getStoreSettings() {
  const result = await query<SettingsRow>(`SELECT payload, version FROM store_settings WHERE id = 'primary'`)
  if (result.rows[0]) return { settings: normalizeStoreSettings(result.rows[0].payload), version: result.rows[0].version }
  const seed = normalizeStoreSettings(defaultStoreSettings)
  const inserted = await query<SettingsRow>(
    `INSERT INTO store_settings (id, payload, version, updated_at)
     VALUES ('primary', $1::jsonb, 1, now())
     ON CONFLICT (id) DO NOTHING
     RETURNING payload, version`,
    [JSON.stringify(seed)]
  )
  if (inserted.rows[0]) return { settings: seed, version: inserted.rows[0].version }
  const concurrent = await query<SettingsRow>(`SELECT payload, version FROM store_settings WHERE id = 'primary'`)
  if (!concurrent.rows[0]) throw new Error("STORE_SETTINGS_SEED_FAILED")
  return { settings: normalizeStoreSettings(concurrent.rows[0].payload), version: concurrent.rows[0].version }
}

export async function saveStoreSettings(input: unknown) {
  const settings = normalizeStoreSettings(input)
  const result = await query<SettingsRow>(
    `INSERT INTO store_settings (id, payload, version, updated_at)
     VALUES ('primary', $1::jsonb, 1, now())
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, version = store_settings.version + 1, updated_at = now()
     RETURNING payload, version`,
    [JSON.stringify(settings)]
  )
  return { settings: normalizeStoreSettings(result.rows[0].payload), version: result.rows[0].version }
}
