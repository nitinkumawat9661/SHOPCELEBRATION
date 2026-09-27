"use client"

import { useCallback, useEffect, useState } from "react"
import { defaultCatalog, tierById, visibleTiers, type CatalogConfig } from "../../lib/domain/catalog"
import { storeContent } from "../../lib/domain/content"
import type { CheckoutData } from "./types"
import { validateCheckoutFields, type CheckoutFieldErrors } from "./validation"

const BUILDER_DRAFT_KEY = "celebration:hamper-draft:v1"
const BUILDER_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

type BuilderDraft = {
  v: 2
  tierId: string
  occasion: string
  step: number
  updatedAt: number
}

export type TierSocialProof = {
  tierName: string
  orderCount: number
  totalOrders: number
  sharePercent: number
}

type InitialBuilderData = {
  catalog?: CatalogConfig
  socialProof?: TierSocialProof | null
  tierId?: string
  occasion?: string
}

function defaultTierFor(catalog: CatalogConfig) {
  const tier = tierById(catalog, catalog.settings.defaultTierId) || visibleTiers(catalog)[0]
  if (!tier) throw new Error("Configured catalog has no active tier")
  return tier
}

function checkoutDefaults(catalog: CatalogConfig, identity?: { customerName?: string; phone?: string }, initialOccasion?: string): CheckoutData {
  const occasion = initialOccasion && catalog.occasions.includes(initialOccasion)
    ? initialOccasion
    : catalog.settings.defaultOccasion
  return {
    customerName: identity?.customerName || "",
    phone: identity?.phone || "",
    receiverName: "",
    address: "",
    city: "",
    state: storeContent.checkout.defaultState,
    pincode: "",
    requiredDate: "",
    occasion,
    message: "",
    paymentReference: ""
  }
}

function removeBuilderDraft() {
  if (typeof window === "undefined") return
  try { window.localStorage.removeItem(BUILDER_DRAFT_KEY) } catch { /* localStorage can be unavailable */ }
}

function readBuilderDraft(catalog: CatalogConfig) {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(BUILDER_DRAFT_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<BuilderDraft>
    if (value.v !== 2 || typeof value.updatedAt !== "number" || Date.now() - value.updatedAt > BUILDER_DRAFT_TTL_MS) {
      removeBuilderDraft()
      return null
    }

    const nextTier = typeof value.tierId === "string" ? tierById(catalog, value.tierId) : null
    const tier = nextTier || defaultTierFor(catalog)
    const occasion = typeof value.occasion === "string" && catalog.occasions.includes(value.occasion)
      ? value.occasion
      : catalog.settings.defaultOccasion
    const requestedStep = Number(value.step)
    const step = Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= 3 ? requestedStep : 1

    return { tierId: tier.id, occasion, step }
  } catch {
    removeBuilderDraft()
    return null
  }
}

