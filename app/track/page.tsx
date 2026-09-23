import { Suspense } from "react"
import { TrackingPage } from "../../features/tracking/TrackingPage"

export const metadata = { robots: { index: false, follow: false } }

export default function TrackPage() {
  return <Suspense fallback={null}><TrackingPage /></Suspense>
}
