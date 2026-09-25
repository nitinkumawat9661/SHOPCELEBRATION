import { UxMessenger } from "../../features/ux/UxMessenger"
import "../../styles/admin.css"
import "../../styles/admin-v2.css"

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}<UxMessenger /></>
}
