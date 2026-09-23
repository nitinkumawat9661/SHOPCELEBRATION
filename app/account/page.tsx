import { CustomerAccountPage } from "../../features/account/CustomerAccountPage"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { SiteHeader } from "../../features/shell/SiteHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"

export const dynamic = "force-dynamic"
export const metadata = { title: "My Celebration | Orders & Progress", robots: { index: false, follow: false } }

export default function AccountPage() {
  return (
    <main>
      <TrustStrip />
      <SiteHeader />
      <section className="accountPage"><div className="wrap"><CustomerAccountPage /></div></section>
      <SiteFooter />
    </main>
  )
}
