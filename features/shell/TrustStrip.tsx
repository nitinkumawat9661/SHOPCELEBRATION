import { storeContent } from "../../lib/domain/content"

export function TrustStrip() {
  return (
    <div className="trustStrip">
      <div className="wrap trustStripInner">
        {storeContent.trustStrip.map((item, index) => index === 0 ? <b key={item}>{item}</b> : <span key={item}>{item}</span>)}
      </div>
    </div>
  )
}
