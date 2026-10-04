import type { Metadata } from "next"
import Link from "next/link"
import { routes } from "../../config/routes"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { SiteHeader } from "../../features/shell/SiteHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { storeContent } from "../../lib/domain/content"
import { defaultStoreSettings, getStoreSettings } from "../../lib/server/store-settings"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: `Privacy & Data Policy | ${storeContent.brand.name}`,
  description: `How ${storeContent.brand.name} collects, uses, shares, secures and retains customer and order data.`,
  robots: { index: false, follow: false }
}

export default async function PrivacyPage() {
  const settings = (await getStoreSettings().catch(() => null))?.settings || defaultStoreSettings

  return (
    <main>
      <TrustStrip />
      <SiteHeader />
      <section>
        <div className="wrap policyWrap">
          <div className="policyHero">
            <div className="kicker">PRIVACY &amp; DATA</div>
            <h1 className="policyTitle">Your data should have a clear purpose.</h1>
            <p className="policyLead">This notice describes the personal data Celebration currently processes to run the store, verify accounts and payments, fulfil orders, provide tracking/support and understand first-party checkout performance.</p>
            <div className="privacyMeta">Last updated: 5 October 2026</div>
            <div className="policySummaryGrid">
              <div><b>No sale of customer data</b><span>Celebration does not sell customer personal data to advertisers or data brokers.</span></div>
              <div><b>Payment secrets stay with the provider</b><span>We do not ask for or store your UPI PIN, card PIN or banking OTP.</span></div>
              <div><b>Marketing is separate</b><span>Order/security messages are operational. Promotional messaging should require a separate lawful basis or opt-in where required.</span></div>
            </div>
          </div>

          <div className="privacySections">
            <article className="privacySection"><h2>1. Data we collect</h2><p>Depending on how you use Celebration, we may process:</p><ul><li>Account/contact data: name, verified mobile number and account-security data.</li><li>Recipient/delivery data: recipient name, address, city, state, pincode and required date.</li><li>Order/customization data: selected products, hamper choices, occasion, gift message, order status, packing approval and issue reports.</li><li>Payment metadata: payment provider, provider order/payment references, amount, payment status and reconciliation metadata. Card/UPI credentials are entered with the payment provider, not stored by Celebration.</li><li>Support and evidence: messages you send to support and reasonable photos/video or other evidence submitted for an order issue.</li><li>First-party usage analytics: a random session identifier, funnel event such as storefront view/checkout/payment start, and optional campaign/tier identifiers. The session identifier is hashed before storage.</li><li>Technical/security data necessarily created by web infrastructure, such as request metadata used for abuse prevention, rate limiting and server security.</li></ul></article>

            <article className="privacySection"><h2>2. Why we use it</h2><ul><li>Create and secure your account and verify your mobile number.</li><li>Calculate prices/offers, create an order and prevent duplicate or mismatched payments.</li><li>Prepare, personalize, pack, ship and track the order.</li><li>Provide customer support, handle cancellations/refunds and review genuine order issues.</li><li>Maintain payment, accounting, fraud-prevention, security and operational records.</li><li>Measure our own checkout funnel and improve the store experience.</li><li>Comply with legal, regulatory, tax, consumer-protection or lawful government requirements.</li></ul></article>

            <article className="privacySection"><h2>3. Local storage and cookies</h2><p>The cart is stored in your browser’s local storage so it can survive page changes. A short-lived first-party session-storage identifier is used for conversion analytics. Logged-in accounts use a secure session cookie configured for server authentication. Disabling browser storage/cookies can affect cart or login functionality. Payment/OTP providers may use their own technologies when their checkout or verification experience is opened.</p></article>

            <article className="privacySection"><h2>4. Service providers and sharing</h2><p>We share only what is reasonably necessary with service providers used to operate the requested service. Current categories include payment processing (Cashfree), SMS/OTP verification (MSG91), hosting/database/storage infrastructure, and courier/delivery providers when an order is shipped. We may also disclose information where required by law, court order or a lawful government request, or where reasonably necessary to prevent fraud or protect rights and safety.</p></article>

            <article className="privacySection"><h2>5. Recipient data supplied by the buyer</h2><p>If you provide another person’s name, mobile number or delivery address for a gift, use that information only where you have a legitimate reason to arrange the delivery. Do not provide unnecessary sensitive information about the recipient.</p></article>

            <article className="privacySection"><h2>6. Security</h2><p>Celebration uses access controls and technical safeguards designed for the sensitivity of the data involved, including protected server-side credentials, secure account sessions, password hashing, payment-provider verification and restricted administrative access. No online system can guarantee absolute security; if we identify a security incident requiring customer or regulatory notification, we will follow applicable law.</p></article>

            <article className="privacySection"><h2>7. Retention</h2><p>We retain data only for as long as reasonably necessary for active accounts, fulfilment, customer support, payment reconciliation, fraud/security controls, accounting/tax records, dispute handling and other legal obligations. Different records can have different retention periods. A deletion request may not require deletion of records that must reasonably be retained for an ongoing order, payment dispute, fraud prevention or legal obligation.</p></article>

            <article className="privacySection"><h2>8. Your requests and choices</h2><p>You may ask Celebration to provide information about your account data, correct inaccurate data, or request deletion/erasure where applicable. You may also raise a privacy grievance. We may verify your identity before acting on an account-data request. Withdrawal of an optional consent does not invalidate processing already lawfully carried out and may not stop processing necessary for an order already requested or for a legal obligation.</p></article>

            <article className="privacySection"><h2>9. Promotional communication</h2><p>Celebration may send transactional/security messages needed for OTP verification, account access, payment, fulfilment, tracking or support. Promotional messages should not be treated as necessary transactional messages; where marketing is introduced, Celebration should provide the required choice/consent and a practical way to opt out.</p></article>

            <article className="privacySection"><h2>10. Children</h2><p>The store is not designed to knowingly create accounts for children who cannot lawfully provide the required data/consent on their own. If Celebration learns that personal data has been collected in circumstances requiring verified parental consent or deletion under applicable law, the account/data will be handled accordingly.</p></article>

            <article className="privacySection"><h2>11. Legal framework and updates</h2><p>Celebration follows applicable Indian privacy and information-security law. India’s Digital Personal Data Protection framework is being brought into force in phases; this notice is written to move toward its clear-notice, purpose-limitation, rights and security principles ahead of the later commencement dates that apply to many core processing obligations. We may update this notice when the service, providers or applicable law changes, and will update the date above for material revisions.</p></article>
          </div>

          <div className="policySupport">
            <h2>Privacy request or grievance?</h2>
            <p>Use the official Celebration support channel and identify the account/order only as much as necessary. Customer support: WhatsApp +{settings.whatsapp}{settings.supportEmail ? ` • ${settings.supportEmail}` : ""}{settings.grievanceEmail ? ` • Privacy/grievance: ${settings.grievanceEmail}` : ""}.</p>
            <div className="policySupportActions"><Link className="primary" href={routes.account}>My Celebration</Link><Link className="secondary" href={routes.terms}>Terms &amp; Legal</Link><Link className="secondary" href={routes.policies}>Order &amp; Refund Policy</Link></div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
