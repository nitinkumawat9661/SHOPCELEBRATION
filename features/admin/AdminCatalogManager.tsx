"use client"

import { useEffect, useState } from "react"
import { defaultCatalog, formatMoney, primaryProductImage, productImages, salePriceFromRupees, type CatalogConfig, type GiftProduct, type ProductImage, type Tier } from "../../lib/domain/catalog"
import { routes } from "../../config/routes"
import { validation } from "../../config/validation"
import { catalogImageMimeTypeForFile } from "../../lib/domain/storage"

export type CatalogAdminSection = "tiers" | "products" | "occasions"

type AdminCatalogPayload = {
  ok?: boolean
  catalog?: CatalogConfig
  version?: number
  draftExists?: boolean
  draftUpdatedAt?: string | null
  error?: string
}

type ImportRecord = Record<string, unknown>

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (from === to || to < 0 || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function normalizeImportKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function normalizeImportRecord(input: ImportRecord) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [normalizeImportKey(key), value])) as ImportRecord
}

function importText(value: unknown, fallback = "") {
  return value === undefined || value === null ? fallback : String(value).trim()
}

function importBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback
  const text = String(value).trim().toLowerCase()
  if (["1", "true", "yes", "y", "on", "active", "enabled"].includes(text)) return true
  if (["0", "false", "no", "n", "off", "inactive", "disabled"].includes(text)) return false
  return fallback
}

function importInteger(value: unknown, fallback: number, min: number) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number < min) throw new Error(`Invalid number: ${String(value)}`)
  return number
}

function parseCsv(text: string): ImportRecord[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"') {
      if (quoted && next === '"') { cell += '"'; index += 1 }
      else quoted = !quoted
    } else if (char === "," && !quoted) {
      row.push(cell.trim()); cell = ""
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1
      row.push(cell.trim()); cell = ""
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else {
      cell += char
    }
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  if (rows.length < 2) throw new Error("CSV_EMPTY")
  const headers = rows[0].map((item) => item.trim())
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])))
}

function productFromImport(rawInput: ImportRecord, existing: GiftProduct | undefined, catalog: CatalogConfig, rowNumber: number): GiftProduct {
  const raw = normalizeImportRecord(rawInput)
  const pick = (...keys: string[]) => keys.map(normalizeImportKey).map((key) => raw[key]).find((value) => value !== undefined)
  const id = slug(importText(pick("id", "sku"), existing?.id || ""))
  const name = importText(pick("name", "productName"), existing?.name || "")
  const category = importText(pick("category"), existing?.category || "Other")
  if (!id || !name || !category) throw new Error(`Row ${rowNumber}: id, name aur category required hain.`)

  const minTier = importInteger(pick("minTier", "hamperMinimum", "minimumHamper"), existing?.minTier ?? catalog.tiers[0]?.price ?? 0, 0)
  const points = importInteger(pick("points"), existing?.points ?? 1, 1)
  const note = importText(pick("note", "shortDescription", "summary"), existing?.note || "")
  const description = importText(pick("description", "longDescription"), existing?.description || "") || undefined
  const badge = importText(pick("badge", "label"), existing?.badge || "") || undefined
  const highlightsRaw = importText(pick("highlights", "features"), (existing?.highlights || []).join("|"))
  const highlights = highlightsRaw ? highlightsRaw.split("|").map((item) => item.trim()).filter(Boolean).slice(0, validation.catalog.maxHighlights) : undefined
  const icon = importText(pick("icon", "emoji"), existing?.icon || "🎁") || undefined
  const imageUrl = importText(pick("imageUrl", "image", "photo", "photoUrl"), existing?.imageUrl || "") || undefined
  const imageUrlsRaw = importText(pick("imageUrls", "gallery", "images"), (existing?.images || []).map((item) => item.url).join("|"))
  const imageUrls = imageUrlsRaw ? imageUrlsRaw.split("|").map((item) => item.trim()).filter(Boolean).slice(0, validation.catalog.maxImages) : []
  const images = imageUrls.length ? imageUrls.map((url) => ({ url, alt: name })) : imageUrl ? [{ url: imageUrl, alt: name }] : undefined
  const active = importBoolean(pick("active", "status"), existing?.active !== false)
  const sellIndividually = importBoolean(pick("sellIndividually", "individualSale", "sellIndividual"), existing?.sellIndividually === true)
  const prepackagedRetail = importBoolean(pick("prepackagedRetail", "packagedRetail", "legalMetrology"), existing?.prepackagedRetail === true)
  const genericName = importText(pick("genericName"), existing?.retail?.genericName || "") || undefined
  const netQuantity = importText(pick("netQuantity"), existing?.retail?.netQuantity || "") || undefined
  const manufacturerOrPackerName = importText(pick("manufacturerOrPackerName", "manufacturer", "packer"), existing?.retail?.manufacturerOrPackerName || "") || undefined
  const manufacturerOrPackerAddress = importText(pick("manufacturerOrPackerAddress", "manufacturerAddress", "packerAddress"), existing?.retail?.manufacturerOrPackerAddress || "") || undefined
  const importerName = importText(pick("importerName"), existing?.retail?.importerName || "") || undefined
  const importerAddress = importText(pick("importerAddress"), existing?.retail?.importerAddress || "") || undefined
  const countryOfOrigin = importText(pick("countryOfOrigin", "origin"), existing?.retail?.countryOfOrigin || "") || undefined
  const consumerCare = importText(pick("consumerCare", "consumerCareContact"), existing?.retail?.consumerCare || "") || undefined
  const bestBefore = importText(pick("bestBefore", "useBefore"), existing?.retail?.bestBefore || "") || undefined
  const unitSalePrice = importText(pick("unitSalePrice"), existing?.retail?.unitSalePrice || "") || undefined
  const warrantyOrGuarantee = importText(pick("warrantyOrGuarantee", "warranty", "guarantee"), existing?.retail?.warrantyOrGuarantee || "") || undefined

  let mrpPaise = existing?.retail?.mrpPaise
  const mrpInput = pick("mrp", "mrpRupees")
  const mrpPaiseInput = pick("mrpPaise")
  if (mrpPaiseInput !== undefined && String(mrpPaiseInput).trim() !== "") {
    const parsed = Number(mrpPaiseInput)
    if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`Row ${rowNumber}: invalid mrpPaise.`)
    mrpPaise = parsed
  } else if (mrpInput !== undefined && String(mrpInput).trim() !== "") {
    mrpPaise = salePriceFromRupees(String(mrpInput).trim())
    if (mrpPaise === undefined) throw new Error(`Row ${rowNumber}: invalid MRP.`)
  }

  let salePricePaise = existing?.salePricePaise
  const paiseInput = pick("salePricePaise")
  const rupeeInput = pick("salePrice", "individualPrice", "price")
  if (paiseInput !== undefined && String(paiseInput).trim() !== "") {
    const parsed = Number(paiseInput)
    if (!Number.isInteger(parsed) || parsed < 100) throw new Error(`Row ${rowNumber}: invalid salePricePaise.`)
    salePricePaise = parsed
  } else if (rupeeInput !== undefined && String(rupeeInput).trim() !== "") {
    salePricePaise = salePriceFromRupees(String(rupeeInput).trim())
    if (salePricePaise === undefined) throw new Error(`Row ${rowNumber}: invalid sale price.`)
  }
  if (sellIndividually && !salePricePaise) throw new Error(`Row ${rowNumber}: individual selling ON hai, sale price required hai.`)

  return {
    id, name, category, minTier, points, note, description, highlights, badge, icon, imageUrl: images?.[0]?.url || imageUrl, images, active, sellIndividually, salePricePaise, prepackagedRetail,
    retail: { genericName, netQuantity, mrpPaise, manufacturerOrPackerName, manufacturerOrPackerAddress, importerName, importerAddress, countryOfOrigin, consumerCare, bestBefore, unitSalePrice, warrantyOrGuarantee }
  }
}

