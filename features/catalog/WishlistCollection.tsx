"use client"

import Link from "next/link"
import { useState } from "react"
import { useWishlist } from "./useWishlist"
import { CatalogCard } from "./CatalogCard"
import type { GiftProduct } from "../../lib/domain/catalog"

export function WishlistCollection({ products, available }: { products: GiftProduct[]; available: boolean }) {
  const { ids, loaded, pending, mode, error, notice, refresh } = useWishlist()
  const [category, setCategory] = useState("")
  // Only display the exact saved, still-active SKU. Never substitute a similar product.
  const availableById = new Map(products.filter(item => item.active !== false).map(item => [item.id, item]))
  const saved = ids.flatMap(id => {
    const product = availableById.get(id)
    return product ? [product] : []
  })
  const categories = [...new Set(saved.map(product => product.category).filter(Boolean))]
  const activeCategory = categories.includes(category) ? category : ""
  const filtered = activeCategory ? saved.filter(product => product.category === activeCategory) : saved
  const missingCount = ids.length - saved.length

  if (!available) return <div className="collectionEmpty" role="status">
    <h2>Saved pieces are temporarily unavailable.</h2>
    <p>The latest catalogue could not load. Please try again.</p>
    <Link href="/wishlist">Try again</Link>
  </div>

  if (!loaded || pending) return <p className="wishlistLoading" role="status">Loading your saved pieces…</p>
  if (mode === "error") return <div className="collectionEmpty" role="alert">
    <h2>Couldn’t load saved pieces</h2>
    <p>{error}</p>
    <button type="button" className="secondary" onClick={() => void refresh()}>Retry sync</button>
  </div>

  return <div className="wishlistShowcase">
    {notice && <p className="wishlistUnavailable" role="status">{notice}</p>}

    <div className="wishlistCollectionPanel">
      <div className="wishlistCollectionTop">
        <div>
          <span className="wishlistEyebrow">YOUR PERSONAL EDIT</span>
          <h1>My saved pieces <span aria-label={`${saved.length} saved pieces`}>{saved.length}</span></h1>
          <p className="wishlistSummary" role="status">{saved.length} {saved.length === 1 ? "piece" : "pieces"} saved {mode === "account" ? "to your account" : "on this device"}.{mode !== "account" && <> <Link href="/account">Sign in to sync across devices</Link></>}</p>
        </div>
        {saved.length > 0 && <Link className="wishlistShopMore" href="/jewelry?view=all">Discover more <span aria-hidden="true">↗</span></Link>}
      </div>

      {!ids.length ? <div className="collectionEmpty wishlistEmpty" role="status">
        <span className="collectionEmptyMark" aria-hidden="true">♡</span>
        <h2>No saved pieces yet</h2>
        <p>Tap the heart on any product to keep it here for later. Your favorites will appear in this space.</p>
        <Link href="/jewelry?view=all">Explore jewellery</Link>
      </div> : <>
        {saved.length > 0 && categories.length > 1 && <div className="wishlistCategoryChips" aria-label="Filter your saved pieces">
          <button type="button" aria-pressed={!activeCategory} onClick={() => setCategory("")}>All saved <span>{saved.length}</span></button>
          {categories.map(item => <button type="button" key={item} aria-pressed={activeCategory === item} onClick={() => setCategory(item)}>
            {item} <span>{saved.filter(product => product.category === item).length}</span>
          </button>)}
        </div>}
        {filtered.length > 0 ? <div className="collectionGrid wishlistProductGrid">{filtered.map(product =>
          <CatalogCard key={product.id} product={product} />
        )}</div> : null}
        {missingCount > 0 && <p className="wishlistUnavailable">{missingCount} previously saved {missingCount === 1 ? "piece is" : "pieces are"} no longer listed. Your saved selection is not replaced with another product.</p>}
        {!saved.length && <Link className="wishlistContinue" href="/jewelry?view=all">Explore jewellery →</Link>}
      </>}
    </div>
    <p className="wishlistPrivacyNote">Made for your moments. Every saved piece stays yours to revisit.</p>
  </div>
}
