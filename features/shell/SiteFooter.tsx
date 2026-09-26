import Link from "next/link"
import { storeContent, uiContent } from "../../lib/domain/content"
import { routes } from "../../config/routes"

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap footerin">
        <div><div className="logo">{storeContent.brand.name}</div><div className="tag">{storeContent.brand.tagline}</div></div>
        <div className="footerLinks"><Link href={routes.policies}>{uiContent.footer.policy}</Link><Link href={routes.privacy}>Privacy Policy</Link><span className="tiny">{storeContent.brand.footerLine}</span></div>
      </div>
    </footer>
  )
}
