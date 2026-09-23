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
          <div className="kicker">{uiContent.footer.policy}</div>
          <h1 className="policyTitle">{storeContent.policy.title}</h1>
          <p className="policyLead">{storeContent.policy.lead}</p>
          <div className="policyCards">
            {storeContent.policy.cards.map((card) => <article key={card.title}><div className="promiseIcon">{card.icon}</div><h2>{card.title}</h2><p>{card.body}</p></article>)}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
