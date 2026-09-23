import { storeContent, uiContent } from "../../lib/domain/content"

export function PromiseSection() {
  return (
    <section id="trust" className="promiseSec">
      <div className="wrap">
        <div className="centerHead"><div className="kicker">{uiContent.promise.kicker}</div><h2>{uiContent.promise.title}</h2><p>{uiContent.promise.body}</p></div>
        <div className="promiseGrid">{storeContent.promiseCards.map((card) => <article key={card.title}><div className="promiseIcon">{card.icon}</div><h3>{card.title}</h3><p>{card.body}</p></article>)}</div>
      </div>
    </section>
  )
}
