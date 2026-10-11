import { COURIER_MILESTONES, courierMilestoneIndex, type CourierPublicStatus } from "../../lib/domain/courier-tracking"

export function CourierJourney({ courier, unavailable = false, compact = false }: {
  courier: CourierPublicStatus | null
  unavailable?: boolean
  compact?: boolean
}) {
  if (!courier && !unavailable) return null
  const position = courier ? courierMilestoneIndex(courier.stage) : -1
  const issue = courier?.stage === "exception" || courier?.stage === "returning"
  const currentLocation = courier?.lastLocation
  const deliveryToday = courier?.code === "OOD" || courier?.code === "OFD"
  return <section className={`courierJourney ${compact ? "courierJourneyCompact" : ""}`} aria-label="Live courier journey">
    <div className="courierJourneyHead">
      <div>
        <span className="courierJourneyEyebrow">COURIER UPDATES</span>
        <h3>{courier ? (deliveryToday ? "Arriving today (expected)" : courier.label) : "Tracking temporarily unavailable"}</h3>
        <p>{courier?.description || "Live tracking could not be loaded. Your saved order status is still available."}</p>
      </div>
      {courier?.courierName && <span className="courierCarrier">{courier.courierName}</span>}
    </div>
    {courier?.stage && <ol className="courierMilestones">
      {COURIER_MILESTONES.map(({ stage, label }, index) =>
        <li key={stage} className={position >= index ? "reached" : ""} aria-current={position === index && !issue ? "step" : undefined}>
          <span aria-hidden="true" className="courierDot">{position > index ? "✓" : ""}</span>
          <span>{label}</span>
        </li>
      )}
    </ol>}
    {issue && <p className="courierException" role="status">Courier alert: {courier?.label}. This does not mean your purchase was automatically cancelled or refunded.</p>}
    {currentLocation && <p className="courierLastScan"><strong>Last reported location:</strong> {currentLocation}</p>}
    {courier?.estimatedDeliveryDate && <p className="courierEstimate"><strong>Estimated delivery:</strong> {courier.estimatedDeliveryDate} <span>(courier estimate, not a guarantee)</span></p>}
    {unavailable && <p className="courierUnavailable" role="status">Live courier tracking could not be refreshed. Displayed history may be incomplete; please use Refresh or the courier tracking link.</p>}
    {courier?.trackUrl && <a className="courierExternal" href={courier.trackUrl} target="_blank" rel="noopener noreferrer">Open courier tracking <span aria-hidden="true">↗</span></a>}
    {Boolean(courier?.scans.length) && <details className="courierHistory">
      <summary>Courier scan history ({courier!.scans.length})</summary>
      <ol>
        {courier!.scans.map((scan, index) => <li key={`${index}:${scan.status}:${scan.occurredAt || ""}`}>
          <strong>{scan.status}</strong>
          {scan.location && <span>{scan.location}</span>}
          {scan.occurredAt && <time>{scan.occurredAt}</time>}
          {scan.details && <small>{scan.details}</small>}
        </li>)}
      </ol>
    </details>}
    <small className="courierJourneyDisclaimer">Updates come from courier scans, not continuous GPS. The website does not assume pickup or delivery before the courier confirms it.</small>
  </section>
}
