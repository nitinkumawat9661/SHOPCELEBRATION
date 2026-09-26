"use client"

import { useEffect, useRef, useState } from "react"
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

export type PaymentUiState = "idle" | "processing" | "pending" | "failed" | "paid"

type PaymentCheckout =
  | { provider: "razorpay"; mode: "test" | "live"; providerOrderId: string; keyId: string; amountPaise: number; currency: "INR" }
  | { provider: "cashfree"; mode: "test" | "live"; providerOrderId: string; paymentSessionId: string; amountPaise: number; currency: "INR" }

type PaymentResult = {
  ok?: boolean
  error?: string
  paid?: boolean
  orderId?: string
  trackingToken?: string
  trackingPath?: string
  subtotalPaise?: number
  discountPaise?: number
  payablePaise?: number
  campaignId?: string | null
  campaignTitle?: string | null
  paymentStatus?: string
  status?: string
  checkout?: PaymentCheckout
}

type GatewayWindow = Window & {
  Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  Cashfree?: (options: { mode: "sandbox" | "production" }) => {
    checkout: (options: { paymentSessionId: string; redirectTarget: "_modal" }) => Promise<unknown>
  }
}

function paymentError(code?: string) {
  const known = code ? errorMessages[code] : undefined
  if (known) return known
  if (code === "PAYMENT_GATEWAY_NOT_CONFIGURED") return "Online payment is being configured. Use the UPI option for now."
  if (code === "PAYMENT_SIGNATURE_INVALID") return "We could not verify that payment. Please check the payment status or retry."
  if (code === "PAYMENT_AMOUNT_MISMATCH") return "Payment amount did not match this order. No order processing was started."
  if (code === "PAYMENT_ATTEMPT_INITIALIZING") return "Payment is already opening. Please wait a moment and try again."
  return "Payment could not be completed right now. You can retry safely."
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing?.dataset.loaded === "true") return resolve()
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("PAYMENT_SDK_LOAD_FAILED")), { once: true })
      return
    }
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.dataset.paymentSdk = "true"
    script.addEventListener("load", () => {
      script.dataset.loaded = "true"
      resolve()
    }, { once: true })
    script.addEventListener("error", () => reject(new Error("PAYMENT_SDK_LOAD_FAILED")), { once: true })
    document.head.appendChild(script)
  })
}

function createdFromResult(result: PaymentResult): CreatedOrder | null {
  if (!result.orderId || !result.trackingToken || !result.trackingPath || typeof result.payablePaise !== "number") return null
  return {
    orderId: result.orderId,
    trackingToken: result.trackingToken,
    trackingPath: result.trackingPath,
    subtotalPaise: result.subtotalPaise ?? result.payablePaise,
    discountPaise: result.discountPaise ?? 0,
    payablePaise: result.payablePaise,
    campaignId: result.campaignId || null,
    campaignTitle: result.campaignTitle || null
  }
}

