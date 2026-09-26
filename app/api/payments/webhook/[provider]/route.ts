import { NextResponse } from "next/server"
import type { PaymentProviderName } from "../../../../../config/payment-gateway"
import { verifyProviderWebhook } from "../../../../../lib/server/payments/provider"
import { applyProviderPaymentResult } from "../../../../../lib/server/payments/store"

function providerName(value: string): PaymentProviderName | null {
  return value === "razorpay" || value === "cashfree" ? value : null
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    const provider = providerName((await context.params).provider)
    if (!provider) return NextResponse.json({ ok: false, error: "PAYMENT_PROVIDER_INVALID" }, { status: 404 })
    const rawBody = await request.text()
    const result = verifyProviderWebhook(provider, rawBody, request.headers)
    await applyProviderPaymentResult(result)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = error instanceof Error ? error.message : "PAYMENT_WEBHOOK_FAILED"
    console.error("payment-webhook", error)
    const status = code === "PAYMENT_WEBHOOK_SIGNATURE_INVALID" ? 401 : code === "PAYMENT_ATTEMPT_NOT_FOUND" ? 404 : 422
    return NextResponse.json({ ok: false, error: code }, { status })
  }
}
