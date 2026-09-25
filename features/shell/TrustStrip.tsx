import { storeContent } from "../../lib/domain/content"

function StripGroup({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div className="trustStripGroup" aria-hidden={duplicate || undefined}>
      {storeContent.trustStrip.map((item, index) => (
        index === 0
          ? <b key={`${duplicate ? "dup-" : ""}${item}`}>{item}</b>
          : <span key={`${duplicate ? "dup-" : ""}${item}`}>{item}</span>
      ))}
    </div>
  )
}

export function TrustStrip() {
  return (
    <div className="trustStrip" aria-label="Celebration service promises">
      <div className="trustStripViewport">
        <div className="trustStripTrack">
          <StripGroup />
          <StripGroup duplicate />
        </div>
      </div>
    </div>
  )
}
