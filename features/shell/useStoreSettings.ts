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

let cachedSettings: StoreSettings = fallback
let settingsLoaded = false
let settingsRequest: Promise<StoreSettings> | null = null

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

function loadSettings() {
  if (settingsLoaded) return Promise.resolve(cachedSettings)
  if (settingsRequest) return settingsRequest

  settingsRequest = fetch("/api/store-settings", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      if (data?.ok && data.settings) cachedSettings = data.settings as StoreSettings
      settingsLoaded = true
      return cachedSettings
    })
    .catch(() => {
      settingsLoaded = true
      return cachedSettings
    })
    .finally(() => { settingsRequest = null })

  return settingsRequest
}

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(cachedSettings)

  useEffect(() => {
    let active = true
    const idleWindow = window as IdleWindow
    const run = () => { void loadSettings().then((next) => { if (active) setSettings(next) }) }

    let cancel: () => void
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(run, { timeout: 2200 })
      cancel = () => idleWindow.cancelIdleCallback?.(handle)
    } else {
      const handle = window.setTimeout(run, 1400)
      cancel = () => window.clearTimeout(handle)
    }

    return () => {
      active = false
      cancel()
    }
  }, [])

  return settings
}
