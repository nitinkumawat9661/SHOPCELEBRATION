"use client"

import { useEffect, useRef } from "react"
import { trackGa4ViewItem } from "./ga4"

export function ProductViewAnalytics({ productId, name, category, pricePaise }: {
  productId: string
  name: string
  category: string
  pricePaise: number
}) {
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    trackGa4ViewItem({
      item_id: productId,
      item_name: name,
      item_category: category,
      price: pricePaise / 100,
      quantity: 1
    })
  }, [productId, name, category, pricePaise])

  return null
}
