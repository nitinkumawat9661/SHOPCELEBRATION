import { storeContent } from "../../lib/domain/content"
import { StoreIcon } from "../shell/StoreIcon"

const ICONS = ["shield", "video", "box", "track"] as const

export function PromiseSection() {
  return (
    <section id="trust" className="promiseSec">
      <div className="wrap">
        <div className="cbSectionHeading">
          <span className="cbEyebrow">WHY CELEBRATION</span>
          <h2>From payment to delivery</h2>
        </div>
        <div className="promiseGrid">
          {storeContent.promiseCards.slice(0, 4).map((card, index) => (
            <article key={card.title}>
              <div className="promiseIcon"><StoreIcon name={ICONS[index]} size={23} /></div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
