"use client"

import Link from "next/link"
import { useWishlist } from "./useWishlist"
import { CatalogCard } from "./CatalogCard"
import type { GiftProduct } from "../../lib/domain/catalog"

export function WishlistCollection({ products, available }: { products: GiftProduct[]; available: boolean }) {
  const { ids, loaded } = useWishlist()
  const availableById = new Map(products.filter((item) => item.active !== false).map((item) => [item.id, item]))
  const saved = ids.flatMap((id) => {
    const product = availableById.get(id)
    return product ? [product] : []
  })

  if (!available) return <div className="collectionEmpty" role="status">
    <h2>Saved pieces are temporarily unavailable.</h2>
    <p>The latest catalogue could not load. Your saved IDs remain on this device.</p>
    <Link href="/wishlist">Try again</Link>
  </div>

  if (!loaded) return <p className="wishlistLoading" role="status">Loading your saved pieces…</p>

  if (!ids.length) return <div className="collectionEmpty" role="status">
    <span className="collectionEmptyMark" aria-hidden="true">♡</span>
    <h2>No saved pieces yet</h2>
    <p>Tap the heart on any product to keep it here for later.</p>
    <Link href="/jewelry?view=all">Explore jewellery</Link>
  </div>

  return <>
    <p className="wishlistSummary" role="status">{saved.length} {saved.length === 1 ? "piece" : "pieces"} saved on this device.</p>
    {saved.length ? <div className="collectionGrid">{saved.map((product) => <CatalogCard key={product.id} product={product} />)}</div> : null}
    {ids.length > saved.length && <p className="wishlistUnavailable">{ids.length - saved.length} previously saved {ids.length - saved.length === 1 ? "piece is" : "pieces are"} no longer listed. Your saved selection is not replaced with another product.</p>}
    {!saved.length && <Link className="wishlistContinue" href="/jewelry?view=all">Explore jewellery →</Link>}
  </>
}
