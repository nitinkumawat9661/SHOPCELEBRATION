"use client"

import { useState } from "react"
import { catalogImageVariant, formatMoney, primaryProductImage, productImages, type GiftProduct } from "../../../lib/domain/catalog"
import { customerPaymentStatusLabel, orderStatusLabels } from "../../../lib/domain/order-status"
import type { AdminOrder } from "../types"

const money = (paise: number) => formatMoney(paise / 100)
function text(value: string | null | undefined) {
  return value?.trim() || "Not recorded"
}
function displayDate(value: string | undefined) {
  if (!value) return "Not recorded"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "Not recorded"
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata"
  }).format(d)
}
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="cav3-detail-row"><dt>{label}</dt><dd>{value}</dd></div>
}
function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="cav3-detail-card"><h2>{title}</h2>{children}</section>
}
function BackButton({ onBack }: { onBack: () => void }) {
  return <button className="cav3-detail-back" type="button" onClick={onBack}>← Back to list</button>
}
function SafePicture({ url, alt, className, variant }: { url: string | undefined; alt: string; className: string; variant: "thumb" | "main" }) {
  const [failed, setFailed] = useState(false)
  return <div className={className}>
    {url && !failed
      ? <img src={catalogImageVariant(url, variant)} alt={alt} loading="lazy" referrerPolicy="no-referrer"
          onError={() => setFailed(true)} />
      : <span className="cav3-image-missing">{url ? "Image unavailable" : "No image"}</span>}
  </div>
}

/** Read-only product detail. Live catalogue values come from /api/catalog, not draft. */
export function AdminProductDetailV3({ product, onBack }: { product: GiftProduct; onBack: () => void }) {
  const gallery = productImages(product)
  const [chosen, setChosen] = useState(0)
  const current = gallery[Math.min(chosen, gallery.length - 1)]
  const retail = product.retail
  const isRetail = product.sellIndividually === true
  const stock = product.stockAvailable

  return <div className="cav3-detail-page">
    <BackButton onBack={onBack} />
    <div className="cav3-detail-heading"><div><div className="cav3-eyebrow">Live product · read-only preview</div>
      <h2>{product.name}</h2><p>SKU: <code>{product.id}</code></p></div>
      <div className="cav3-detail-actions">
        {isRetail && product.active !== false && <a href={"/jewelry/" + encodeURIComponent(product.id)}
          rel="noreferrer" target="_blank">View storefront ↗</a>}
        <a className="cav3-detail-primary" href="/admin">Edit in current admin ↗</a>
      </div></div>
    <div className="cav3-detail-columns">
      <div>
        <DetailCard title="Product gallery">
          <SafePicture key={current?.url || "empty"} className="cav3-detail-hero" url={current?.url}
            alt={current?.alt || product.name} variant="main" />
          {gallery.length > 1 && <div className="cav3-gallery-options" aria-label="Product photographs">
            {gallery.map((image, index) =>
              <button type="button" aria-label={"Show photograph " + (index + 1)} aria-pressed={index === chosen}
                key={image.url} className={chosen === index ? "is-selected" : ""}
                onClick={() => setChosen(index)}>
                <SafePicture url={image.url} alt="" className="cav3-gallery-thumb" variant="thumb" />
              </button>)}</div>}
          <p className="cav3-detail-explainer">Images belong to the live SKU. Gallery is read-only; catalog publishing remains in the current admin.</p>
        </DetailCard>
        <DetailCard title="Description & details">
          <p className="cav3-detail-text">{product.description?.trim() || product.note?.trim() || "No description recorded."}</p>
          {!!product.highlights?.length && <div className="cav3-detail-tags">{product.highlights.map((v, index) =>
            <span key={index}>{v}</span>)}</div>}
        </DetailCard>
      </div>
      <div>
        <DetailCard title="Listing status">
          <dl className="cav3-detail-list">
            <DetailRow label="Visibility" value={product.active === false ? "Inactive" : "Active"} />
            <DetailRow label="Category" value={text(product.category)} />
            <DetailRow label="Individual retail sale" value={isRetail ? "Enabled" : "Not enabled"} />
            <DetailRow label="Hamper minimum tier" value={formatMoney(product.minTier)} />
          </dl>
        </DetailCard>
        <DetailCard title="Pricing and inventory">
          <dl className="cav3-detail-list">
            <DetailRow label="Current sale price" value={typeof product.salePricePaise === "number" ? money(product.salePricePaise) : "Not listed"} />
            <DetailRow label="Recorded MRP" value={typeof retail?.mrpPaise === "number" ? money(retail.mrpPaise) : "Not recorded"} />
            <DetailRow label="Available for retail orders" value={isRetail
              ? (typeof stock === "number" ? String(stock) + " units" : "Not available") : "Not applicable"} />
          </dl>
          <p className="cav3-detail-explainer">Available retail stock already reflects reservations. Stock editing remains in the existing operational admin.</p>
        </DetailCard>
        <DetailCard title="Retail declarations">
          <dl className="cav3-detail-list">
            <DetailRow label="Generic name" value={text(retail?.genericName)} />
            <DetailRow label="Country of origin" value={text(retail?.countryOfOrigin)} />
            <DetailRow label="Net quantity" value={text(retail?.netQuantity)} />
            <DetailRow label="Manufacturer / packer" value={text(retail?.manufacturerOrPackerName)} />
            <DetailRow label="Consumer care" value={text(retail?.consumerCare)} />
            <DetailRow label="Warranty / guarantee" value={text(retail?.warrantyOrGuarantee)} />
          </dl>
        </DetailCard>
      </div>
    </div>
  </div>
}

