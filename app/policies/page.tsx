import Link from "next/link"
import { routes } from "../../config/routes"
import { storeContent, uiContent } from "../../lib/domain/content"
import { SiteHeader } from "../../features/shell/SiteHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { SiteFooter } from "../../features/shell/SiteFooter"

export const metadata = {
  title: `Order & Protection Policy | ${storeContent.brand.name}`,
  description: `${storeContent.brand.name} prepaid order, customization, packing-video and issue-protection policy.`,
  robots: { index: false, follow: false }
}

export default function PoliciesPage() {
  return (
    <main>
      <TrustStrip />
      <SiteHeader />
      <section>
        <div className="wrap policyWrap">
          <div className="policyHero">
            <div className="kicker">{uiContent.footer.policy}</div>
            <h1 className="policyTitle">{storeContent.policy.title}</h1>
            <p className="policyLead">{storeContent.policy.lead}</p>
            <div className="policySummaryGrid">
              <div><b>Prepaid checkout</b><span>Order processing starts only after payment is verified.</span></div>
              <div><b>Customization is confirmed</b><span>Major stock or presentation substitutions are confirmed before we make them.</span></div>
              <div><b>Issue protection</b><span>Verified wrong, damaged, defective or missing-item issues can be reviewed for an eligible resolution.</span></div>
            </div>
          </div>

          <div className="policyCards">
            {storeContent.policy.cards.map((card) => <article key={card.title}><div className="promiseIcon">{card.icon}</div><h2>{card.title}</h2><p>{card.body}</p></article>)}
          </div>

          <div className="policyNotice"><strong>Important before paying</strong><span>Do not share card PINs, UPI PINs or banking OTPs with Celebration. If a payment is pending and money has been debited, check the payment status before attempting another payment.</span></div>

          <div className="policySupport">
            <h2>Need help before or after ordering?</h2>
            <p>Your order ID is the safest reference for support. Keep payment and order communication inside the official Celebration checkout/account flow wherever possible.</p>
            <div className="policySupportActions"><Link className="primary" href={routes.account}>My Celebration</Link><Link className="secondary" href={routes.privacy}>Privacy Policy</Link><Link className="secondary" href={routes.home}>Back to store</Link></div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
