import Link from "next/link"
import { routes } from "../../config/routes"
import { storeContent } from "../../lib/domain/content"
import { supportWhatsappUrl } from "../../lib/domain/support"
import type { StoreSettings } from "../../lib/server/store-settings"
import { StoreIcon } from "./StoreIcon"
import { CartLink } from "../cart/AddToCart"

export function StorefrontHeader({ settings, onCreate, showAccount = true, searchQuery = "" }: { settings: StoreSettings; onCreate?: () => void; showAccount?: boolean; searchQuery?: string }) {
  const supportUrl = supportWhatsappUrl(settings.supportMessage, settings.whatsapp)
  return <>
    <header className="celebrationHeader">
      <div className="wrap celebrationHeaderTop">
        <Link href={routes.home} className="celebrationBrand" prefetch={false}>
          <span>{storeContent.brand.name}</span><small>{storeContent.brand.tagline}</small>
        </Link>
        <form className="celebrationSearch" action="/jewelry" role="search">
          <input type="hidden" name="view" value="all" />
          <input type="search" name="q" aria-label="Search gifts" placeholder="Find a little something they'll love…" maxLength={100} />
          <button type="submit" aria-label="Search gifts"><StoreIcon name="search" size={19} /></button>
        </form>
        <div className="celebrationHeaderActions">
          {showAccount && <Link href={routes.account} className="celebrationIconLink" aria-label="My Celebration account" prefetch={false}><StoreIcon name="account" /><span>My account</span></Link>}
          {onCreate && <button className="celebrationIconLink" onClick={onCreate} type="button" aria-label="Build your hamper"><StoreIcon name="gift" /><span>My hamper</span></button>}
          <CartLink />
        </div>
      </div>
      <nav className="celebrationNav wrap" aria-label="Store navigation">
        <a href="/#budgets">Hampers</a><Link href="/jewelry" prefetch={false}>Jewelry</Link><Link href="/jewelry?view=all" prefetch={false}>All Gifts</Link><a href="/#occasions">Occasions</a><a href="/#budgets">Budget</a><a href="/#trust">Why Celebration</a>
      </nav>
    </header>
    <a className="celebrationSupport" href={supportUrl} target="_blank" rel="noreferrer" aria-label="Chat with Celebration on WhatsApp"><span aria-hidden="true">♡</span> Need a hand?</a>
  </>
}
