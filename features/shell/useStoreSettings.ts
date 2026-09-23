"use client"

import { useEffect, useState } from "react"
import { storeContent } from "../../lib/domain/content"
import type { StoreSettings } from "../../lib/server/store-settings"

const fallback: StoreSettings = {
  whatsapp: storeContent.support.whatsapp,
  assistTitle: storeContent.support.assistTitle,
  assistBody: storeContent.support.assistBody,
  supportMessage: storeContent.support.supportMessage
}

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(fallback)
  useEffect(() => {
    fetch("/api/store-settings", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.ok && data.settings) setSettings(data.settings) })
      .catch(() => undefined)
  }, [])
  return settings
}
