import { rateLimitIdentity } from "../security/request"
import { query } from "./db"

type RateLimitRule = { windowSeconds: number; max: number }

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
  return result.rows[0]?.count <= max
}

export function consumeRequestRateLimit(scope: string, request: Request, rule: RateLimitRule) {
  return consumeRateLimit(rateLimitIdentity(scope, request), rule.windowSeconds, rule.max)
}
