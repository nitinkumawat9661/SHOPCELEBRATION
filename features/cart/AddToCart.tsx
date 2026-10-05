"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { MAX_CART_QUANTITY } from "./cart"
import { useCart } from "./useCart"

export function AddToCart({ productId, buyNow = false }: { productId: string; buyNow?: boolean }) {
  const cart = useCart()
  const router = useRouter()
  const [message, setMessage] = useState("")
  const quantity = cart.items.find((item) => item.productId === productId)?.quantity || 0

  if (buyNow) {
    return (
      <div className="cartAddControl">
        <button className="primary" type="button" onClick={() => {
          const error = quantity > 0 ? "" : cart.add(productId)
          setMessage(error)
          if (!error) router.push("/cart")
        }}>Buy now</button>
        {message && <span className="cartAddFeedback" role="status">{message}</span>}
      </div>
    )
  }

  if (quantity > 0) {
    return (
      <div className="cartAddControl cartAddedState" aria-label="Cart quantity">
        <div className="catalogInlineQuantity">
          <button
            type="button"
            aria-label="Reduce quantity"
            onClick={() => quantity <= 1 ? cart.remove(productId) : cart.quantity(productId, quantity - 1)}
          >−</button>
          <output aria-live="polite" aria-label="Quantity in cart">{quantity}</output>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={quantity >= MAX_CART_QUANTITY}
            onClick={() => {
              const error = cart.add(productId)
              setMessage(error)
            }}
          >+</button>
        </div>
        <span className="cartAddedLabel">✓ Added to cart <Link href="/cart">View cart</Link></span>
        {message && <span className="cartAddFeedback" role="status">{message}</span>}
      </div>
    )
  }

  return (
    <div className="cartAddControl">
      <button className="secondary" type="button" onClick={() => {
        const error = cart.add(productId)
        setMessage(error || "")
      }}>Add to cart</button>
      {message && <span className="cartAddFeedback" role="status">{message}</span>}
    </div>
  )
}

export function CartLink() {
  const cart = useCart()
  return <Link className="celebrationIconLink celebrationCartLink" href="/cart" prefetch={false} aria-label={`Shopping cart, ${cart.count} items`}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3h2l2.5 12h11l2-8H6M8 20h.01M18 20h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><circle cx="8" cy="20" r="1" fill="currentColor" /><circle cx="18" cy="20" r="1" fill="currentColor" /></svg>
    {cart.count > 0 && <b className="cartCount">{cart.count}</b>}<span>My cart</span>
  </Link>
}
