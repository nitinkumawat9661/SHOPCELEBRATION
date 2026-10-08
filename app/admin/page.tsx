import { AdminDashboard } from "../../features/admin/AdminDashboard"
import { AdminLogin } from "../../features/admin/AdminLogin"
import { AdminPasskeySetup } from "../../features/admin/AdminPasskeySetup"
import { SiteHeader } from "../../features/shell/SiteHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { getAdminAccessState } from "../../lib/security/admin-session"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function AdminPage() {
  const access = await getAdminAccessState()

  if (!access.authenticated) {
    return (
      <main>
        <TrustStrip />
        <SiteHeader showAccount={false} />
        <section><div className="wrap adminWrap"><AdminLogin /></div></section>
      </main>
    )
  }

  if (!access.passkeyEnabled) {
    return (
      <main>
        <TrustStrip />
        <SiteHeader showAccount={false} />
        <section><div className="wrap adminWrap"><AdminPasskeySetup /></div></section>
      </main>
    )
  }

  return (
    <main className="adminAppPage">
      <section className="adminAppSection"><div className="wrap adminWrap"><AdminDashboard /></div></section>
    </main>
  )
}
