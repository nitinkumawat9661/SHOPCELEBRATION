const CONTROL_OR_MARKUP = /[<>\u0000-\u001F\u007F]/g
const UNSAFE_MARKUP = /[<>\u0000-\u001F\u007F]/

export function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return ""
  return value.normalize("NFKC").replace(CONTROL_OR_MARKUP, "").trim().slice(0, maxLength)
}

export function hasUnsafeText(value: unknown) {
  return typeof value === "string" && UNSAFE_MARKUP.test(value)
}

export function digitsOnly(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : ""
}
