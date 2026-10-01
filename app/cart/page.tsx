import type { Metadata } from "next"
import { CartCheckout } from "../../features/cart/CartCheckout"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { StorefrontHeader } from "../../features/shell/StorefrontHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { getCatalogConfig } from "../../lib/server/catalog"
import { defaultStoreSettings, getStoreSettings } from "../../lib/server/store-settings"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Your Cart | Celebration", robots: { index: false, follow: false } }

export default async function CartPage() {
  const [catalog, settings] = await Promise.all([getCatalogConfig().catch(() => null), getStoreSettings().catch(() => null)])
  return <main className="cartPage"><TrustStrip /><StorefrontHeader settings={settings?.settings || defaultStoreSettings} /><CartCheckout initialCatalog={catalog?.catalog || null} /><SiteFooter /></main>
}
