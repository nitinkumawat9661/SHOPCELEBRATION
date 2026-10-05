import type { Metadata } from "next"
import Link from "next/link"
import { routes } from "../../config/routes"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { SiteHeader } from "../../features/shell/SiteHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { storeContent } from "../../lib/domain/content"
import { defaultStoreSettings, getStoreSettings, legalProfileReady } from "../../lib/server/store-settings"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: `Terms & Legal Information | ${storeContent.brand.name}`,
  description: `Website, ordering, pricing, consumer grievance and legal information for ${storeContent.brand.name}.`,
  robots: { index: false, follow: false }
}

export default async function TermsPage() {
  const settings = (await getStoreSettings().catch(() => null))?.settings || defaultStoreSettings
  const ready = legalProfileReady(settings)

  return (
    <main>
      <TrustStrip />
      <SiteHeader />
      <section>
        <div className="wrap policyWrap">
          <div className="policyHero">
            <div className="kicker">TERMS &amp; LEGAL</div>
            <h1 className="policyTitle">Clear terms for using Celebration.</h1>
            <p className="policyLead">These terms explain how the website, account, catalog, offers, orders, payments and customer-support process work. They should be read with the Order, Cancellation, Return &amp; Refund Policy and Privacy Policy.</p>
            <div className="privacyMeta">Last updated: 5 October 2026</div>
          </div>

          <div className="privacySections">
            <article className="privacySection"><h2>1. Store and contract</h2><p>Celebration is the trading brand used on this website. An order becomes accepted for fulfilment only after the applicable payment is successfully verified and the order is not rejected or cancelled for a lawful reason such as unavailable stock, an impossible delivery request, suspected fraud or an unlawful customization request. If Celebration cancels an accepted prepaid order, the eligible amount will be refunded to the original payment source wherever reasonably possible.</p></article>
            <article className="privacySection"><h2>2. Product information, images and availability</h2><p>We aim to keep product descriptions, material details, quantities, prices and images accurate. Screen colours, handmade presentation and packaging can vary slightly. A material substitution that changes the character of a custom hamper should not be made without customer confirmation. Nothing in these terms permits a product to be supplied materially different from what was advertised or agreed.</p></article>
            <article className="privacySection"><h2>3. Pricing, offers and taxes</h2><p>The payable amount shown at checkout is the amount charged for that order, subject to server-side price validation. Offers and coupons apply only according to their displayed eligibility and validity. We do not add an undisclosed item to the cart or a hidden mandatory fee at the final payment step. Where a price reduction is advertised, pricing claims must be capable of substantiation and must comply with applicable consumer-protection requirements.</p></article>
            <article className="privacySection"><h2>4. Personalized content</h2><p>If you provide a name, message, photo, artwork or other personalization, you confirm that you are entitled to use it and that it is not unlawful, abusive or infringing. We may refuse unlawful or unsafe content. Minor layout adjustments needed to fit a design may be made without changing the requested meaning.</p></article>
            <article className="privacySection"><h2>5. Accounts and security</h2><p>You are responsible for keeping your login credentials and device secure. Never share your banking OTP, UPI PIN, card PIN or password with anyone claiming to be Celebration. We may invalidate sessions or restrict an account when reasonably necessary to protect customers, payments or the service.</p></article>
            <article className="privacySection"><h2>6. Payments</h2><p>Current online payments are processed through Cashfree Payments. The payment methods actually available to you are shown inside the secure Cashfree checkout and may include UPI, cards or other supported methods. Celebration does not add a separate payment-gateway fee at checkout. Celebration does not run a recurring auto-debit/subscription payment, so there is no recurring payment to cancel. Payment credentials are entered with the provider; Celebration relies on provider-side verification rather than screenshots alone. If a payment is pending after debit, use the saved order/payment-status flow before trying again. Card/network chargeback rights, where applicable, remain subject to your issuing bank, payment network and applicable law. Cashfree customer payment/refund support is available through cashfree.com/support and its published grievance-redressal process.</p></article>
            <article className="privacySection"><h2>7. Delivery and courier</h2><p>Delivery dates are estimates or requested dates unless expressly confirmed as guaranteed. Dispatch and delivery can depend on preparation time, pincode serviceability, recipient availability and courier operations. Customer-provided address or contact errors can cause delay or re-delivery cost. Statutory remedies for defective, deficient, wrong, spurious or materially late supply are not excluded by this clause.</p></article>
            <article className="privacySection"><h2>8. Intellectual property</h2><p>Celebration branding, original site copy, graphics and website design may not be commercially copied or republished without permission, except where applicable law permits. Product names, trademarks or third-party assets remain the property of their respective owners.</p></article>
            <article className="privacySection"><h2>9. Fair-use and consumer rights</h2><p>Nothing here excludes or limits a right that cannot legally be excluded under the Consumer Protection Act, 2019, applicable E-Commerce Rules or other applicable law. If any term conflicts with a mandatory legal right, that mandatory right prevails to the extent of the conflict.</p></article>
            <article className="privacySection"><h2>10. Grievance redressal</h2><p>Consumer complaints should include the Order ID and a concise description of the issue. Celebration aims to acknowledge a consumer grievance within 48 hours and redress it within one month. The Order ID should be used as the primary reference for order-related complaints. From the effective date of any additional statutory requirement, Celebration will follow the applicable complaint-copy, National Consumer Helpline and other grievance obligations.</p></article>
          </div>

          <div className="policyLegalCard">
            <div><span>Website</span><b>shopcelebration.in</b></div>
            <div><span>Customer care</span><b>WhatsApp +{settings.whatsapp}</b></div>
            {settings.supportEmail && <div><span>Customer-care email</span><b>{settings.supportEmail}</b></div>}
            {settings.legalName && <div><span>Legal entity / proprietor</span><b>{settings.legalName}</b></div>}
            {settings.businessAddress && <div className="wide"><span>Principal business address</span><b>{settings.businessAddress}</b></div>}
            {settings.grievanceOfficerName && <div><span>Grievance officer</span><b>{settings.grievanceOfficerName} • {settings.grievanceOfficerDesignation}</b></div>}
            {settings.grievanceEmail && <div><span>Grievance email</span><b>{settings.grievanceEmail}</b></div>}
            {settings.grievancePhone && <div><span>Grievance phone</span><b>+{settings.grievancePhone}</b></div>}
          </div>

          {!ready && <div className="policyNotice"><strong>Business identity details are being finalized before public launch.</strong><span>Customer support remains available through the official Celebration support channel shown above. This notice should be removed by completing the Legal &amp; Grievance profile in Admin before opening the store to the general public.</span></div>}

          <div className="policySupport">
            <h2>Need help or want to raise a grievance?</h2>
            <p>Start with Celebration support and keep your Order ID ready. If a consumer grievance remains unresolved, statutory consumer remedies remain available.</p>
            <div className="policySupportActions"><Link className="primary" href={routes.account}>My Celebration</Link><Link className="secondary" href={routes.policies}>Order &amp; Refund Policy</Link><Link className="secondary" href={routes.privacy}>Privacy Policy</Link><a className="secondary" href="https://consumerhelpline.gov.in/" target="_blank" rel="noreferrer">National Consumer Helpline • 1915</a></div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
