import type { Metadata } from "next"
import Link from "next/link"
import { routes } from "../../config/routes"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { SiteHeader } from "../../features/shell/SiteHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { storeContent } from "../../lib/domain/content"

export const metadata: Metadata = {
  title: `Fair Shopping Review | ${storeContent.brand.name}`,
  description: `Celebration's fair-shopping review covering clear choices, pricing and consent.`,
  robots: { index: false, follow: false }
}

const checks = [
  ["False urgency", "No countdown, fake scarcity or unverified stock-pressure message is used to force checkout."],
  ["Basket sneaking", "Products, donations, protection plans or paid add-ons are not auto-added to the cart."],
  ["Confirm shaming", "Declining an offer, coupon or optional action is not framed with guilt or insulting language."],
  ["Forced action", "Mandatory actions are limited to functions reasonably needed for the requested service, security, payment and order fulfilment."],
  ["Subscription trap", "Celebration does not operate a recurring paid subscription flow."],
  ["Interface interference", "Checkout consent is not pre-selected; payment controls and back/remove actions remain visible and understandable."],
  ["Bait and switch", "Checkout uses the latest price and availability and stops payment if something changes."],
  ["Drip pricing", "The payable amount is shown before payment; the current individual-product checkout states that no additional shipping fee is added at checkout."],
  ["Disguised advertisement", "Celebration does not currently mix third-party paid advertisements into product or search results."],
  ["Nagging", "The checkout does not repeatedly pressure a user with refusal pop-ups or repeated hesitation offers."],
  ["Trick wording", "Payment, policy consent, coupon and cancellation/refund wording is intended to state the consequence directly."],
  ["Recurring service billing", "Not applicable: Celebration does not run a recurring paid subscription."],
  ["Malicious software", "Celebration does not distribute software, browser extensions or executable downloads."]
] as const

export default function CompliancePage() {
  return (
    <main>
      <TrustStrip />
      <SiteHeader />
      <section>
        <div className="wrap policyWrap">
          <div className="policyHero">
            <div className="kicker">FAIR SHOPPING</div>
            <h1 className="policyTitle">Fair-shopping review.</h1>
            <p className="policyLead">Celebration reviewed the shopping journey against the 13 dark patterns identified by the Central Consumer Protection Authority, with a focus on clear choices, pricing and consent.</p>
            <div className="privacyMeta">Customer experience review: 5 October 2026 • Scope: shopcelebration.in shopping journey</div>
            <div className="policySummaryGrid">
              <div><b>Explicit consent</b><span>Checkout policy consent is not pre-ticked and payment remains disabled until the customer actively accepts it.</span></div>
              <div><b>No hidden cart additions</b><span>Items enter the cart only after a customer action; no donation, add-on or unrelated service is silently added.</span></div>
              <div><b>Ongoing review</b><span>This self-audit should be repeated after material checkout changes and at least annually.</span></div>
            </div>
          </div>

          <div className="privacySections">
            {checks.map(([title, body]) => <article className="privacySection" key={title}><h2>{title}</h2><p>{body}</p></article>)}
          </div>

          <div className="policyNotice">
            <strong>Result of this internal review</strong>
            <span>No intentional use of the 13 listed dark patterns was identified in the reviewed Celebration shopping journey. This is Celebration’s own review, not a government-issued certification. If a customer spots a misleading or coercive experience, it should be reported through the official support or grievance channel for review.</span>
          </div>

          <div className="policySupport">
            <h2>Consumer protection links</h2>
            <p>Read the rules that govern payment, cancellation/refund, privacy and grievances before ordering.</p>
            <div className="policySupportActions">
              <Link className="primary" href={routes.policies}>Order &amp; Refund Policy</Link>
              <Link className="secondary" href={routes.terms}>Terms &amp; Legal</Link>
              <Link className="secondary" href={routes.privacy}>Privacy Policy</Link>
              <a className="secondary" href="https://consumerhelpline.gov.in/" target="_blank" rel="noreferrer">National Consumer Helpline • 1915</a>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
