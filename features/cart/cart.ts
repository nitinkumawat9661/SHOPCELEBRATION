export type CartItem = { productId: string; quantity: number }
export const CART_KEY = "celebration:individual-cart:v1"
export const MAX_CART_ITEMS = 20
export const MAX_CART_QUANTITY = 10

export function parseCart(raw: string | null): CartItem[] {
  if (!raw || raw.length > 8000) return []
  try {
    const value = JSON.parse(raw)
    if (value?.v !== 1 || !Array.isArray(value.items) || value.items.length > MAX_CART_ITEMS) return []
    const ids = new Set<string>()
    const items: CartItem[] = []
    for (const item of value.items) {
      if (typeof item?.productId !== "string" || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(item.productId)
        || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_CART_QUANTITY || ids.has(item.productId)) return []
      ids.add(item.productId)
      items.push({ productId: item.productId, quantity: item.quantity })
    }
    return items
  } catch { return [] }
}

export function cartKey(items: CartItem[]) {
  return JSON.stringify([...items].sort((a, b) => a.productId.localeCompare(b.productId)))
}

export function removePurchasedItems(items: CartItem[], purchased: CartItem[]) {
  return items.flatMap((item) => {
    const quantity = item.quantity - (purchased.find((line) => line.productId === item.productId)?.quantity || 0)
    return quantity > 0 ? [{ ...item, quantity }] : []
  })
}