function importedRows(fileName: string, text: string): ImportRecord[] {
  if (fileName.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text) as unknown
    if (Array.isArray(parsed)) return parsed as ImportRecord[]
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { products?: unknown }).products)) return (parsed as { products: ImportRecord[] }).products
    throw new Error("JSON me products array required hai.")
  }
  return parseCsv(text)
}

export function AdminCatalogManager({ section }: { section: CatalogAdminSection }) {
  const [catalog, setCatalog] = useState<CatalogConfig>(defaultCatalog)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState("")
  const [dirty, setDirty] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({})

  function applyPayload(data: AdminCatalogPayload) {
    if (!data.catalog) return
    setCatalog(data.catalog)
    setVersion(data.version || 0)
    setHasDraft(Boolean(data.draftExists))
    setDraftUpdatedAt(data.draftUpdatedAt || null)
    setDirty(false)
  }

  async function load() {
    setError("")
    const response = await fetch("/api/admin/catalog", { cache: "no-store" })
    const data = await response.json() as AdminCatalogPayload
    if (!response.ok || !data.ok || !data.catalog) throw new Error(data.error || "CATALOG_LOAD_FAILED")
    applyPayload(data)
  }

  useEffect(() => { load().catch((caught) => setError(caught instanceof Error ? caught.message : "CATALOG_LOAD_FAILED")) }, [])
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  function edit(mutator: (current: CatalogConfig) => CatalogConfig) {
    setCatalog(mutator)
    setDirty(true)
    setNotice("")
  }

  function replaceTier(index: number, patch: Partial<Tier>) {
    edit((current) => ({ ...current, tiers: current.tiers.map((item, i) => i === index ? { ...item, ...patch } : item) }))
  }

  function replaceProduct(index: number, patch: Partial<GiftProduct>) {
    edit((current) => ({ ...current, products: current.products.map((item, i) => i === index ? { ...item, ...patch } : item) }))
  }

  function replaceStockLocal(index: number, quantity: number) {
    setCatalog((current) => ({ ...current, products: current.products.map((item, i) => i === index ? { ...item, stockAvailable: quantity } : item) }))
  }

  async function saveStock(index: number) {
    const product = catalog.products[index]
    const quantity = product.stockAvailable ?? 0
    setBusy(`stock-${index}`)
    setError("")
    try {
      const response = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity })
      })
      const data = await response.json() as { ok?: boolean; inventory?: { availableQuantity?: number }; error?: string }
      if (!response.ok || !data.ok || typeof data.inventory?.availableQuantity !== "number") throw new Error(data.error || "INVENTORY_UPDATE_FAILED")
      replaceStockLocal(index, data.inventory.availableQuantity)
      setNotice(`${product.name}: available stock updated to ${data.inventory.availableQuantity}.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "INVENTORY_UPDATE_FAILED")
    } finally {
      setBusy("")
    }
  }

  function replaceRetail(index: number, patch: Partial<NonNullable<GiftProduct["retail"]>>) {
    const current = catalog.products[index]
    replaceProduct(index, { retail: { ...(current.retail || {}), ...patch } })
  }

  function addTier() {
    const price = Math.max(1, (catalog.tiers.at(-1)?.price || 0) + 100)
    edit((current) => ({ ...current, tiers: [...current.tiers, { id: `tier-${Date.now()}`, price, name: "New Hamper", size: "Custom", maxChoices: 3, pointBudget: 6, active: true }] }))
  }

  function duplicateTier(index: number) {
    const source = catalog.tiers[index]
    edit((current) => ({ ...current, tiers: [...current.tiers.slice(0, index + 1), { ...source, id: `${source.id}-copy-${Date.now()}`, name: `${source.name} Copy` }, ...current.tiers.slice(index + 1)] }))
  }

  function addProduct() {
    edit((current) => ({ ...current, products: [...current.products, { id: `item-${Date.now()}`, name: "New Item", category: "Other", minTier: current.tiers[0]?.price || 0, points: 1, note: "", icon: "🎁", active: true, sellIndividually: false }] }))
  }

  function duplicateProduct(index: number) {
    const source = catalog.products[index]
    edit((current) => ({ ...current, products: [...current.products.slice(0, index + 1), { ...source, id: `${source.id}-copy-${Date.now()}`, name: `${source.name} Copy` }, ...current.products.slice(index + 1)] }))
  }

  function addOccasion() {
    edit((current) => ({ ...current, occasions: [...current.occasions, `Occasion ${current.occasions.length + 1}`] }))
  }

  async function uploadCatalogImage(file: File) {
    const contentType = catalogImageMimeTypeForFile(file)
    if (!contentType) throw new Error("INVALID_IMAGE_TYPE")
    if (file.size <= 0 || file.size > validation.catalogImageMaxBytes) throw new Error("IMAGE_TOO_LARGE")

    const initResponse = await fetch(routes.api.adminCatalogImageUpload, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType, totalBytes: file.size })
    })
    const init = await initResponse.json() as { ok?: boolean; uploadId?: string; chunkSize?: number; error?: string }
    if (!initResponse.ok || !init.ok || !init.uploadId || !init.chunkSize) throw new Error(init.error || "IMAGE_UPLOAD_FAILED")

    const uploadId = init.uploadId
    try {
      for (let offset = 0; offset < file.size; offset += init.chunkSize) {
        const end = Math.min(file.size, offset + init.chunkSize)
        const body = file.slice(offset, end, contentType)
        let uploaded = false
        let lastError = "IMAGE_UPLOAD_FAILED"

        for (let attempt = 0; attempt < 3 && !uploaded; attempt += 1) {
          try {
            const response = await fetch(`${routes.api.adminCatalogImageUpload}?uploadId=${encodeURIComponent(uploadId)}`, {
              method: "PUT",
              headers: { "Content-Type": "application/octet-stream", "X-Upload-Offset": String(offset) },
              body
            })
            const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string }
            if (response.ok && result.ok) {
              uploaded = true
              break
            }
            lastError = result.error || "IMAGE_UPLOAD_FAILED"
            if (response.status < 500 && response.status !== 429) break
          } catch {
            lastError = "IMAGE_UPLOAD_FAILED"
          }
          if (!uploaded && attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 300 * (attempt + 1)))
        }
        if (!uploaded) throw new Error(lastError)
      }

      const completeResponse = await fetch(routes.api.adminCatalogImageUpload, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId })
      })
      const completed = await completeResponse.json() as { ok?: boolean; imageUrl?: string; error?: string }
      if (!completeResponse.ok || !completed.ok || !completed.imageUrl) throw new Error(completed.error || "IMAGE_VERIFY_FAILED")
      return completed.imageUrl
    } catch (error) {
      fetch(routes.api.adminCatalogImageUpload, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId })
      }).catch(() => {})
      throw error
    }
  }

  async function uploadImages(files: FileList | File[], productIndex: number) {
    const product = catalog.products[productIndex]
    const existing = productImages(product)
    const selected = Array.from(files)
    if (!selected.length) return
    if (existing.length + selected.length > validation.catalog.maxImages) throw new Error(`Maximum ${validation.catalog.maxImages} images per product.`)

    setBusy(`image-${productIndex}`)
    setError("")
    try {
      const next: ProductImage[] = [...existing]
      for (const file of selected) {
        const url = await uploadCatalogImage(file)
        next.push({ url, alt: product.name })
      }
      replaceProduct(productIndex, { images: next, imageUrl: next[0]?.url })
      setNotice(`${selected.length} image${selected.length === 1 ? "" : "s"} uploaded. Reorder if needed, then Publish live.`)
    } finally {
      setBusy("")
    }
  }

  function replaceProductImages(productIndex: number, images: ProductImage[]) {
    const next = images.slice(0, validation.catalog.maxImages)
    replaceProduct(productIndex, { images: next, imageUrl: next[0]?.url })
  }

  function removeProductImage(productIndex: number, imageIndex: number) {
    replaceProductImages(productIndex, productImages(catalog.products[productIndex]).filter((_, index) => index !== imageIndex))
  }

  function moveProductImage(productIndex: number, from: number, to: number) {
    replaceProductImages(productIndex, moveItem(productImages(catalog.products[productIndex]), from, to))
  }

  function validateCatalogBeforeSave() {
    const invalidPrice = catalog.products.find((product) => product.sellIndividually && !product.salePricePaise)
    if (invalidPrice) {
      setError(`${invalidPrice.name}: individual sale ke liye price ₹1 ya usse zyada enter karein.`)
      return false
    }

    for (const product of catalog.products.filter((item) => item.prepackagedRetail)) {
      const r = product.retail
      if (!r?.genericName || !r.netQuantity || !r.mrpPaise || !r.manufacturerOrPackerName || !r.manufacturerOrPackerAddress || !r.countryOfOrigin || !r.consumerCare) {
        setError(`${product.name}: packaged retail declarations incomplete hain. Package label se required fields fill karein.`)
        return false
      }
      if (r.countryOfOrigin.trim().toLowerCase() !== "india" && (!r.importerName || !r.importerAddress)) {
        setError(`${product.name}: imported product ke liye importer name + address required hai.`)
        return false
      }
      if (product.sellIndividually && product.salePricePaise && r.mrpPaise && product.salePricePaise > r.mrpPaise) {
        setError(`${product.name}: sale price MRP se zyada nahi ho sakta.`)
        return false
      }
    }
    return true
  }

  async function saveDraft() {
    if (!validateCatalogBeforeSave()) return
    setBusy("save")
    setNotice("")
    setError("")
    try {
      const response = await fetch("/api/admin/catalog", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalog, version }) })
      const data = await response.json() as AdminCatalogPayload
      if (!response.ok || !data.ok || !data.catalog) throw new Error(data.error || "CATALOG_DRAFT_SAVE_FAILED")
      applyPayload(data)
      setNotice("Draft saved. Public website unchanged hai.")
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "CATALOG_DRAFT_SAVE_FAILED"
      setError(code === "SALE_PRICE_REQUIRED" ? "Individual sale enabled products ke liye sale price required hai." : code === "INVALID_SALE_PRICE" ? `Sale price ₹1 se ₹${validation.catalog.maxPrice} tak, maximum two decimals hona chahiye.` : code)
    } finally { setBusy("") }
  }

  async function saveAndPublish() {
    if ((!dirty && !hasDraft) || !validateCatalogBeforeSave()) return
    setBusy("publish-live")
    setNotice("")
    setError("")
    try {
      if (dirty) {
        const response = await fetch("/api/admin/catalog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalog, version }) })
        const saved = await response.json() as AdminCatalogPayload
        if (!response.ok || !saved.ok || !saved.catalog) throw new Error(saved.error || "CATALOG_LIVE_SAVE_FAILED")
        applyPayload(saved)
        setNotice(`Saved live to database. Storefront is now using catalog v${saved.version}; no deployment is required.`)
        return
      }

      const publishResponse = await fetch("/api/admin/catalog/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version }) })
      const published = await publishResponse.json() as AdminCatalogPayload
      if (!publishResponse.ok || !published.ok || !published.catalog) throw new Error(published.error || "CATALOG_PUBLISH_FAILED")
      applyPayload(published)
      setNotice(`Saved draft published to database as catalog v${published.version}; no deployment is required.`)
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "CATALOG_LIVE_SAVE_FAILED"
      setError(code === "SALE_PRICE_REQUIRED" ? "Individual sale enabled products ke liye sale price required hai." : code)
    } finally { setBusy("") }
  }

  async function discardDraft() {
    if (!hasDraft || !window.confirm("Saved draft discard karke live catalog par wapas jana hai?")) return
    setBusy("discard")
    setNotice("")
    setError("")
    try {
      const response = await fetch("/api/admin/catalog", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version }) })
      const data = await response.json() as AdminCatalogPayload
      if (!response.ok || !data.ok || !data.catalog) throw new Error(data.error || "CATALOG_DRAFT_DISCARD_FAILED")
      applyPayload(data)
      setNotice("Draft discarded. Editor live catalog par reset ho gaya.")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CATALOG_DRAFT_DISCARD_FAILED")
    } finally { setBusy("") }
  }

  async function bulkImport(file: File) {
    if (file.size > 2 * 1024 * 1024) { setError("Bulk file 2 MB se chhoti rakhein."); return }
    setBusy("import")
    setError("")
    setNotice("")
    try {
      const rows = importedRows(file.name, await file.text())
      if (!rows.length) throw new Error("File me koi product nahi mila.")
      const existingById = new Map(catalog.products.map((product) => [product.id, product]))
      const imported = rows.map((raw, index) => {
        const normalized = normalizeImportRecord(raw)
        const rawId = slug(importText(normalized.id ?? normalized.sku))
        return productFromImport(raw, rawId ? existingById.get(rawId) : undefined, catalog, index + 2)
      })
      const importedById = new Map(imported.map((product) => [product.id, product]))
      const updatedIds = new Set(catalog.products.filter((product) => importedById.has(product.id)).map((product) => product.id))
      const nextProducts = catalog.products.map((product) => importedById.get(product.id) || product)
      for (const product of imported) if (!updatedIds.has(product.id)) nextProducts.push(product)
      edit((current) => ({ ...current, products: nextProducts }))
      setNotice(`${imported.length} products loaded (${updatedIds.size} updated, ${imported.length - updatedIds.size} new). Save live dabate hi database update hoga; deployment nahi chahiye.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "BULK_IMPORT_FAILED")
    } finally {
      setBusy("")
    }
  }

  function downloadCsvTemplate() {
    const csv = [
      "id,name,category,minTier,points,note,description,highlights,badge,imageUrls,active,sellIndividually,salePrice,prepackagedRetail,genericName,netQuantity,mrp,countryOfOrigin,manufacturerOrPackerName,manufacturerOrPackerAddress,importerName,importerAddress,consumerCare,bestBefore,unitSalePrice,warrantyOrGuarantee",
      "sample-necklace,Sample Necklace,Jewelry,499,2,Premium everyday necklace,Detailed product description,Premium finish|Gift-ready|Daily wear,Bestseller,https://example.com/1.webp|https://example.com/2.webp,true,true,799,true,Necklace,1 N,999,India,Example Manufacturer,Exact package address,,,care@example.com,,,Manufacturer warranty if applicable"
    ].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "celebration-products-template.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const title = section === "tiers" ? "Hampers & budgets" : section === "products" ? "Products / objects" : "Occasions & defaults"
  const description = section === "tiers" ? "Budget tiers, box size aur selection limits control karein." : section === "products" ? "Items, images, hamper eligibility aur individual sale prices manage karein." : "Occasions aur builder defaults manage karein."

  return (
    <section className="adminWorkspaceCard">
      <div className="adminWorkspaceHead adminCatalogHeader">
        <div><div className="kicker">CATALOG</div><h2>{title}</h2><p>{description}</p></div>
        <div className="adminActions adminCatalogActions">
          <button className="secondary" type="button" onClick={() => { if (!dirty || window.confirm("Unsaved edits discard karne hain?")) load().catch((caught) => setError(String(caught))) }}>Reload</button>
          {hasDraft && <a className="secondary" href="/admin/catalog-preview" target="_blank" rel="noreferrer">Preview</a>}
          {hasDraft && <button className="secondary danger" type="button" onClick={discardDraft} disabled={Boolean(busy)}>Discard</button>}
          <button className="secondary" type="button" onClick={saveDraft} disabled={Boolean(busy) || !dirty}>{busy === "save" ? "Saving…" : "Save draft"}</button>
          <button className="primary adminPublishLive" type="button" onClick={saveAndPublish} disabled={Boolean(busy) || (!dirty && !hasDraft)}>{busy === "publish-live" ? "Saving live…" : "Save live"}</button>
        </div>
      </div>
      {dirty && <div className="adminDraftNotice"><b>Changes ready</b> • Save live directly database update karega; code deployment required nahi hai. Storefront abhi v{version} par hai.</div>}
      {!dirty && hasDraft && <div className="adminDraftNotice"><b>Saved draft ready</b> • Save live dabate hi database publish hoga; deployment nahi lagega.{draftUpdatedAt ? ` Draft saved ${new Date(draftUpdatedAt).toLocaleString("en-IN")}.` : ""}</div>}
      {!dirty && !hasDraft && <div className="adminDraftNotice"><b>Live database catalog v{version}</b> • Edit ya bulk upload karein, phir Save live. Storefront latest DB catalog directly read karta hai.</div>}
      {notice && <div className="successBox adminFeedback">{notice}</div>}
      {error && <div className="errorBox adminFeedback">{error}</div>}

      {section === "tiers" && <>
        <div className="adminBulkBar"><span>{catalog.tiers.length} hamper tiers</span><button type="button" className="secondary" onClick={() => edit((current) => ({ ...current, tiers: current.tiers.map((item) => ({ ...item, active: true })) }))}>Activate all</button><button type="button" className="secondary" onClick={() => edit((current) => ({ ...current, tiers: current.tiers.map((item, index) => ({ ...item, active: item.id === current.settings.defaultTierId || index === 0 })) }))}>Pause non-default</button><button type="button" className="primary" onClick={addTier}>+ Add hamper</button></div>
        <div className="adminEditorList">{catalog.tiers.map((tier, index) => <div className="adminEditorCard adminDraggableCard" draggable key={`${tier.id}-${index}`} onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) edit((current) => ({ ...current, tiers: moveItem(current.tiers, dragIndex, index) })); setDragIndex(null) }}>
          <div className="adminCardHandle">⋮⋮ <span>Drag to reorder</span></div>
          <div className="adminEditorGrid">
            <label>ID<input value={tier.id} onChange={(e) => replaceTier(index, { id: slug(e.target.value) })} /></label><label>Name<input value={tier.name} onChange={(e) => replaceTier(index, { name: e.target.value })} /></label><label>Price ₹<input type="number" min={1} value={tier.price} onChange={(e) => replaceTier(index, { price: Number(e.target.value) })} /></label><label>Size<input value={tier.size} onChange={(e) => replaceTier(index, { size: e.target.value })} /></label><label>Max items<input type="number" min={1} value={tier.maxChoices} onChange={(e) => replaceTier(index, { maxChoices: Number(e.target.value) })} /></label><label>Mix points<input type="number" min={1} value={tier.pointBudget} onChange={(e) => replaceTier(index, { pointBudget: Number(e.target.value) })} /></label><label>Badge<input value={tier.label || ""} onChange={(e) => replaceTier(index, { label: e.target.value })} /></label><label className="adminCheck"><input type="checkbox" checked={tier.active !== false} onChange={(e) => replaceTier(index, { active: e.target.checked })} /> Active</label>
          </div>
          <div className="adminEditorActions"><span>{formatMoney(tier.price)}</span><div><button type="button" className="secondary" disabled={index === 0} onClick={() => edit((current) => ({ ...current, tiers: moveItem(current.tiers, index, index - 1) }))}>↑</button><button type="button" className="secondary" disabled={index === catalog.tiers.length - 1} onClick={() => edit((current) => ({ ...current, tiers: moveItem(current.tiers, index, index + 1) }))}>↓</button><button type="button" className="secondary" onClick={() => duplicateTier(index)}>Duplicate</button><button type="button" className="secondary danger" onClick={() => edit((current) => ({ ...current, tiers: current.tiers.filter((_, i) => i !== index) }))}>Delete</button></div></div>
        </div>)}</div>
      </>}

      {section === "products" && <>
        <div className="adminCatalogSimpleTools">
          <div><b>Bulk catalogue</b><span>CSV ya JSON upload karein. Same ID mile to product update hoga, new ID mile to add hoga.</span></div>
          <div className="adminCatalogToolButtons">
            <button type="button" className="secondary" onClick={downloadCsvTemplate}>CSV template</button>
            <label className="secondary adminBulkFileButton">{busy === "import" ? "Importing…" : "Bulk upload"}<input type="file" accept=".csv,.json,text/csv,application/json" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) bulkImport(file); event.currentTarget.value = "" }} /></label>
          </div>
        </div>
        <div className="adminBulkBar"><span>{catalog.products.length} products</span><button type="button" className="secondary" onClick={() => edit((current) => ({ ...current, products: current.products.map((item) => ({ ...item, active: true })) }))}>Activate all</button><button type="button" className="secondary" onClick={() => edit((current) => ({ ...current, products: current.products.map((item) => ({ ...item, active: false })) }))}>Pause all</button><button type="button" className="primary" onClick={addProduct}>+ Add product</button></div>
        <div className="adminEditorList">{catalog.products.map((product, index) => {
          const gallery = productImages(product)
          const primaryImage = primaryProductImage(product)
          const imageKey = `${product.id}:${primaryImage?.url || ""}`
          const imageBroken = brokenImages[imageKey] === true
          return <div className="adminEditorCard adminDraggableCard adminProductEditorCard" draggable key={`${product.id}-${index}`} onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) edit((current) => ({ ...current, products: moveItem(current.products, dragIndex, index) })); setDragIndex(null) }}>
          <div className="adminCardHandle">⋮⋮ <span>Drag to reorder</span></div>
          <div className="adminProductMediaRow">
            <div className="adminProductMediaFrame">
              {primaryImage && !imageBroken ? <img key={primaryImage.url} className="adminCatalogPreview" src={primaryImage.url} alt={primaryImage.alt || product.name} loading="lazy" referrerPolicy="no-referrer" onError={() => setBrokenImages((current) => ({ ...current, [imageKey]: true }))} /> : <div className="adminProductImageFallback"><span>{product.icon || "🎁"}</span><small>{primaryImage ? "Image unavailable" : "No image"}</small></div>}
            </div>
            <div className="adminProductMediaCopy"><b>{product.name}</b><span>{gallery.length ? (imageBroken ? "Primary image load nahi ho rahi. Re-upload ya URL check karein." : `${gallery.length} product image${gallery.length === 1 ? "" : "s"} ready • first image = primary card image`) : "Multiple product images upload karein. First image collection/cart me dikhegi."}</span></div>
          </div>
          {gallery.length > 0 && <div className="adminProductGalleryEditor">{gallery.map((image, imageIndex) => <div className="adminProductGalleryItem" key={image.url}>
            <img src={image.url} alt="" loading="lazy" referrerPolicy="no-referrer" />
            <span>{imageIndex === 0 ? "Primary" : `Image ${imageIndex + 1}`}</span>
            <div><button type="button" className="secondary" disabled={imageIndex === 0} onClick={() => moveProductImage(index, imageIndex, imageIndex - 1)}>←</button><button type="button" className="secondary" disabled={imageIndex === gallery.length - 1} onClick={() => moveProductImage(index, imageIndex, imageIndex + 1)}>→</button><button type="button" className="secondary danger" onClick={() => removeProductImage(index, imageIndex)}>Remove</button></div>
          </div>)}</div>}
          <div className="adminEditorGrid"><label>ID<input value={product.id} onChange={(e) => replaceProduct(index, { id: slug(e.target.value) })} /></label><label>Name<input value={product.name} onChange={(e) => replaceProduct(index, { name: e.target.value })} /></label><label>Category<input value={product.category} onChange={(e) => replaceProduct(index, { category: e.target.value })} /></label><label>Hamper minimum ₹<input type="number" min={0} value={product.minTier} onChange={(e) => replaceProduct(index, { minTier: Number(e.target.value) })} /></label><label>Points<input type="number" min={1} value={product.points} onChange={(e) => replaceProduct(index, { points: Number(e.target.value) })} /></label><label>Badge / label<input value={product.badge || ""} maxLength={validation.catalog.badgeMax} onChange={(e) => replaceProduct(index, { badge: e.target.value || undefined })} placeholder="Bestseller / New / Limited" /></label><label>Emoji / icon<input value={product.icon || ""} onChange={(e) => replaceProduct(index, { icon: e.target.value })} /></label><label className="adminCheck"><input type="checkbox" checked={product.active !== false} onChange={(e) => replaceProduct(index, { active: e.target.checked })} /> Active</label><label className="adminWide">Short card summary<input value={product.note} maxLength={validation.catalog.noteMax} onChange={(e) => replaceProduct(index, { note: e.target.value })} placeholder="Short line shown on collection cards" /></label><label className="adminWide">Full product description<textarea rows={5} value={product.description || ""} maxLength={validation.catalog.descriptionMax} onChange={(e) => replaceProduct(index, { description: e.target.value || undefined })} placeholder="Detailed product information shown after opening the product." /></label><label className="adminWide">Highlights — one per line<textarea rows={4} value={(product.highlights || []).join("\n")} onChange={(e) => replaceProduct(index, { highlights: e.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, validation.catalog.maxHighlights) })} placeholder={"Premium finish\nGift-ready presentation\nComfortable for daily wear"} /></label><label className="adminWide">Gallery image URLs — one per line<textarea rows={4} value={gallery.map((image) => image.url).join("\n")} onChange={(e) => { const urls=e.target.value.split(/\r?\n/).map((item)=>item.trim()).filter(Boolean).slice(0,validation.catalog.maxImages); replaceProductImages(index, urls.map((url) => ({ url, alt: product.name }))) }} placeholder="https://… or use upload below" /></label><label className="adminWide uploadControl">{busy === `image-${index}` ? "Uploading images…" : `Upload product images (max ${validation.catalog.maxImages})`}<input type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={Boolean(busy)} onChange={(e) => { const files = e.target.files; if (files?.length) uploadImages(files, index).catch((caught) => setError(caught instanceof Error ? caught.message : "IMAGE_UPLOAD_FAILED")); e.currentTarget.value = "" }} /></label></div>
          <div className="adminEditorGrid">
            <label>Individual sale price ₹<input type="number" min="1" max={Math.min(validation.catalog.maxPrice, 21474836.47)} step="0.01" inputMode="decimal" value={product.salePricePaise === undefined ? "" : product.salePricePaise / 100} placeholder="Enter actual sale price" onChange={(event) => {
              const value = event.target.value
              const amount = salePriceFromRupees(value)
              if (value && amount === undefined) { setError(`Sale price ₹1 se ₹${validation.catalog.maxPrice} tak, maximum two decimals hona chahiye.`); return }
              setError("")
              replaceProduct(index, { salePricePaise: amount })
            }} /></label>
            <label className="adminCheck"><input type="checkbox" checked={product.sellIndividually === true} onChange={(event) => replaceProduct(index, { sellIndividually: event.target.checked })} /> Sell individually without a hamper</label>
            <label>Available stock<input type="number" min="0" max="10000" step="1" inputMode="numeric" disabled={!product.sellIndividually || busy === `stock-${index}`} value={product.stockAvailable ?? 0} onChange={(event) => replaceStockLocal(index, Math.max(0, Math.min(10000, Number(event.target.value) || 0)))} /></label>
            <button className="secondary" type="button" disabled={!product.sellIndividually || busy === `stock-${index}`} onClick={() => void saveStock(index)}>{busy === `stock-${index}` ? "Saving stock…" : "Save stock"}</button>
          </div>
          <details className="adminOrderDetails">
            <summary>Retail declarations / Legal Metrology</summary>
            <div className="adminEditorGrid">
              <label className="adminCheck"><input type="checkbox" checked={product.prepackagedRetail === true} onChange={(event) => replaceProduct(index, { prepackagedRetail: event.target.checked })} /> Pre-packaged retail product — online declarations apply</label>
              <label>Generic name<input value={product.retail?.genericName || ""} onChange={(event) => replaceRetail(index, { genericName: event.target.value || undefined })} placeholder="As printed / applicable" /></label>
              <label>Net quantity<input value={product.retail?.netQuantity || ""} onChange={(event) => replaceRetail(index, { netQuantity: event.target.value || undefined })} placeholder="e.g. 1 N / 100 g / 50 ml" /></label>
              <label>MRP ₹ (incl. taxes)<input type="number" min="0.01" step="0.01" value={product.retail?.mrpPaise ? product.retail.mrpPaise / 100 : ""} onChange={(event) => { const v=event.target.value; replaceRetail(index,{mrpPaise:v ? salePriceFromRupees(v) : undefined}) }} /></label>
              <label>Country of origin<input value={product.retail?.countryOfOrigin || ""} onChange={(event) => replaceRetail(index, { countryOfOrigin: event.target.value || undefined })} placeholder="India / actual origin" /></label>
              <label>Manufacturer / packer name<input value={product.retail?.manufacturerOrPackerName || ""} onChange={(event) => replaceRetail(index, { manufacturerOrPackerName: event.target.value || undefined })} /></label>
              <label className="adminWide">Manufacturer / packer address<textarea rows={2} value={product.retail?.manufacturerOrPackerAddress || ""} onChange={(event) => replaceRetail(index, { manufacturerOrPackerAddress: event.target.value || undefined })} /></label>
              <label>Importer name (if imported)<input value={product.retail?.importerName || ""} onChange={(event) => replaceRetail(index, { importerName: event.target.value || undefined })} /></label>
              <label className="adminWide">Importer address (if imported)<textarea rows={2} value={product.retail?.importerAddress || ""} onChange={(event) => replaceRetail(index, { importerAddress: event.target.value || undefined })} /></label>
              <label className="adminWide">Consumer care details<input value={product.retail?.consumerCare || ""} onChange={(event) => replaceRetail(index, { consumerCare: event.target.value || undefined })} placeholder="Phone/email/address as applicable" /></label>
              <label>Best/use before (where applicable)<input value={product.retail?.bestBefore || ""} onChange={(event) => replaceRetail(index, { bestBefore: event.target.value || undefined })} /></label>
              <label>Unit sale price (where applicable)<input value={product.retail?.unitSalePrice || ""} onChange={(event) => replaceRetail(index, { unitSalePrice: event.target.value || undefined })} placeholder="As applicable to package" /></label>
              <label className="adminWide">Warranty / guarantee (where applicable)<input value={product.retail?.warrantyOrGuarantee || ""} onChange={(event) => replaceRetail(index, { warrantyOrGuarantee: event.target.value || undefined })} placeholder="e.g. 6-month manufacturer warranty / No manufacturer warranty" /></label>
            </div>
            <small>Values package/label se exactly copy karein. Imported goods me importer + country of origin fill karein. Best/use-before, unit sale price aur warranty/guarantee commodity ke hisaab se applicable ho sakte hain.</small>
          </details>
          <div className="adminEditorActions"><span>{product.category}</span><div><button type="button" className="secondary" disabled={index === 0} onClick={() => edit((current) => ({ ...current, products: moveItem(current.products, index, index - 1) }))}>↑</button><button type="button" className="secondary" disabled={index === catalog.products.length - 1} onClick={() => edit((current) => ({ ...current, products: moveItem(current.products, index, index + 1) }))}>↓</button><button type="button" className="secondary" onClick={() => duplicateProduct(index)}>Duplicate</button><button type="button" className="secondary danger" onClick={() => edit((current) => ({ ...current, products: current.products.filter((_, i) => i !== index) }))}>Delete</button></div></div>
        </div>})}</div>
      </>}

      {section === "occasions" && <>
        <div className="adminEditorGrid adminDefaultsGrid"><label>Default hamper<select value={catalog.settings.defaultTierId} onChange={(e) => edit((current) => ({ ...current, settings: { ...current.settings, defaultTierId: e.target.value } }))}>{catalog.tiers.filter((item) => item.active !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Default occasion<select value={catalog.settings.defaultOccasion} onChange={(e) => edit((current) => ({ ...current, settings: { ...current.settings, defaultOccasion: e.target.value } }))}>{catalog.occasions.map((item) => <option key={item}>{item}</option>)}</select></label><label>All-category label<input value={catalog.settings.allCategory.label} onChange={(e) => edit((current) => ({ ...current, settings: { ...current.settings, allCategory: { ...current.settings.allCategory, label: e.target.value } } }))} /></label></div>
        <div className="adminEditorList compact">{catalog.occasions.map((occasion, index) => <div className="adminOccasionRow" key={`${occasion}-${index}`}><input value={occasion} onChange={(e) => edit((current) => ({ ...current, occasions: current.occasions.map((item, i) => i === index ? e.target.value : item) }))} /><div><button type="button" className="secondary" disabled={index === 0} onClick={() => edit((current) => ({ ...current, occasions: moveItem(current.occasions, index, index - 1) }))}>↑</button><button type="button" className="secondary" disabled={index === catalog.occasions.length - 1} onClick={() => edit((current) => ({ ...current, occasions: moveItem(current.occasions, index, index + 1) }))}>↓</button><button type="button" className="secondary danger" onClick={() => edit((current) => ({ ...current, occasions: current.occasions.filter((_, i) => i !== index) }))}>Delete</button></div></div>)}</div>
        <button type="button" className="primary" onClick={addOccasion}>+ Add occasion</button>
      </>}
    </section>
  )
}
