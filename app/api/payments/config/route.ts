import { NextResponse } from "next/server"
import { paymentGatewayConfig, paymentGatewayReady } from "../../../../config/payment-gateway"

export async function GET() {
  return NextResponse.json({
    ok: true,
    enabled: paymentGatewayReady(),
    provider: paymentGatewayConfig.provider,
    mode: paymentGatewayConfig.mode
  })
}
