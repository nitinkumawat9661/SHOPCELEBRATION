import Link from "next/link"
import { storeContent, uiContent } from "../../lib/domain/content"
import { routes } from "../../config/routes"

export function SiteFooter() {
  return (
    <footer className="footer finalFooter">
      <div className="wrap footerin">
        <div className="footerIdentity">
          <div className="logo">{storeContent.brand.name}</div>
          <div className="tag">{storeContent.brand.tagline}</div>
          <p>Jewelry for everyday moments. Hampers for the occasions that matter.</p>
        </div>
        <nav className="footerGroup" aria-label="Shop links">
          <h2>Shop</h2>
          <Link href="/jewelry">Shop jewelry</Link>
          <Link href="/jewelry?view=all">All gifts</Link>
          <a href="/curated-hampers">Custom hampers</a>
          <Link href={routes.about}>Our Story</Link>
        </nav>
        <nav className="footerGroup" aria-label="Help links">
          <h2>Help &amp; orders</h2>
          <Link href="/faq">Frequently asked questions</Link>
          <Link href={routes.track}>Track your order</Link>
          <Link href={routes.account}>My Celebration</Link>
          <Link href={routes.claim}>Raise a claim</Link>
        </nav>
        <nav className="footerGroup footerLinks" aria-label="Policies and information">
          <h2>Information</h2>
          <Link href={routes.policies}>{uiContent.footer.policy}</Link>
          <Link href={routes.terms}>Terms &amp; Legal</Link>
          <Link href={routes.privacy}>Privacy Policy</Link>
          <Link href="/compare">Compare stores</Link>
          <Link href={routes.compliance}>Fair Shopping Review</Link>
        </nav>
      </div>
      <div className="wrap footerBottom">
        <small>{storeContent.brand.footerLine}</small>
      </div>
    </footer>
  )
}
