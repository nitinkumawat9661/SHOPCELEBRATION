import { UxMessenger } from "../../features/ux/UxMessenger"
import "../../styles/account.css"

export default function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}<UxMessenger /></>
}
