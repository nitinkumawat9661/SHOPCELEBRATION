import { rateLimitIdentity } from "../security/request"
import { query } from "./db"

type RateLimitRule = { windowSeconds: number; max: number }

const RATE_LIMIT_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000
let lastRateLimitCleanupAt = 0

async function maybeCleanupRateLimits() {
  const now = Date.now()
  if (now - lastRateLimitCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS) return
  lastRateLimitCleanupAt = now
  try {
    await query(`DELETE FROM rate_limits WHERE window_start < now() - interval '7 days'`)
  } catch (error) {
    lastRateLimitCleanupAt = 0
    console.error("rate-limit-cleanup", error)
  }
}

export async function consumeRateLimit(key: string, windowSeconds: number, max: number) {
  const result = await query<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count)
     VALUES ($1, date_trunc('second', now()), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE
         WHEN rate_limits.window_start < now() - ($2::int * interval '1 second') THEN 1
         ELSE rate_limits.count + 1
       END,
       window_start = CASE
         WHEN rate_limits.window_start < now() - ($2::int * interval '1 second') THEN now()
         ELSE rate_limits.window_start
       END
     RETURNING count`,
    [key, windowSeconds]
  )
  await maybeCleanupRateLimits()
  return result.rows[0]?.count <= max
}

export function consumeRequestRateLimit(scope: string, request: Request, rule: RateLimitRule) {
  return consumeRateLimit(rateLimitIdentity(scope, request), rule.windowSeconds, rule.max)
}
