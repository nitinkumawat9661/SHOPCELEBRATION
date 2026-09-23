import { randomBytes } from "node:crypto"
import { requireEnv } from "../../config/env"
import { localIsoDate } from "../validation/date"

export function createPublicOrderId() {
  const date = localIsoDate(requireEnv("businessTimezone")).replaceAll("-", "").slice(2)
  const suffix = randomBytes(4).toString("hex").toUpperCase()
  return `${requireEnv("orderIdPrefix")}-${date}-${suffix}`
}
