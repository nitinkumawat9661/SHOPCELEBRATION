import { UxMessenger } from "../../features/ux/UxMessenger"
import "../../styles/admin.css"
import "../../styles/admin-v2.css"
import "../../styles/admin-systematic.css"

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}<UxMessenger /></>
}
