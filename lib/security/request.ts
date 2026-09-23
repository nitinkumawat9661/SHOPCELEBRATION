import { createHash } from "node:crypto"
import { securityConfig } from "../../config/security"
import { validation } from "../../config/validation"

export class RequestSecurityError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code)
  }
}

function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || ""
}

function publicRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url)
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"))
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"))
  const host = forwardedHost || firstForwardedValue(request.headers.get("host"))
  const protocol = forwardedProto || requestUrl.protocol.replace(":", "")

  if (protocol !== "http" && protocol !== "https") throw new RequestSecurityError("INVALID_ORIGIN", 403)
  if (!host) return requestUrl.origin

  try {
    return new URL(`${protocol}://${host}`).origin
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

export async function readJsonBody<T>(request: Request, maxBytes = validation.maxRequestBytes): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
  if (contentType !== "application/json") throw new RequestSecurityError("INVALID_CONTENT_TYPE", 415)

  const safeMaxBytes = Math.max(1, Math.floor(maxBytes))
  const length = Number(request.headers.get("content-length") || "0")
  if (Number.isFinite(length) && length > safeMaxBytes) throw new RequestSecurityError("REQUEST_TOO_LARGE", 413)

  const text = await request.text()
  if (Buffer.byteLength(text, "utf8") > safeMaxBytes) throw new RequestSecurityError("REQUEST_TOO_LARGE", 413)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new RequestSecurityError("INVALID_JSON", 400)
  }
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown"
}

export function rateLimitIdentity(scope: string, request: Request) {
  const digest = createHash(securityConfig.hashAlgorithm).update(clientIp(request)).digest("hex")
  return `${scope}:${digest}`
}
