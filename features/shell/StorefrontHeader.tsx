import Link from "next/link"
import { routes } from "../../config/routes"
import { storeContent, uiContent } from "../../lib/domain/content"
import { supportWhatsappUrl } from "../../lib/domain/support"
import type { StoreSettings } from "../../lib/server/store-settings"

export function StorefrontHeader({ settings }: { settings: StoreSettings }) {
  const supportUrl = supportWhatsappUrl(settings.supportMessage, settings.whatsapp)

  return (
    <>
      <header className="nav">
        <div className="wrap navin">
          <Link href={routes.home} className="brand policyBrand" prefetch={false}>
            <div className="logo">{storeContent.brand.name}</div>
            <div className="tag">{storeContent.brand.tagline}</div>
          </Link>
          <nav className="links" aria-label="Store navigation">
            <a href={`${routes.home}#budgets`}>{uiContent.nav.budgets}</a>
            <a href={`${routes.home}#products`}>{uiContent.nav.products}</a>
            <a href={`${routes.home}#builder`}>{uiContent.nav.builder}</a>
            <a href={`${routes.home}#trust`}>{uiContent.nav.promise}</a>
          </nav>
          <div className="navAccountActions">
            <Link className="navAccountLink" href={routes.account} prefetch={false} aria-label="My Celebration dashboard">
              <span aria-hidden="true">♡</span><b>My Celebration</b>
            </Link>
            <a className="primary navCta navCtaLink" href={`${routes.home}#budgets`}>{uiContent.nav.create}</a>
          </div>
        </div>
        <div className="assistBar">
          <div className="wrap assistBarInner">
            <span><b>{settings.assistTitle}</b> {settings.assistBody}</span>
            <div>
              <a href={`${routes.home}#custom-request`}>Use my budget</a>
              <a href={supportUrl} target="_blank" rel="noreferrer">WhatsApp</a>
            </div>
          </div>
        </div>
      </header>
      <a className="whatsappDock" href={supportUrl} target="_blank" rel="noreferrer" aria-label="WA Need help? Celebration WhatsApp support">
        <span aria-hidden="true">WA</span><b>Need help?</b>
      </a>
    </>
  )
}
