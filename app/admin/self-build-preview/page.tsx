import Link from "next/link"
import { AdminLogin } from "../../../features/admin/AdminLogin"
import { SelfBuildDesignPreview } from "../../../features/builder/SelfBuildDesignPreview"
import { isAdminRequest } from "../../../lib/security/admin-session"
import { getSelfBuildVisualData } from "../../../lib/server/self-build-preview"
import { getSelfBuildPublishedCatalog } from "../../../lib/server/self-build-published-tiers"
import "../../../styles/self-build-preview-20261013.css"

export const dynamic = "force-dynamic"
export const metadata = { title: "Self-Build Design Review", robots: { index: false, follow: false } }

export default async function SelfBuildPreviewPage() {
  // No unverified viewer receives preview data or touches the private DB.
  if (!await isAdminRequest()) {
    return <main className="sbPreviewAuth"><div className="wrap adminWrap"><p>Admin access required</p><AdminLogin /></div></main>
  }
  try {
    const [data, catalog] = await Promise.all([getSelfBuildVisualData(),getSelfBuildPublishedCatalog()])
    const tiers=catalog.tiers.map(t=>({
      id:t.id,name:t.name,maxChoices:t.maxChoices,price:t.price
    }))
    return <SelfBuildDesignPreview data={data} tiers={tiers} />
  } catch (error) {
    console.error("self-build-design-preview", error)
    return <main className="sbPreviewPage"><div className="sbPreviewUnavailable"><span>CELEBRATION · DESIGN REVIEW</span><h1>Preview unavailable</h1><p>Self-Build categories could not be loaded. No order or payment was attempted.</p><Link href="/admin">Back to admin</Link></div></main>
  }
}
