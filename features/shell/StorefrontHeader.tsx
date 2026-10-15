import Link from "next/link"
import { routes } from "../../config/routes"
import { storeContent } from "../../lib/domain/content"
import { supportWhatsappUrl } from "../../lib/domain/support"
import type { StoreSettings } from "../../lib/server/store-settings"
import { StoreIcon } from "./StoreIcon"
import { CartLink } from "../cart/AddToCart"
import { NotificationLink } from "./NotificationLink"
import { WishlistHeaderLink } from "./WishlistHeaderLink"
import { HeaderScrollBehavior } from "./HeaderScrollBehavior"

export function StorefrontHeader({ settings, onCreate, showAccount = true, searchQuery = "", showSelfBuild = false }: { settings: StoreSettings; onCreate?: () => void; showAccount?: boolean; searchQuery?: string; showSelfBuild?: boolean }) {
  const supportUrl = supportWhatsappUrl(settings.supportMessage, settings.whatsapp)
  return <>
    <header className="celebrationHeader">
      <div className="wrap celebrationHeaderTop">
        <Link href={routes.home} className="celebrationBrand" prefetch={false}>
          <span>{storeContent.brand.name}</span><small>{storeContent.brand.tagline}</small>
        </Link>
        <form className="celebrationSearch" action="/jewelry" role="search">
          <input type="hidden" name="view" value="all" />
          <input type="search" name="q" defaultValue={searchQuery} aria-label="Search gifts" placeholder="Search jewelry and gifts…" maxLength={100} />
          <button type="submit" aria-label="Search gifts"><StoreIcon name="search" size={19} /></button>
        </form>
        <div className="celebrationHeaderActions">
          {showAccount && <Link href={routes.account} className="celebrationIconLink" aria-label="My Celebration account" prefetch={false}><StoreIcon name="account" /><span>My account</span></Link>}
          {onCreate && <button className="celebrationIconLink" onClick={onCreate} type="button" aria-label="Build your hamper"><StoreIcon name="gift" /><span>My hamper</span></button>}
          <WishlistHeaderLink />
          <NotificationLink />
          <CartLink />
        </div>
      </div>
      <nav className="celebrationNav wrap" aria-label="Store navigation">
        <a href="/curated-hampers">Hampers</a>{showSelfBuild && <Link href="/self-build" prefetch={false}>Create your hamper</Link>}<Link href="/jewelry" prefetch={false}>Jewelry</Link><Link href="/jewelry?view=all" prefetch={false}>All Gifts</Link><a href="/#occasions">Occasions</a><a href="/curated-hampers">Budget</a><a href="/#trust">Why Celebration</a>
      </nav>
    </header>
    <HeaderScrollBehavior />
    <a className="celebrationSupport" href={supportUrl} target="_blank" rel="noreferrer" aria-label="Chat with Celebration on WhatsApp"><span aria-hidden="true">♡</span> Need a hand?</a>
  </>
}
