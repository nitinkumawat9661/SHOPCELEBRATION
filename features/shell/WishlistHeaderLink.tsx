"use client"

import Link from "next/link"
import { useWishlist } from "../catalog/useWishlist"

export function WishlistHeaderLink() {
  const { ids, loaded, mode } = useWishlist()
  // Counts come from the exact same synchronized list as product-card hearts.
  // Do not surface stale counts when the account sync has failed.
  const count = loaded && mode !== "error" ? ids.length : 0

  return <Link
    href="/wishlist"
    prefetch={false}
    className="celebrationIconLink celebrationWishlistHeaderLink"
    aria-label={count > 0 ? `Saved pieces, ${count} items` : "Saved pieces and wishlist"}
    title="Saved pieces"
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      aria-hidden="true" stroke="currentColor" strokeWidth="1.65"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 8.6c0 4.8-8.8 10.5-8.8 10.5S3.2 13.4 3.2 8.6a4.4 4.4 0 0 1 8.8-.2 4.4 4.4 0 0 1 8.8.2Z" />
    </svg>
    {count > 0 && <b className="celebrationWishlistCount" aria-hidden="true">{count > 99 ? "99+" : count}</b>}
    <span>Saved</span>
  </Link>
}
