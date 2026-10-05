import { PaymentReturnStatus } from "../../../features/checkout/PaymentReturnStatus"
import { SiteFooter } from "../../../features/shell/SiteFooter"
import { SiteHeader } from "../../../features/shell/SiteHeader"
import { TrustStrip } from "../../../features/shell/TrustStrip"

export const dynamic = "force-dynamic"
export const metadata = { title: "Payment status | Celebration", robots: { index: false, follow: false } }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function PaymentReturnPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const raw = params.payment ?? params.provider_order_id
  const providerOrderId = Array.isArray(raw) ? raw[0] || "" : raw || ""
  const rawOrderId = params.order_id
  const publicOrderId = Array.isArray(rawOrderId) ? rawOrderId[0] || "" : rawOrderId || ""

  return (
    <main>
      <TrustStrip />
      <SiteHeader />
      <section className="paymentReturnPage">
        <div className="wrap paymentReturnWrap">
          <PaymentReturnStatus providerOrderId={providerOrderId} publicOrderId={publicOrderId} />
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
