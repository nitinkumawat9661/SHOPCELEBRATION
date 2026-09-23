import { errorCode, type ErrorCode } from "../domain/errors"

export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
  }
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const result = await response.json().catch(() => ({})) as T & { ok?: boolean; error?: string }
  if (!response.ok || result.ok === false) {
    throw new ApiError(result.error || errorCode.unknown, response.status)
  }
  return result
}

export function postJson<T>(url: string, body: unknown) {
  return requestJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
}

export function errorMessageFor(code: string, messages: Record<string, string>) {
  return messages[code as ErrorCode] || messages[errorCode.unknown] || code
}
