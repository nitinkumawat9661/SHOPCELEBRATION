import type { SelfBuildVisualCategory, SelfBuildVisualData } from "../server/self-build-preview"

// Safe, presentation-only projection of published category and variant labels.
// No product/SKU IDs, inventory quantities, budgets or per-piece prices.
export type SelfBuildGiftChoice = {
  key: string
  label: string
  kind: "category" | "photo" | "option"
  groupLabel: string
}
export type SelfBuildGiftSection = {
  id: string
  label: string
  choices: SelfBuildGiftChoice[]
}
const ordered = <T extends { displayOrder: number; label: string }>(items:T[]) =>
  [...items].sort((a,b)=>a.displayOrder-b.displayOrder||a.label.localeCompare(b.label))

export function buildSelfBuildGiftSections(data: SelfBuildVisualData): SelfBuildGiftSection[] {
  const categories=ordered(data.categories.filter(c=>c.selectionKind!=="notes"))
  const options=ordered(data.options)
  const byId=new Map(categories.map(c=>[c.id,c]))
  const children=new Map<string,SelfBuildVisualCategory[]>()
  for(const category of categories)if(category.parentId && byId.has(category.parentId)){
    const current=children.get(category.parentId)||[]
    current.push(category)
    children.set(category.parentId,current)
  }
  const visited=new Set<string>()
  const makeSection=(root:SelfBuildVisualCategory):SelfBuildGiftSection=>{
    const choices:SelfBuildGiftChoice[]=[]
    const walk=(category:SelfBuildVisualCategory,parents:string[])=>{
      if(visited.has(category.id))return
      visited.add(category.id)
      const groupLabel=parents.join(" · ")
      if(category.selectionKind==="category"||category.selectionKind==="photo"){
        choices.push({key:`category:${category.id}`,label:category.label,
          kind:category.selectionKind,groupLabel})
      }
      if(category.selectionKind==="variant"){
        for(const option of options.filter(o=>o.categoryId===category.id)){
          choices.push({key:`option:${option.id}`,label:option.label,
            kind:"option",groupLabel:[...parents,category.label].join(" · ")})
        }
      }
      for(const child of children.get(category.id)||[])walk(child,[...parents,category.label])
    }
    walk(root,[])
    return {id:root.id,label:root.label,choices}
  }
  // Top-level roots supply clear "Jewellery", "Chocolates", "Snacks",
  // "Teddys", etc. headings from the live self-build admin catalogue.
  const roots=categories.filter(c=>!c.parentId||!byId.has(c.parentId))
  const sections=roots.map(makeSection)
  // Defensive: keep even misconfigured/orphaned categories discoverable.
  for(const category of categories)if(!visited.has(category.id))sections.push(makeSection(category))
  // Standalone legacy "Bangles" duplicates the already-available Korean /
  // Viral Bangles in Jewellery. Keep its DB record and pricing untouched; only
  // hide this redundant presentation section when Jewellery actually contains
  // bangle choices. If Jewellery is inactive, preserve standalone Bangles.
  const jewellery=sections.find(section=>section.id==="jewellery")
  const jewelleryHasBangles=jewellery?.choices.some(choice=>/\bbangles?\b/i.test(choice.label))??false
  return sections.filter(section=>section.choices.length>0 &&
    !(jewelleryHasBangles && section.id==="bangles"))
}
