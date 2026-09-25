import { UxMessenger } from "../../features/ux/UxMessenger"
import "../../styles/tracking.css"

export default function TrackLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}<UxMessenger /></>
}
