"use client"

import { uiContent } from "../../lib/domain/content"

export function FinalCta({ onBuild }: { onBuild: () => void }) {
  return <section className="ctaSec"><div className="wrap"><div className="cta"><div className="ctaIcon">{uiContent.cta.icon}</div><h2>{uiContent.cta.title}</h2><p>{uiContent.cta.body}</p><button className="secondary" onClick={onBuild}>{uiContent.cta.button}</button></div></div></section>
}
