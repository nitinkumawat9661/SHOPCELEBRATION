"use client"

import { StorefrontHeader } from "./StorefrontHeader"
import { useStoreSettings } from "./useStoreSettings"

export function SiteHeader({ onCreate, showAccount = true }: { onCreate?: () => void; showAccount?: boolean }) {
  return <StorefrontHeader settings={useStoreSettings()} onCreate={onCreate} showAccount={showAccount} />
}
