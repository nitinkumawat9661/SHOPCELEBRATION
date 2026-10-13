import { SiteHeader } from "../../features/shell/SiteHeader"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { NotificationCenter } from "../../features/account/NotificationCenter"

export const dynamic = "force-dynamic"
export const metadata = { title: "Notifications & Messages | Celebration", robots: { index: false, follow: false } }

export default function NotificationsPage() {
  return <main>
    <TrustStrip />
    <SiteHeader />
    <section className="celebrationNotificationsPage"><div className="wrap">
      <NotificationCenter />
    </div></section>
    <SiteFooter />
  </main>
}
