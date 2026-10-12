"use client"

import { useState } from "react"
import { useWishlist } from "./useWishlist"

export function WishlistToggle({ productId, productName, compact = false }: {
  productId: string
  productName: string
  compact?: boolean
}) {
  const { ids, loaded, toggle } = useWishlist()
  const [error, setError] = useState(false)
  const saved = ids.includes(productId)
  const description = saved ? `Remove ${productName} from saved pieces` : `Save ${productName} for later`

  return <div className={compact ? "wishlistControl wishlistControl--compact" : "wishlistControl"}>
    <button
      className={`wishlistToggle${saved ? " isSaved" : ""}`}
      type="button"
      disabled={!loaded}
      aria-pressed={saved}
      aria-label={description}
      title={description}
      onClick={() => setError(!toggle(productId))}
    >
      <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
      {!compact && <span>{saved ? "Saved" : "Save for later"}</span>}
    </button>
    {error && <span className="wishlistSaveError" role="status">Couldn’t save. Please allow browser storage.</span>}
  </div>
}
