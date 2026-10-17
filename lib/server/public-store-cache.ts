/**
 * Public storefront snapshot cache only. Never cache sessions, customer data,
 * checkout totals, inventory writes, orders, payments, or private photos.
 *
 * Redis is accessed exclusively on the server, bound to loopback by default.
 * No third-party package and no additional network service exposed publicly.
 * Short bounded in-process L1 + Redis L2 reduce repeated public DB reads.
 */
import { createConnection } from "node:net"
import { env } from "../../config/env"

type PublicCacheKey = "catalog" | "store-settings" | "home-category-media"
type Entry = { payload: unknown; expiresAt: number }
const PREFIX = "celebration:public:v2:"
const L1_MAX_MS = 2000
const FAILURE_BACKOFF_MS = 10_000
const SOCKET_TIMEOUT_MS = 250
const MAX_PUBLIC_BYTES = 3 * 1024 * 1024
const l1 = new Map<PublicCacheKey, Entry>()
const pending = new Map<PublicCacheKey, Promise<unknown>>()
let redisUnavailableUntil = 0

function redisTarget() {
  const url = new URL(env.celebrationRedisUrl || "redis://127.0.0.1:6379/0")
  if (url.protocol !== "redis:" || !url.hostname || url.search || url.hash) {
    throw new Error("INVALID_REDIS_URL")
  }
  const port = url.port ? Number(url.port) : 6379
  const database = url.pathname && url.pathname !== "/" ? url.pathname.slice(1) : "0"
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535 ||
      !/^\d{1,2}$/.test(database) || Number(database) > 15) {
    throw new Error("INVALID_REDIS_TARGET")
  }
  return { host: url.hostname, port, database, username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) }
}

function command(args: string[]): Buffer {
  return Buffer.from(`*${args.length}\r\n` +
    args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join(""))
}

/** One short-lived loopback request per L1 miss. Handles fragmented RESP2 replies. */
async function redisCommand(args: string[]): Promise<string | null> {
  // Isolated Admin V3 VPS staging must NEVER touch the production Redis instance,
  // including the implicit 127.0.0.1:6379 fallback when no URL is configured.
  if (process.env.ADMIN_V3_STAGING === "isolated-loopback") return null
  if (Date.now() < redisUnavailableUntil) return null
  try {
    const target = redisTarget()
    const commands = [
      ...(target.password ? [[ "AUTH", ...(target.username ? [target.username] : []), target.password ]] : []),
      ...(target.database !== "0" ? [["SELECT", target.database]] : []),
      args
    ]
    return await new Promise<string | null>((resolve, reject) => {
      const socket = createConnection({ host: target.host, port: target.port })
      let accumulated = Buffer.alloc(0)
      let replyIndex = 0
      let settled = false
      const fail = (error: Error) => {
        if (settled) return
        settled = true
        socket.destroy()
        reject(error)
      }
      const finish = (answer: string | null) => {
        if (settled) return
        settled = true
        socket.destroy()
        resolve(answer)
      }
      socket.setTimeout(SOCKET_TIMEOUT_MS, () => fail(new Error("REDIS_TIMEOUT")))
      socket.once("error", fail)
      socket.once("close", () => { if (!settled) fail(new Error("REDIS_CLOSED")) })
      socket.once("connect", () => socket.write(Buffer.concat(commands.map(command))))
      socket.on("data", (chunk: Buffer) => {
        if (settled) return
        accumulated = Buffer.concat([accumulated, chunk])
        if (accumulated.length > MAX_PUBLIC_BYTES + 8192) return fail(new Error("REDIS_RESPONSE_TOO_LARGE"))
        while (!settled && replyIndex < commands.length) {
          const lineEnd = accumulated.indexOf("\r\n")
          if (lineEnd < 0) return
          const prefix = accumulated[0]
          const line = accumulated.subarray(1, lineEnd).toString()
          let answer: string | null
          let consumed: number
          if (prefix === 36) {
            const size = Number(line)
            if (!Number.isSafeInteger(size) || size < -1 || size > MAX_PUBLIC_BYTES) {
              return fail(new Error("REDIS_BAD_BULK_LENGTH"))
            }
            if (size === -1) { answer = null; consumed = lineEnd + 2 }
            else {
              const start = lineEnd + 2
              if (accumulated.length < start + size + 2) return
              if (accumulated[start + size] !== 13 || accumulated[start + size + 1] !== 10) {
                return fail(new Error("REDIS_BAD_BULK_TERMINATOR"))
              }
              answer = accumulated.subarray(start, start + size).toString()
              consumed = start + size + 2
            }
          } else if (prefix === 43 || prefix === 58) {
            answer = line
            consumed = lineEnd + 2
          } else if (prefix === 45) {
            return fail(new Error("REDIS_COMMAND_FAILED"))
          } else {
            return fail(new Error("REDIS_UNEXPECTED_RESPONSE"))
          }
          accumulated = accumulated.subarray(consumed)
          replyIndex++
          if (replyIndex === commands.length) finish(answer)
          else if (answer !== "OK") fail(new Error("REDIS_AUTH_OR_SELECT_FAILED"))
        }
      })
    })
  } catch {
    // Cache outages must never make checkout or the public storefront fail.
    redisUnavailableUntil = Date.now() + FAILURE_BACKOFF_MS
    return null
  }
}

function remember(key: PublicCacheKey, payload: unknown, ttlSeconds: number) {
  l1.set(key, { payload, expiresAt: Date.now() + Math.min(L1_MAX_MS, ttlSeconds * 1000) })
}

export async function publicSnapshot<T>(
  key: PublicCacheKey, ttlSeconds: number, loader: () => Promise<T>
): Promise<T> {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 300) {
    throw new Error("INVALID_PUBLIC_CACHE_TTL")
  }
  const hot = l1.get(key)
  if (hot && hot.expiresAt > Date.now()) return hot.payload as T
  const running = pending.get(key)
  if (running) return running as Promise<T>
  const promise = (async () => {
    const stored = await redisCommand(["GET", PREFIX + key])
    if (stored !== null) {
      try {
        const data = JSON.parse(stored) as T
        if (data && typeof data === "object") {
          remember(key, data, ttlSeconds)
          return data
        }
      } catch { /* Broken payload: use authoritative database. */ }
    }
    const fresh = await loader()
    // Strict size cap prevents caching unexpected oversized or private payloads.
    const encoded = JSON.stringify(fresh)
    if (encoded && Buffer.byteLength(encoded) <= MAX_PUBLIC_BYTES) {
      remember(key, fresh, ttlSeconds)
      await redisCommand(["SET", PREFIX + key, encoded, "EX", String(ttlSeconds)])
    }
    return fresh
  })()
  pending.set(key, promise)
  try { return await promise }
  finally { if (pending.get(key) === promise) pending.delete(key) }
}

/** Always run after the database transaction has committed successfully. */
export async function invalidatePublicSnapshot(key: PublicCacheKey) {
  l1.delete(key)
  // Any ongoing read can finish and repopulate the cache: the short TTL caps
  // staleness; checkout/inventory validation never relies on this snapshot.
  await redisCommand(["DEL", PREFIX + key])
}
