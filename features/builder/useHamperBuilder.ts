"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { canSelectProduct, categoriesForCatalog, defaultCatalog, normalizeSelection, productById, selectedPoints, tierById, visibleProducts, visibleTiers, type CatalogConfig } from "../../lib/domain/catalog"
import { storeContent } from "../../lib/domain/content"
import type { CheckoutData } from "./types"
import { validateCheckoutFields, type CheckoutFieldErrors } from "./validation"

const BUILDER_DRAFT_KEY = "celebration:hamper-draft:v1"
const BUILDER_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

type BuilderDraft = {
  v: 1
  tierId: string
  selected: string[]
  occasion: string
  category: string
  step: number
  updatedAt: number
}

export type TierSocialProof = {
  tierName: string
  orderCount: number
  totalOrders: number
  sharePercent: number
}

function defaultTierFor(catalog: CatalogConfig) {
  const tier = tierById(catalog, catalog.settings.defaultTierId) || visibleTiers(catalog)[0]
  if (!tier) throw new Error("Configured catalog has no active tier")
  return tier
}

function checkoutDefaults(catalog: CatalogConfig, identity?: { customerName?: string; phone?: string }): CheckoutData {
  return {
    customerName: identity?.customerName || "",
    phone: identity?.phone || "",
    receiverName: "",
    address: "",
    city: "",
    state: storeContent.checkout.defaultState,
    pincode: "",
    requiredDate: "",
    occasion: catalog.settings.defaultOccasion,
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
    if (value.v !== 1 || typeof value.updatedAt !== "number" || Date.now() - value.updatedAt > BUILDER_DRAFT_TTL_MS) {
      removeBuilderDraft()
      return null
    }

    const nextTier = typeof value.tierId === "string" ? tierById(catalog, value.tierId) : null
    const tier = nextTier || defaultTierFor(catalog)
    const selected = normalizeSelection(
      catalog,
      tier,
      Array.isArray(value.selected) ? value.selected.filter((item): item is string => typeof item === "string").slice(0, 100) : []
    )
    const occasion = typeof value.occasion === "string" && catalog.occasions.includes(value.occasion)
      ? value.occasion
      : catalog.settings.defaultOccasion
    const categoryIds = new Set(categoriesForCatalog(catalog).map((item) => item.id))
    const category = typeof value.category === "string" && categoryIds.has(value.category)
      ? value.category
      : catalog.settings.allCategory.id
    const requestedStep = Number(value.step)
    const step = Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= 3
      ? requestedStep
      : selected.length > 0 ? 2 : 1

    return { tierId: tier.id, selected, occasion, category, step }
  } catch {
    removeBuilderDraft()
    return null
  }
}

export function useHamperBuilder() {
  const initialTier = defaultTierFor(defaultCatalog)
  const [catalog, setCatalog] = useState<CatalogConfig>(defaultCatalog)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState("")
  const [socialProof, setSocialProof] = useState<TierSocialProof | null>(null)
  const [tierId, setTierId] = useState(initialTier.id)
  const [selected, setSelected] = useState<string[]>([])
  const [step, setStep] = useState(1)
  const [category, setCategory] = useState(defaultCatalog.settings.allCategory.id)
  const [search, setSearch] = useState("")
  const [accepted, setAccepted] = useState(false)
  const [detailsError, setDetailsError] = useState("")
  const [detailsFieldErrors, setDetailsFieldErrors] = useState<CheckoutFieldErrors>({})
  const [checkout, setCheckout] = useState<CheckoutData>(() => checkoutDefaults(defaultCatalog))
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
      setTierId((currentTierId) => {
        const nextTier = tierById(next, currentTierId) || defaultTierFor(next)
        setSelected((current) => normalizeSelection(next, nextTier, current))
        return nextTier.id
      })
      setCategory(next.settings.allCategory.id)
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

  useEffect(() => { loadCatalog() }, [loadCatalog])

  useEffect(() => {
    if (catalogLoading || catalogError || draftReady) return
    const draft = readBuilderDraft(catalog)
    if (draft) {
      setTierId(draft.tierId)
      setSelected(draft.selected)
      setCategory(draft.category)
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
    const meaningful = selected.length > 0
      || tierId !== defaultTier.id
      || checkout.occasion !== catalog.settings.defaultOccasion
      || category !== catalog.settings.allCategory.id
      || safeStep > 1

    if (!meaningful) {
      removeBuilderDraft()
      return
    }

    const draft: BuilderDraft = {
      v: 1,
      tierId,
      selected: selected.slice(0, 100),
      occasion: checkout.occasion,
      category,
      step: safeStep,
      updatedAt: Date.now()
    }
    try { window.localStorage.setItem(BUILDER_DRAFT_KEY, JSON.stringify(draft)) } catch { /* non-critical preference cache */ }
  }, [catalog, category, checkout.occasion, draftReady, selected, step, tierId])

  const tiers = visibleTiers(catalog)
  const products = visibleProducts(catalog)
  const occasions = catalog.occasions
  const categories = categoriesForCatalog(catalog)
  const tier = tierById(catalog, tierId) || defaultTierFor(catalog)
  const selectedNames = selected.map((id) => productById(catalog, id)?.name).filter(Boolean) as string[]
  const filteredProducts = useMemo(() => products.filter((item) => {
    const byCategory = category === catalog.settings.allCategory.id || item.category === category
    const bySearch = !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase())
    return byCategory && bySearch
  }), [catalog.settings.allCategory.id, category, products, search])

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
    if (!firstField) setStep(4)
    return firstField || null
  }

  function goToStep(nextStep: number): keyof CheckoutData | null {
    if (nextStep === 4) return goToPayment()
    setDetailsError("")
    setDetailsFieldErrors({})
    setStep(nextStep)
    return null
  }

  function selectTier(id: string) {
    const nextTier = tierById(catalog, id)
    if (!nextTier) return
    setTierId(id)
    setSelected((current) => normalizeSelection(catalog, nextTier, current))
  }

  function toggleProduct(productId: string) {
    const product = productById(catalog, productId)
    if (!product) return
    if (selected.includes(productId)) {
      setSelected((current) => current.filter((id) => id !== productId))
      return
    }
    if (canSelectProduct(catalog, tier, selected, product).ok) setSelected((current) => [...current, productId])
  }

  function clearDraft() {
    removeBuilderDraft()
    setDraftRestored(false)
  }

  function resetForNewOrder(identity?: { customerName?: string; phone?: string }) {
    clearDraft()
    const nextTier = defaultTierFor(catalog)
    setTierId(nextTier.id)
    setSelected([])
    setStep(1)
    setCategory(catalog.settings.allCategory.id)
    setSearch("")
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
    products,
    occasions,
    categories,
    selected,
    selectedNames,
    pointsUsed: selectedPoints(catalog, selected),
    step,
    category,
    search,
    checkout,
    accepted,
    detailsError,
    detailsFieldErrors,
    filteredProducts,
    draftRestored,
    dismissDraftRestored: () => setDraftRestored(false),
    clearDraft,
    setStep,
    goToStep,
    goToPayment,
    setCategory,
    setSearch,
    setAccepted,
    updateField,
    selectTier,
    toggleProduct,
    resetForNewOrder
  }
}
