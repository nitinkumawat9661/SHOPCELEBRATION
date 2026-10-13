import Link from "next/link"
import type { Metadata } from "next"
import { CustomerSelfBuildStudio } from "../../features/builder/CustomerSelfBuildStudio"
import { StorefrontHeader } from "../../features/shell/StorefrontHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { customerSelfBuildEnabled } from "../../lib/server/self-build-drafts"
import { getSelfBuildVisualData } from "../../lib/server/self-build-preview"
import { getSelfBuildPublishedCatalog } from "../../lib/server/self-build-published-tiers"
import { getStoreSettings,defaultStoreSettings } from "../../lib/server/store-settings"
import "../../styles/self-build-buyer-20261013.css"

export const runtime="nodejs"
export const dynamic="force-dynamic"
export const metadata:Metadata={
  title:"Create Your Own Gift Hamper | Celebration",
  description:"Choose gift categories, add a personal touch and let Celebration curate your gift hamper.",
  robots:{index:false,follow:false}
}

export default async function SelfBuildCustomerPage(){
  const [enabled,settings]=await Promise.all([
    customerSelfBuildEnabled().catch(()=>false),
    getStoreSettings().catch(()=>null)
  ])
  // IMPORTANT: the production database hard launch gate forbids customer
  // checkout. Never expose the draft / payment UI until explicitly approved.
  let surface:React.ReactNode
  if(!enabled){
    surface=<section className="sbBuyerComingSoon">
      <span>CELEBRATION · GIFT HAMPERS</span>
      <h1>Personal hampers, made with care.</h1>
      <p>Our create-your-own hamper studio is being prepared. Gift hampers and jewellery are still available in our existing store.</p>
      <Link href="/#budgets">Shop available hampers →</Link>
    </section>
  }else{
    try{
      const [visual,catalog]=await Promise.all([getSelfBuildVisualData(),getSelfBuildPublishedCatalog()])
      const tiers=catalog.tiers
      if(!tiers.length)throw Error("NO_HAMPER_TIERS")
      surface=<CustomerSelfBuildStudio data={visual} tiers={tiers} occasions={catalog.catalog.occasions} />
    }catch{
      surface=<section className="sbBuyerComingSoon">
        <h1>Hamper studio is temporarily unavailable.</h1>
        <p>No payment has been attempted. Please try again later.</p>
        <Link href="/">Back to Celebration</Link>
      </section>
    }
  }
  return <main className="sbBuyerPage">
    <TrustStrip />
    <StorefrontHeader settings={settings?.settings||defaultStoreSettings} showSelfBuild={enabled} />
    <div className="wrap">{surface}</div>
    <SiteFooter />
  </main>
}
