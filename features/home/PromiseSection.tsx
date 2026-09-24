import { storeContent, uiContent } from "../../lib/domain/content"
import { SpotlightCard } from "../motion/InteractiveSurface"

export function PromiseSection() {
  return (
    <section id="trust" className="promiseSec">
      <div className="wrap">
        <div className="centerHead"><div className="kicker">{uiContent.promise.kicker}</div><h2>{uiContent.promise.title}</h2><p>{uiContent.promise.body}</p></div>
        <div className="promiseGrid">{storeContent.promiseCards.map((card) => <SpotlightCard key={card.title}><div className="promiseIcon">{card.icon}</div><h3>{card.title}</h3><p>{card.body}</p></SpotlightCard>)}</div>
      </div>
    </section>
  )
}