/** Read-only order detail. Immutable purchase snapshots are never repriced. */
export function AdminOrderDetailV3({ order, onBack }: { order: AdminOrder; onBack: () => void }) {
  const itemSummary = order.lineItems.length
    ? order.lineItems.map((item, index) => <div className="cav3-item-row" key={item.productId + index}>
      <SafePicture url={item.imageUrl} alt="" className="cav3-item-photo" variant="thumb" />
      <div><b>{item.name}</b><small>{item.productId} · Qty {item.quantity} × {money(item.unitPricePaise)}</small></div>
      <strong>{money(item.lineTotalPaise)}</strong></div>)
    : order.selectedProductNames.map((name, index) => <div className="cav3-item-row" key={index}><div><b>{name}</b></div></div>)

  const selfBuild = order.selfBuild
  const hasTracking = Boolean(order.shippingTrackingNumber)
  const labelUrl = order.shippingLabelUrl
  const safeLabel = labelUrl && (labelUrl.startsWith("/") && !labelUrl.startsWith("//") || /^https:\/\//i.test(labelUrl))
    ? labelUrl : null

  return <div className="cav3-detail-page">
    <BackButton onBack={onBack} />
    <div className="cav3-detail-heading"><div><div className="cav3-eyebrow">Order details · read-only preview</div>
      <h2>{order.publicId}</h2><p>Placed {displayDate(order.createdAt)} · {order.orderType === "individual" ? "Retail jewellery" : "Hamper order"}</p></div>
      <div className="cav3-detail-actions"><a className="cav3-detail-primary" href="/admin">Manage in current admin ↗</a></div></div>
    <div className="cav3-order-badges">
      <span>Fulfilment: {orderStatusLabels[order.status] || order.status}</span>
      <span>Payment: {customerPaymentStatusLabel(order.paymentStatus)}</span>
    </div>
    <div className="cav3-detail-columns">
      <div>
        <DetailCard title="Ordered items">
          {itemSummary.length ? itemSummary : <p className="cav3-detail-text">Items are not recorded on this snapshot.</p>}
          {selfBuild?.selections?.length ? <div className="cav3-selfbuild-details">
            <h3>Self-Build selections · admin-only</h3>
            {selfBuild.selections.map((row, index) =>
              <p key={row.id + index}>{row.label} × {row.quantity}</p>)}
            {selfBuild.otherRequestText && <p><b>Special request:</b> {selfBuild.otherRequestText}</p>}
            <p><b>Category reservation:</b> {selfBuild.reservationStatus || "Not recorded"}</p>
          </div> : null}
        </DetailCard>
        <DetailCard title="Payment summary">
          <dl className="cav3-detail-list">
            <DetailRow label="Subtotal at order time" value={money(order.subtotalPaise)} />
            <DetailRow label="Discount applied" value={"− " + money(order.discountPaise || 0)} />
            <DetailRow label="Recorded order total" value={money(order.amountPaise)} />
            <DetailRow label="Payment status" value={customerPaymentStatusLabel(order.paymentStatus)} />
            <DetailRow label="Payment reference" value={text(order.paymentReference)} />
            <DetailRow label="Campaign" value={text(order.campaignTitle)} />
          </dl>
          <p className="cav3-detail-explainer">The order total is a recorded historical amount, not proof of funds received or refunded. Payment status is shown separately.</p>
        </DetailCard>
        <DetailCard title="Shipping">
          <dl className="cav3-detail-list">
            <DetailRow label="Carrier/provider" value={text(order.shippingProvider)} />
            <DetailRow label="AWB / tracking" value={hasTracking ? order.shippingTrackingNumber : "Not booked"} />
            <DetailRow label="Booked at" value={displayDate(order.shippingBookedAt || undefined)} />
            <DetailRow label="Status" value={orderStatusLabels[order.status] || order.status} />
          </dl>
          {safeLabel && <p><a className="cav3-detail-link" href={safeLabel} target="_blank" rel="noopener noreferrer">View shipping label ↗</a></p>}
          <p className="cav3-detail-explainer">AWB booking alone does not establish courier pickup or shipped status.</p>
        </DetailCard>
      </div>
      <div>
        <DetailCard title="Customer & delivery">
          <dl className="cav3-detail-list">
            <DetailRow label="Customer" value={text(order.customerName)} />
            <DetailRow label="Contact" value={text(order.phone)} />
            <DetailRow label="Recipient" value={text(order.receiverName)} />
            <DetailRow label="Shipping address" value={<span className="cav3-wrap">{[order.address, order.city, order.state, order.pincode].filter(Boolean).join(", ") || "Not recorded"}</span>} />
            <DetailRow label="Required date" value={text(order.requiredDate)} />
            <DetailRow label="Occasion" value={text(order.occasion)} />
          </dl>
        </DetailCard>
        <DetailCard title="Fulfilment & support">
          <dl className="cav3-detail-list">
            <DetailRow label="Packing video" value={order.packingVideoKey ? "Recorded (open current admin)" : "Not available"} />
            <DetailRow label="Issue type" value={text(order.issueType)} />
            <DetailRow label="Issue note" value={<span className="cav3-wrap">{text(order.issueNote)}</span>} />
            <DetailRow label="Customer message" value={<span className="cav3-wrap">{text(order.message)}</span>} />
            <DetailRow label="Last updated" value={displayDate(order.updatedAt)} />
          </dl>
          <p className="cav3-detail-explainer">Order mutations, packing video, customer approval, courier actions and claims remain protected by their existing workflows.</p>
        </DetailCard>
      </div>
    </div>
  </div>
}
