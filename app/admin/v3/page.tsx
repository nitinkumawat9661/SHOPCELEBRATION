import { AdminDashboardV3 } from "../../../features/admin/v3/AdminDashboardV3"
import { AdminLogin } from "../../../features/admin/AdminLogin"
import { AdminPasskeySetup } from "../../../features/admin/AdminPasskeySetup"
import { getAdminAccessState } from "../../../lib/security/admin-session"
import "../../../styles/admin-v3.css"
import "../../../styles/admin-v3-details.css"
import "../../../styles/admin-v3-inventory.css"
import "../../../styles/admin-v3-hampers.css"
import "../../../styles/admin-v3-offers.css"
import "../../../styles/admin-v3-customers.css"
import "../../../styles/admin-v3-analytics.css"
import "../../../styles/admin-v3-reviews.css"
import "../../../styles/admin-self-build-20261013.css"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin V3 Preview | Celebration", robots: { index: false, follow: false } }

export default async function AdminV3Page() {
  // This route is an opt-in staging UI, not a replacement for /admin.
  // Keep exactly the existing passkey authentication and bootstrap gate.
  const access = await getAdminAccessState()

  if (!access.authenticated) {
    return <main className="cav3-auth"><AdminLogin /></main>
  }

  if (!access.passkeyEnabled) {
    return <main className="cav3-auth"><AdminPasskeySetup /></main>
  }

  return <AdminDashboardV3 />
}
