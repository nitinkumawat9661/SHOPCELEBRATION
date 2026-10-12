import { UxMessenger } from "../../features/ux/UxMessenger"
import "../../styles/admin.css"
import "../../styles/admin-v2.css"
import "../../styles/admin-systematic.css"
import "../../styles/admin-shell.css"
import "../../styles/admin-self-build-20261013.css"

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}<UxMessenger /></>
}
