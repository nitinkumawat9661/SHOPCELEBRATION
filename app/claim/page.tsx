import type { Metadata } from "next"
import { ClaimForm } from "../../features/claims/ClaimForm"
import { SiteFooter } from "../../features/shell/SiteFooter"
import { SiteHeader } from "../../features/shell/SiteHeader"
import { TrustStrip } from "../../features/shell/TrustStrip"

export const metadata: Metadata = {
  title: "Raise a Product Claim",
  description: "Verify a Celebration order and raise an anti-tarnish or product-quality claim through official WhatsApp support.",
  alternates: { canonical: "/claim" },
  robots: { index: true, follow: true }
}

export default function ClaimPage() {
  return <main><TrustStrip /><SiteHeader /><section><div className="wrap policyWrap"><ClaimForm /></div></section><SiteFooter /></main>
}
