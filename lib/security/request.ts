import { createHash } from "node:crypto"
import { isIP } from "node:net"
import { env } from "../../config/env"
import { securityConfig } from "../../config/security"
import { validation } from "../../config/validation"

export class RequestSecurityError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code)
  }
}

function publicRequestOrigin(request: Request) {
  if (env.appBaseUrl) {
    try {
      const configured = new URL(env.appBaseUrl)
      if (configured.protocol !== "http:" && configured.protocol !== "https:") throw new Error("invalid protocol")
      return configured.origin
    } catch {
      throw new RequestSecurityError("INVALID_SERVER_ORIGIN", 500)
    }
  }

  try {
    return new URL(request.url).origin
  } catch {
    throw new RequestSecurityError("INVALID_ORIGIN", 403)
  }
}

export function enforceSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) throw new RequestSecurityError("ORIGIN_REQUIRED", 403)

  let originUrl: URL
  try {
    originUrl = new URL(origin)
  } catch {
    throw new RequestSecurityError("INVALID_ORIGIN", 403)
  }

  if (originUrl.origin !== publicRequestOrigin(request)) throw new RequestSecurityError("CROSS_SITE_REQUEST_BLOCKED", 403)
}

function safeBodyLimit(maxBytes: number) {
  const value = Math.floor(maxBytes)
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("INVALID_REQUEST_BODY_LIMIT")
  return value
}

function assertContentLength(request: Request, maxBytes: number) {
  const header = request.headers.get("content-length")?.trim()
  if (!header) return
  if (!/^\d+$/.test(header)) throw new RequestSecurityError("INVALID_CONTENT_LENGTH", 400)
  const length = Number(header)
  if (!Number.isSafeInteger(length)) throw new RequestSecurityError("INVALID_CONTENT_LENGTH", 400)
  if (length > maxBytes) throw new RequestSecurityError("REQUEST_TOO_LARGE", 413)
}

export async function readTextBody(request: Request, maxBytes: number) {
  const safeMaxBytes = safeBodyLimit(maxBytes)
  assertContentLength(request, safeMaxBytes)
  if (!request.body) return ""

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > safeMaxBytes) {
        await reader.cancel()
        throw new RequestSecurityError("REQUEST_TOO_LARGE", 413)
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return text
  } finally {
    reader.releaseLock()
  }
}

export async function readJsonBody<T>(request: Request, maxBytes = validation.maxRequestBytes): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
  if (contentType !== "application/json") throw new RequestSecurityError("INVALID_CONTENT_TYPE", 415)

  const text = await readTextBody(request, maxBytes)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new RequestSecurityError("INVALID_JSON", 400)
  }
}

function normalizeIp(value: string | null | undefined) {
  const candidate = value?.trim().replace(/^"|"$/g, "") || ""
  if (!candidate) return ""
  const normalized = candidate.startsWith("::ffff:") ? candidate.slice(7) : candidate
  return isIP(normalized) ? normalized : ""
}

export function clientIp(request: Request) {
  const realIp = normalizeIp(request.headers.get("x-real-ip"))
  if (realIp) return realIp

  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    for (const value of forwarded.split(",").reverse()) {
      const ip = normalizeIp(value)
      if (ip) return ip
    }
  }

  return "unknown"
}

export function rateLimitIdentity(scope: string, request: Request) {
  const digest = createHash(securityConfig.hashAlgorithm).update(clientIp(request)).digest("hex")
  return `${scope}:${digest}`
}
