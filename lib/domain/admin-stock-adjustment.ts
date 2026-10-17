/** The only quantity affected is available-to-sell stock, already net of reservations. */
export type AdjustmentMode = "set" | "add" | "remove"

export function nextAvailableStock(previous: number, mode: AdjustmentMode, input: number) {
  if (!Number.isSafeInteger(previous) || previous < 0 || previous > 10000 ||
      !Number.isSafeInteger(input) || input < 0 || input > 10000) {
    throw new Error("INVALID_STOCK_QUANTITY")
  }
  const next = mode === "set" ? input
    : mode === "add" ? previous + input
    : mode === "remove" ? previous - input
    : NaN
  if (!Number.isSafeInteger(next) || next < 0 || next > 10000) {
    throw new Error("STOCK_OUT_OF_RANGE")
  }
  if (next === previous) throw new Error("NO_STOCK_CHANGE")
  return next
}
