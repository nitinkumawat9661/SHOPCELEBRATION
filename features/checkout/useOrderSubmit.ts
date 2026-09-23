"use client"

import { useRef, useState } from "react"
import { orderConfig } from "../../config/order"
import { errorMessages, storeContent, uiContent } from "../../lib/domain/content"
import { formatMoney, type Tier } from "../../lib/domain/catalog"
import { supportWhatsappUrl } from "../../lib/domain/support"
import type { CheckoutData } from "../builder/types"
import { routes } from "../../config/routes"
import { validateCheckoutDetails, validatePaymentReference } from "../builder/validation"

type SubmitArgs = {
  tier: Tier
  selectedProductIds: string[]
  selectedNames: string[]
  checkout: CheckoutData
  accepted: boolean
  offerQuoteId?: string | null
}

export type CreatedOrder = {
  orderId: string
  trackingToken: string
  trackingPath: string
  subtotalPaise: number
  discountPaise: number
  payablePaise: number
  campaignId: string | null
  campaignTitle: string | null
}

export function useOrderSubmit() {
  const idempotencyKey = useRef(crypto.randomUUID())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [created, setCreated] = useState<CreatedOrder | null>(null)

  async function submit(args: SubmitArgs) {
    setError("")
    setCreated(null)

    const detailsError = validateCheckoutDetails(args.checkout)
    if (detailsError) {
      setError(detailsError)
      return null
    }

    const paymentError = validatePaymentReference(args.checkout.paymentReference)
    if (paymentError) {
      setError(paymentError)
      return null
    }

    if (!args.accepted) {
      setError(errorMessages.MISSING_REQUIRED_FIELDS)
      return null
    }

    setSubmitting(true)
    try {
      const response = await fetch(routes.api.orders, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: args.tier.id,
          selectedProductIds: args.selectedProductIds,
          requiredDate: args.checkout.requiredDate,
          customerName: args.checkout.customerName,
          phone: args.checkout.phone,
          receiverName: args.checkout.receiverName,
          address: args.checkout.address,
          city: args.checkout.city,
          state: args.checkout.state,
          pincode: args.checkout.pincode,
          occasion: args.checkout.occasion,
          message: args.checkout.message,
          paymentReference: args.checkout.paymentReference,
          policyVersion: orderConfig.policyVersion,
          policyAccepted: args.accepted,
          idempotencyKey: idempotencyKey.current,
          offerQuoteId: args.offerQuoteId || undefined
        })
      })
      const result = await response.json() as {
        ok?: boolean
        error?: string
        orderId?: string
        trackingToken?: string
        trackingPath?: string
        subtotalPaise?: number
        discountPaise?: number
        payablePaise?: number
        campaignId?: string | null
        campaignTitle?: string | null
      }
      if (!response.ok || !result.ok || !result.orderId || !result.trackingToken || !result.trackingPath || typeof result.payablePaise !== "number") {
        const code = result.error || "UNKNOWN"
        throw new Error(errorMessages[code] || errorMessages.UNKNOWN)
      }
      const createdOrder: CreatedOrder = {
        orderId: result.orderId,
        trackingToken: result.trackingToken,
        trackingPath: result.trackingPath,
        subtotalPaise: result.subtotalPaise ?? result.payablePaise,
        discountPaise: result.discountPaise ?? 0,
        payablePaise: result.payablePaise,
        campaignId: result.campaignId || null,
        campaignTitle: result.campaignTitle || null
      }
      setCreated(createdOrder)
      return createdOrder
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : errorMessages.UNKNOWN)
      return null
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    idempotencyKey.current = crypto.randomUUID()
    setSubmitting(false)
    setError("")
    setCreated(null)
  }

  function whatsappUrl(args: SubmitArgs, createdOrder: CreatedOrder, supportNumber?: string) {
    const labels = uiContent.whatsapp
    const message = [
      `*${storeContent.brand.name} ${labels.titleSuffix}*`,
      `${labels.orderId}: ${createdOrder.orderId}`,
      `${labels.hamper}: ${formatMoney(createdOrder.payablePaise / 100)}${uiContent.common.separator}${args.tier.name}`,
      createdOrder.discountPaise > 0 ? `Offer saved: ${formatMoney(createdOrder.discountPaise / 100)}${createdOrder.campaignTitle ? ` (${createdOrder.campaignTitle})` : ""}` : "",
      `${labels.occasion}: ${args.checkout.occasion}`,
      `${labels.requiredBy}: ${args.checkout.requiredDate}`,
      `${labels.preferences}: ${args.selectedNames.length ? args.selectedNames.join(", ") : labels.curate}`,
      `${labels.customer}: ${args.checkout.customerName}`,
      `${labels.phone}: ${args.checkout.phone}`,
      `${labels.giftFor}: ${args.checkout.receiverName}`,
      `${labels.address}: ${args.checkout.address}, ${args.checkout.city}, ${args.checkout.state} - ${args.checkout.pincode}`,
      `${labels.giftMessage}: ${args.checkout.message || uiContent.common.none}`,
      `${labels.tracking}: ${window.location.origin}${createdOrder.trackingPath}`
    ].filter(Boolean).join("\n")
    return supportWhatsappUrl(message, supportNumber)
  }

  return { submitting, error, created, submit, reset, whatsappUrl }
}
