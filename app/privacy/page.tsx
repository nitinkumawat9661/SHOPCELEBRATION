import Link from "next/link"
import { routes } from "../../config/routes"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { SiteHeader } from "../../features/shell/SiteHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { storeContent } from "../../lib/domain/content"

export const metadata = {
  title: `Privacy Policy | ${storeContent.brand.name}`,
  description: `How ${storeContent.brand.name} handles customer, delivery, order and payment-related information.`,
  robots: { index: false, follow: false }
}

const sections = [
  {
    title: "Information we collect",
    body: "We collect the information needed to create, fulfil and support your order, such as your name, mobile number, recipient details, delivery address, pincode, occasion, gift message, selected products and order history.",
    bullets: ["Account and contact details", "Recipient and delivery information", "Hamper selections and personalization", "Order, support and issue-report history"]
  },
  {
    title: "Payment information",
    body: "Online payments are processed through the payment provider shown at checkout. Celebration receives payment status, provider order/payment references, amount and related verification metadata needed to match the payment to your order.",
    bullets: ["Celebration does not ask for or store your UPI PIN, card PIN or banking OTP", "Card/UPI credentials are entered in the payment provider experience", "Payment references may be retained for reconciliation, support and dispute handling"]
  },
  {
    title: "How we use your information",
    body: "We use customer information to operate the store and fulfil the service you requested.",
    bullets: ["Create and manage your Celebration account", "Prepare, personalize and deliver your hamper", "Send order, packing and shipping updates", "Verify payments and prevent duplicate or mismatched orders", "Provide support and review eligible issue claims", "Maintain operational, security and business records"]
  },
  {
    title: "When information is shared",
    body: "We share only the information reasonably required for the service with providers involved in payment processing, hosting/storage, communication, shipping or other order operations. Their own privacy and security terms may also apply to information they process directly.",
    bullets: ["Payment processors", "Hosting and infrastructure providers", "Courier or delivery partners", "Communication/support services when used for your order"]
  },
  {
    title: "Retention and security",
    body: "We retain information for as long as reasonably needed for order fulfilment, customer support, payment reconciliation, security, record-keeping and applicable legal or business requirements. We use access controls and technical safeguards appropriate to the systems that store this information.",
    bullets: []
  },
  {
    title: "Your choices",
    body: "You can contact us if you want to ask what account information we hold, request a correction, or raise a privacy concern. Some order/payment records may need to be retained where required for legitimate operational, financial, security or legal reasons.",
    bullets: []
  }
]

export default function PrivacyPage() {
  return (
    <main>
      <TrustStrip />
      <SiteHeader />
      <section>
        <div className="wrap policyWrap">
          <div className="policyHero">
            <div className="kicker">PRIVACY &amp; DATA</div>
            <h1 className="policyTitle">Privacy Policy</h1>
            <p className="policyLead">This page explains what information Celebration uses when you browse, create an account, build a hamper, make a payment or place an order.</p>
            <div className="policySummaryGrid">
              <div><b>Only what we need</b><span>Order and service information is collected for checkout, fulfilment and support.</span></div>
              <div><b>Payment credentials stay with the provider</b><span>Never share your UPI PIN, card PIN or OTP with Celebration.</span></div>
              <div><b>Questions are welcome</b><span>Use our support channel if you need a correction or have a privacy concern.</span></div>
            </div>
            <div className="privacyMeta">Last updated: 26 September 2026</div>
          </div>

          <div className="privacySections">
            {sections.map((section) => <article className="privacySection" key={section.title}><h2>{section.title}</h2><p>{section.body}</p>{section.bullets.length > 0 && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}</article>)}
          </div>

          <div className="policySupport">
            <h2>Privacy or order question?</h2>
            <p>Contact Celebration support and include only the minimum information needed to identify your account or order. Never send banking PINs or OTPs.</p>
            <div className="policySupportActions"><Link className="primary" href={routes.account}>My Celebration</Link><Link className="secondary" href={routes.policies}>Order &amp; Protection Policy</Link></div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