export function useHamperBuilder(initial: InitialBuilderData = {}) {
  const initialCatalog = initial.catalog || defaultCatalog
  const requestedTier = initial.tierId ? tierById(initialCatalog, initial.tierId) : undefined
  const initialTier = requestedTier || defaultTierFor(initialCatalog)
  const hasServerCatalog = Boolean(initial.catalog)
  const [catalog, setCatalog] = useState<CatalogConfig>(initialCatalog)
  const [catalogLoading, setCatalogLoading] = useState(!hasServerCatalog)
  const [catalogError, setCatalogError] = useState("")
  const [socialProof, setSocialProof] = useState<TierSocialProof | null>(initial.socialProof || null)
  const [tierId, setTierId] = useState(initialTier.id)
  const [step, setStep] = useState(1)
  const [accepted, setAccepted] = useState(false)
  const [detailsError, setDetailsError] = useState("")
  const [detailsFieldErrors, setDetailsFieldErrors] = useState<CheckoutFieldErrors>({})
  const [checkout, setCheckout] = useState<CheckoutData>(() => checkoutDefaults(initialCatalog, undefined, initial.occasion))
  const [draftReady, setDraftReady] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError("")
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" })
      if (!response.ok) throw new Error("catalog")
      const payload = await response.json() as { ok: boolean; catalog?: CatalogConfig; socialProof?: TierSocialProof | null }
      if (!payload.ok || !payload.catalog) throw new Error("catalog")
      const next = payload.catalog
      setCatalog(next)
      setSocialProof(payload.socialProof || null)
      setTierId((currentTierId) => (tierById(next, currentTierId) || defaultTierFor(next)).id)
      setCheckout((current) => ({
        ...current,
        occasion: next.occasions.includes(current.occasion) ? current.occasion : next.settings.defaultOccasion
      }))
    } catch {
      setSocialProof(null)
      setCatalogError("We couldn’t load the latest hamper options. Try again — safe fallback options are still available.")
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!hasServerCatalog) loadCatalog()
  }, [hasServerCatalog, loadCatalog])

  useEffect(() => {
    if (catalogLoading || catalogError || draftReady) return
    const draft = readBuilderDraft(catalog)
    if (draft) {
      setTierId(draft.tierId)
      setStep(draft.step)
      setCheckout((current) => ({ ...current, occasion: draft.occasion }))
      setDraftRestored(true)
    }
    setDraftReady(true)
  }, [catalog, catalogError, catalogLoading, draftReady])

  useEffect(() => {
    if (!draftReady || typeof window === "undefined") return
    const defaultTier = defaultTierFor(catalog)
    const safeStep = Math.min(Math.max(step, 1), 3)
    const meaningful = tierId !== defaultTier.id
      || checkout.occasion !== catalog.settings.defaultOccasion
      || safeStep > 1

    if (!meaningful) {
      removeBuilderDraft()
      return
    }

    const draft: BuilderDraft = {
      v: 2,
      tierId,
      occasion: checkout.occasion,
      step: safeStep,
      updatedAt: Date.now()
    }
    try { window.localStorage.setItem(BUILDER_DRAFT_KEY, JSON.stringify(draft)) } catch { /* non-critical preference cache */ }
  }, [catalog, checkout.occasion, draftReady, step, tierId])

  const tiers = visibleTiers(catalog)
  const occasions = catalog.occasions
  const tier = tierById(catalog, tierId) || defaultTierFor(catalog)

  function updateField<K extends keyof CheckoutData>(key: K, value: CheckoutData[K]) {
    setCheckout((current) => ({ ...current, [key]: value }))
    setDetailsError("")
    setDetailsFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function goToPayment(): keyof CheckoutData | null {
    const fieldErrors = validateCheckoutFields(checkout)
    setDetailsFieldErrors(fieldErrors)
    const firstField = Object.keys(fieldErrors)[0] as keyof CheckoutData | undefined
    const firstError = firstField ? fieldErrors[firstField] || "" : ""
    setDetailsError(firstError)
    if (!firstField) setStep(3)
    return firstField || null
  }

  function goToStep(nextStep: number): keyof CheckoutData | null {
    if (nextStep === 3) return goToPayment()
    setDetailsError("")
    setDetailsFieldErrors({})
    setStep(Math.min(Math.max(nextStep, 1), 3))
    return null
  }

  function selectTier(id: string) {
    const nextTier = tierById(catalog, id)
    if (!nextTier) return
    setTierId(id)
  }

  function clearDraft() {
    removeBuilderDraft()
    setDraftRestored(false)
  }

  function resetForNewOrder(identity?: { customerName?: string; phone?: string }) {
    clearDraft()
    const nextTier = defaultTierFor(catalog)
    setTierId(nextTier.id)
    setStep(1)
    setAccepted(false)
    setDetailsError("")
    setDetailsFieldErrors({})
    setCheckout(checkoutDefaults(catalog, identity))
  }

  return {
    catalog,
    catalogLoading,
    catalogError,
    socialProof,
    retryCatalog: loadCatalog,
    tier,
    tierId,
    tiers,
    occasions,
    selected: [] as string[],
    selectedNames: [] as string[],
    step,
    checkout,
    accepted,
    detailsError,
    detailsFieldErrors,
    draftRestored,
    dismissDraftRestored: () => setDraftRestored(false),
    clearDraft,
    setStep,
    goToStep,
    goToPayment,
    setAccepted,
    updateField,
    selectTier,
    resetForNewOrder
  }
}