export function useOrderSubmit() {
  const idempotencyKey = useRef(crypto.randomUUID())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [created, setCreated] = useState<CreatedOrder | null>(null)
  const [gatewayLoading, setGatewayLoading] = useState(true)
  const [gatewayEnabled, setGatewayEnabled] = useState(false)
  const [gatewayProvider, setGatewayProvider] = useState<"razorpay" | "cashfree" | null>(null)
  const [paymentState, setPaymentState] = useState<PaymentUiState>("idle")
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch(routes.api.paymentConfig, { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { enabled?: boolean; provider?: "razorpay" | "cashfree" | null }) => {
        if (!active) return
        setGatewayEnabled(Boolean(result.enabled))
        setGatewayProvider(result.provider || null)
      })
      .catch(() => {
        if (active) setGatewayEnabled(false)
      })
      .finally(() => {
        if (active) setGatewayLoading(false)
      })
    return () => { active = false }
  }, [])

  function validateBase(args: SubmitArgs) {
    const detailsError = validateCheckoutDetails(args.checkout)
    if (detailsError) return detailsError
    if (!args.accepted) return errorMessages.MISSING_REQUIRED_FIELDS
    return ""
  }

  function orderPayload(args: SubmitArgs, includePaymentReference: boolean) {
    return {
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
      ...(includePaymentReference ? { paymentReference: args.checkout.paymentReference } : {}),
      policyVersion: orderConfig.policyVersion,
      policyAccepted: args.accepted,
      idempotencyKey: idempotencyKey.current,
      offerQuoteId: args.offerQuoteId || undefined
    }
  }

  async function submit(args: SubmitArgs) {
    setError("")
    setCreated(null)
    setPaymentState("idle")
    setPaymentOrderId(null)

    const detailsError = validateBase(args)
    if (detailsError) {
      setError(detailsError)
      return null
    }
    const referenceError = validatePaymentReference(args.checkout.paymentReference)
    if (referenceError) {
      setError(referenceError)
      return null
    }

    setSubmitting(true)
    try {
      const response = await fetch(routes.api.orders, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload(args, true))
      })
      const result = await response.json() as PaymentResult
      if (!response.ok || !result.ok) throw new Error(errorMessages[result.error || "UNKNOWN"] || errorMessages.UNKNOWN)
      const createdOrder = createdFromResult(result)
      if (!createdOrder) throw new Error(errorMessages.UNKNOWN)
      setCreated(createdOrder)
      return createdOrder
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : errorMessages.UNKNOWN)
      return null
    } finally {
      setSubmitting(false)
    }
  }

  async function verifyPayment(body: Record<string, unknown>) {
    const response = await fetch(routes.api.paymentVerify, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    const result = await response.json() as PaymentResult
    if (!response.ok || !result.ok) throw new Error(paymentError(result.error))
    return result
  }

  async function fetchPaymentStatus(orderId: string) {
    const response = await fetch(`${routes.api.paymentStatus}?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" })
    const result = await response.json() as PaymentResult
    if (!response.ok || !result.ok) return null
    return result
  }

  async function waitForWebhook(orderId: string) {
    let latest: PaymentResult | null = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await fetchPaymentStatus(orderId)
      if (result) latest = result
      if (result?.paid || result?.paymentStatus === "failed") return result
      await new Promise((resolve) => window.setTimeout(resolve, 1200 + attempt * 300))
    }
    return latest
  }

  async function launchRazorpay(checkout: Extract<PaymentCheckout, { provider: "razorpay" }>, args: SubmitArgs, publicOrderId: string) {
    await loadScript("https://checkout.razorpay.com/v1/checkout.js")
    const Razorpay = (window as GatewayWindow).Razorpay
    if (!Razorpay) throw new Error("PAYMENT_SDK_LOAD_FAILED")

    const confirmation = await new Promise<{ razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string } | null>((resolve) => {
      let settled = false
      const finish = (value: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string } | null) => {
        if (settled) return
        settled = true
        resolve(value)
      }
      const instance = new Razorpay({
        key: checkout.keyId,
        amount: checkout.amountPaise,
        currency: checkout.currency,
        name: storeContent.brand.name,
        description: args.tier.name,
        order_id: checkout.providerOrderId,
        prefill: { name: args.checkout.customerName, contact: args.checkout.phone },
        theme: { color: "#661b33" },
        handler: (response: unknown) => finish(response as { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }),
        modal: { ondismiss: () => finish(null) }
      })
      instance.open()
    })

    if (!confirmation) return waitForWebhook(publicOrderId)
    return verifyPayment({
      publicOrderId,
      provider: "razorpay",
      providerOrderId: confirmation.razorpay_order_id,
      providerPaymentId: confirmation.razorpay_payment_id,
      signature: confirmation.razorpay_signature
    })
  }

  async function launchCashfree(checkout: Extract<PaymentCheckout, { provider: "cashfree" }>, publicOrderId: string) {
    await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js")
    const factory = (window as GatewayWindow).Cashfree
    if (!factory) throw new Error("PAYMENT_SDK_LOAD_FAILED")
    const cashfree = factory({ mode: checkout.mode === "live" ? "production" : "sandbox" })
    await cashfree.checkout({ paymentSessionId: checkout.paymentSessionId, redirectTarget: "_modal" })
    const verified = await verifyPayment({
      publicOrderId,
      provider: "cashfree",
      providerOrderId: checkout.providerOrderId
    })
    return verified.paid ? verified : waitForWebhook(publicOrderId)
  }

  function applyUnpaidState(result: PaymentResult | null) {
    if (result?.paymentStatus === "failed") {
      setPaymentState("failed")
      setError("Payment was not completed. Your order is saved; you can try payment again safely.")
      return
    }
    setPaymentState("pending")
    setError("")
  }

  async function pay(args: SubmitArgs) {
    setError("")
    setCreated(null)
    const detailsError = validateBase(args)
    if (detailsError) {
      setError(detailsError)
      return null
    }
    if (!gatewayEnabled) {
      setError("Online payment is not enabled yet. Use the UPI payment option below.")
      return null
    }

    setPaymentState("processing")
    setSubmitting(true)
    try {
      const response = await fetch(routes.api.paymentCreate, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload(args, false))
      })
      const started = await response.json() as PaymentResult
      if (!response.ok || !started.ok) throw new Error(paymentError(started.error))
      if (started.orderId) setPaymentOrderId(started.orderId)
      if (started.paid) {
        const completed = createdFromResult(started)
        if (!completed) throw new Error(paymentError())
        setPaymentState("paid")
        setCreated(completed)
        return completed
      }
      if (!started.orderId || !started.checkout) throw new Error(paymentError())

      const result = started.checkout.provider === "razorpay"
        ? await launchRazorpay(started.checkout, args, started.orderId)
        : await launchCashfree(started.checkout, started.orderId)

      if (!result?.paid) {
        applyUnpaidState(result)
        return null
      }
      const completed = createdFromResult(result)
      if (!completed) throw new Error(paymentError())
      setPaymentState("paid")
      setCreated(completed)
      return completed
    } catch (cause) {
      setPaymentState((current) => current === "processing" ? "idle" : current)
      setError(cause instanceof Error ? cause.message : paymentError())
      return null
    } finally {
      setSubmitting(false)
    }
  }

  async function refreshPayment() {
    if (!paymentOrderId) return null
    setSubmitting(true)
    setError("")
    try {
      const result = await fetchPaymentStatus(paymentOrderId)
      if (!result) {
        setError("We couldn’t refresh the payment status right now. Try again in a moment.")
        return null
      }
      if (result.paid) {
        const completed = createdFromResult(result)
        if (!completed) throw new Error(paymentError())
        setPaymentState("paid")
        setCreated(completed)
        return completed
      }
      applyUnpaidState(result)
      return null
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : paymentError())
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
    setPaymentState("idle")
    setPaymentOrderId(null)
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

  return {
    submitting,
    error,
    created,
    submit,
    pay,
    refreshPayment,
    reset,
    whatsappUrl,
    gatewayLoading,
    gatewayEnabled,
    gatewayProvider,
    paymentState,
    paymentOrderId
  }
}
