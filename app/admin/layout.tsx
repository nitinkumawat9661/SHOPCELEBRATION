import { UxMessenger } from "../../features/ux/UxMessenger"
import "../../styles/admin.css"
import "../../styles/admin-v2.css"
import "../../styles/admin-systematic.css"
import "../../styles/admin-shell.css"

import "../../styles/admin-individual-sales.css"

import "../../styles/admin-catalog-polish.css"

import "../../styles/admin-reservation-review.css"

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}<UxMessenger /></>
}
