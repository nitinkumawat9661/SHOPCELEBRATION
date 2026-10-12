import { getSelfBuildAdminState } from "./self-build-admin"

// Customer-safe visual contract: an explicit allowlist. NEVER pass admin state,
// config, budget contribution fields, pricing formulas or SKU metadata to a
// Client Component or a public URL. The preview is admin-authenticated as well.
export type SelfBuildVisualCategory = {
  id: string
  parentId: string | null
  label: string
  selectionKind: "group" | "category" | "variant" | "photo" | "notes"
  displayOrder: number
}
export type SelfBuildVisualOption = {
  id: string
  categoryId: string
  label: string
  displayOrder: number
}
export type SelfBuildVisualData = {
  categories: SelfBuildVisualCategory[]
  options: SelfBuildVisualOption[]
  requestPrompt: string
}

export function toSelfBuildVisualData(state: Awaited<ReturnType<typeof getSelfBuildAdminState>>): SelfBuildVisualData {
  const active = state.categories.filter(item => item.active)
  const allActive = new Set(active.map(item => item.id))
  const visible = active.filter(item => item.parentId === null || allActive.has(item.parentId))
  const available = new Set(visible.map(item => item.id))
  return {
    categories: visible.map(item => ({
      id: item.id,
      parentId: item.parentId,
      label: item.label,
      selectionKind: item.selectionKind,
      displayOrder: item.displayOrder
    })),
    options: state.options.filter(item => item.active && available.has(item.categoryId)).map(item => ({
      id: item.id,
      categoryId: item.categoryId,
      label: item.label,
      displayOrder: item.displayOrder
    })),
    requestPrompt: state.config.otherRequestPrompt
  }
}

export async function getSelfBuildVisualData(): Promise<SelfBuildVisualData> {
  return toSelfBuildVisualData(await getSelfBuildAdminState())
}
