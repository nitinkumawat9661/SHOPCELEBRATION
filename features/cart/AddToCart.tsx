"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useCart } from "./useCart"

export function AddToCart({ productId, buyNow = false }: { productId: string; buyNow?: boolean }) {
  const cart = useCart()
  const router = useRouter()
  const [message, setMessage] = useState("")
  return <div className="cartAddControl">
    <button className={buyNow ? "primary" : "secondary"} type="button" onClick={() => {
      const error = cart.add(productId)
      setMessage(error || "Added to your cart.")
      if (!error && buyNow) router.push("/cart")
    }}>{buyNow ? "Buy now" : "Add to cart"}</button>
    <span className="cartAddFeedback" role="status">{message}{message === "Added to your cart." && <> <Link href="/cart">View cart</Link></>}</span>
  </div>
}

export function CartLink() {
  const cart = useCart()
  return <Link className="celebrationIconLink celebrationCartLink" href="/cart" prefetch={false} aria-label={`Shopping cart, ${cart.count} items`}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3h2l2.5 12h11l2-8H6M8 20h.01M18 20h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><circle cx="8" cy="20" r="1" fill="currentColor" /><circle cx="18" cy="20" r="1" fill="currentColor" /></svg>
    {cart.count > 0 && <b className="cartCount">{cart.count}</b>}<span>My cart</span>
  </Link>
}
