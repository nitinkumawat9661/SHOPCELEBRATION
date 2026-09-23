import { AdminDashboard } from "../../features/admin/AdminDashboard"
import { AdminLogin } from "../../features/admin/AdminLogin"
import { SiteHeader } from "../../features/shell/SiteHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { isAdminRequest } from "../../lib/security/admin-session"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function AdminPage() {
  const authenticated = await isAdminRequest()
  return (
    <main>
      <TrustStrip />
      <SiteHeader showAccount={false} />
      <section><div className="wrap adminWrap">{authenticated ? <AdminDashboard /> : <AdminLogin />}</div></section>
    </main>
  )
}
