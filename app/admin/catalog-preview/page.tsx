import { AdminCatalogPreview } from "../../../features/admin/AdminCatalogPreview"
import { AdminLogin } from "../../../features/admin/AdminLogin"
import { isAdminRequest } from "../../../lib/security/admin-session"
import { getCatalogAdminState } from "../../../lib/server/catalog"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function CatalogPreviewPage() {
  if (!await isAdminRequest()) return <main><section><div className="wrap adminWrap"><AdminLogin /></div></section></main>
  const state = await getCatalogAdminState()
  return <AdminCatalogPreview catalog={state.catalog} liveVersion={state.version} isDraft={state.draftExists} />
}
