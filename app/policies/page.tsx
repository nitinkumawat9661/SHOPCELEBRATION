import type { Metadata } from "next"
import Link from "next/link"
import { routes } from "../../config/routes"
import { storeContent } from "../../lib/domain/content"
import { SiteHeader } from "../../features/shell/SiteHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { defaultStoreSettings, getStoreSettings } from "../../lib/server/store-settings"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: `Order, Cancellation, Return & Refund Policy | ${storeContent.brand.name}`,
  description: `${storeContent.brand.name} payment, cancellation, return, refund, delivery and issue-protection policy.`,
  robots: { index: false, follow: false }
}

export default async function PoliciesPage() {
  const settings = (await getStoreSettings().catch(() => null))?.settings || defaultStoreSettings

  return (
    <main>
      <TrustStrip />
      <SiteHeader />
      <section>
        <div className="wrap policyWrap">
          <div className="policyHero">
            <div className="kicker">ORDER, CANCELLATION, RETURN &amp; REFUND</div>
            <h1 className="policyTitle">Clear protection from payment to delivery.</h1>
            <p className="policyLead">This policy explains when an order can be changed or cancelled, when a return/refund/replacement is available, how delivery works and what evidence may be needed for a genuine issue.</p>
            <div className="privacyMeta">Policy version: 5 October 2026</div>
            <div className="policySummaryGrid">
              <div><b>Prepaid &amp; verified</b><span>Processing starts only after the payment provider or approved payment flow confirms the payment.</span></div>
              <div><b>No hidden cancellation fee</b><span>Celebration does not impose a separate cancellation charge merely because you request a cancellation.</span></div>
              <div><b>Statutory rights preserved</b><span>Wrong, damaged, defective, spurious, materially different or legally remediable late-delivery issues are not excluded by this policy.</span></div>
            </div>
          </div>

          <div className="privacySections">
            <article className="privacySection"><h2>1. Payment and order confirmation</h2><p>Orders are prepaid. An automated gateway payment is treated as confirmed only after provider-side verification. A pending payment is not a failed payment; if money has been debited, check the saved order/payment status before paying again. The final payable amount, products and eligible offer are revalidated before payment.</p></article>

            <article className="privacySection"><h2>2. Cancellation before dispatch</h2><p>Contact Celebration as early as possible with your Order ID. Standard, non-personalized items may be cancelled while the order has not entered an irreversible fulfilment stage or dispatch. Personalized/custom hampers may become non-cancellable once preparation or personalization has materially begun. Celebration does not impose a separate cancellation fee merely for cancelling; where a cancellation is accepted, the eligible prepaid amount is refunded according to the refund section below. If Celebration cancels an order, the eligible prepaid amount will be refunded.</p></article>

            <article className="privacySection"><h2>3. Change-of-mind returns</h2><p>Personalized, customized or made-to-instruction products are generally not eligible for a change-of-mind return after they have been prepared to the customer’s specification. For standard individual products, a change-of-mind return is available only where the product page or Celebration support expressly confirms it before purchase; if such a voluntary return is offered, any customer-paid return-shipping condition must be disclosed before the return is accepted. This restriction does not affect remedies for a wrong, damaged, defective, deficient, spurious or materially misdescribed product, or any other right that cannot legally be excluded.</p></article>

            <article className="privacySection"><h2>4. Wrong, damaged, defective or missing items</h2><p>Use the issue-report option in your order tracking within the reporting deadline shown there, and as soon as reasonably possible after delivery. Keep the product, outer packaging and shipping label until the issue is reviewed. We may reasonably request clear photos/video of the item and packaging to verify transit damage, wrong supply, defect or a missing component. Once verified, an appropriate remedy may include replacement, re-delivery, repair where suitable, partial refund or full refund depending on the issue and applicable law. If Celebration requires an approved defective/wrong item to be returned, Celebration will arrange or bear the reasonable return-shipping cost. The operational reporting deadline does not waive a statutory right that cannot legally be excluded.</p></article>

            <article className="privacySection"><h2>5. Packing video and approval</h2><p>For orders where a packing video is provided, it is an additional transparency step before dispatch. Customer approval confirms the visible packing/presentation at that stage; it does not waive non-excludable rights relating to latent defects, courier damage, wrong/missing items or other legally protected issues that could not reasonably be identified from the video.</p></article>

            <article className="privacySection"><h2>6. Product substitutions</h2><p>If a major product, size, material or presentation element becomes unavailable, Celebration will seek confirmation before making a material substitution. Minor presentation differences that do not materially change the agreed product may occur. If a material substitute is not acceptable and fulfilment cannot continue as agreed, an eligible cancellation/refund will be offered before dispatch.</p></article>

            <article className="privacySection"><h2>7. Delivery, address and recipient availability</h2><p>The “needed by” date is a requested delivery date unless Celebration expressly confirms otherwise. Courier serviceability, weather, public disruption, recipient availability and other events outside reasonable control can affect timing. Customers should provide a complete address, pincode and reachable phone number. If goods are delivered late from a stated delivery schedule, eligible take-back/refund or other consumer remedies remain available, except where applicable law provides an exception such as force majeure.</p></article>

            <article className="privacySection"><h2>8. Refund method and timeline</h2><p>Accepted refunds are normally initiated to the original payment method without unreasonable delay, generally within 2 business days after approval. After a Cashfree refund is initiated, banks/payment networks commonly take about 5–7 business days to reflect the credit; actual bank timelines can vary. Failed gateway transactions may be automatically reversed by the payment provider. Celebration will not ask for a UPI PIN, card PIN or banking OTP to process a refund.</p></article>

            <article className="privacySection"><h2>9. Discounts and refund amount</h2><p>A refund is based on the amount actually paid for the affected order/item after applicable discounts, not an undiscounted reference price. If only part of an order is affected, a proportionate remedy may be appropriate. Nothing here permits Celebration to retain an amount that applicable law requires to be refunded.</p></article>

            <article className="privacySection"><h2>10. Consumer grievance process</h2><p>Raise the complaint through the official support channel and include your Order ID. Celebration aims to acknowledge a consumer grievance within 48 hours and redress it within one month. Keep communications and evidence linked to the same Order ID. You may also use applicable consumer-redressal mechanisms if the matter is not resolved.</p></article>
          </div>

          <div className="policyNotice"><strong>Important before paying</strong><span>Never share a UPI PIN, card PIN, banking OTP or password with Celebration. If a payment is pending and money was debited, check the order/payment status before retrying.</span></div>

          <div className="policySupport">
            <h2>Need cancellation, refund or issue help?</h2>
            <p>Use your Order ID when contacting support. Official customer support: WhatsApp +{settings.whatsapp}{settings.supportEmail ? ` • ${settings.supportEmail}` : ""}.</p>
            <div className="policySupportActions"><Link className="primary" href={routes.account}>My Celebration</Link><Link className="secondary" href={routes.terms}>Terms &amp; Legal</Link><Link className="secondary" href={routes.privacy}>Privacy Policy</Link></div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
