import type { SelfBuildAdminState } from "./self-build-admin"
import type { SelfBuildCapacityState } from "./self-build-capacity"

// PRIVATE server-only readiness calculation, not customer quotation or checkout.
// Values reflect *category-level* fulfilment, never individual retail SKUs.
// Never serialize internalSpentPaise or allowancePaise to a buyer response.
// A future purchase must recheck under a transaction and reserve capacity.
export type SelfBuildSelection = { kind: "category" | "option"; id: string; quantity: number }
export type PrivateBudgetResult = {
  ok: boolean
  code: string
  tierId: string
  internalSpentPaise: number
  allowancePaise: number
}

const ID = /^[a-z0-9][a-z0-9-]{0,59}$/
const MAX_TOTAL = 2_147_483_647

function reject(code: string, tierId: string, budget: number): PrivateBudgetResult {
  return { ok:false,code,tierId,internalSpentPaise:0,allowancePaise:budget }
}

export function evaluateSelfBuildBudget(
  tierId: string,
  selections: SelfBuildSelection[],
  rules: SelfBuildAdminState,
  capacity: SelfBuildCapacityState
): PrivateBudgetResult {
  // No trust in a posted tier budget, posted price or product SKU.
  if (typeof tierId!=="string" || !ID.test(tierId) || !Array.isArray(selections) ||
      selections.length===0 || selections.length>200) return reject("INVALID_SELECTION",String(tierId),0)
  if (rules.version!==capacity.settingsVersion)return reject("STALE_SELF_BUILD_RULES",tierId,0)
  const tier=capacity.tiers.find(t=>t.id===tierId)
  if(!tier||!tier.enabled||!Number.isSafeInteger(tier.allowancePaise)||tier.allowancePaise<=0)
    return reject("TIER_NOT_CONFIGURED",tierId,0)
  const budget=tier.allowancePaise
  const cats=new Map(rules.categories.map(x=>[x.id,x]))
  const opts=new Map(rules.options.map(x=>[x.id,x]))
  const catStock=new Map(capacity.categories.map(x=>[x.id,x]))
  const optStock=new Map(capacity.options.map(x=>[x.id,x]))
  const seen=new Set<string>()
  let spent=0
  for(const selection of selections){
    if (!selection || typeof selection!=="object" ||
        (selection.kind!=="category"&&selection.kind!=="option") ||
        typeof selection.id!=="string"||!ID.test(selection.id) ||
        !Number.isSafeInteger(selection.quantity)||selection.quantity<1||selection.quantity>1_000_000)
      return reject("INVALID_SELECTION",tierId,budget)
    const key=selection.kind+":"+selection.id
    if(seen.has(key))return reject("DUPLICATE_SELECTION",tierId,budget)
    seen.add(key)
    if(!rules.config.allowMultipleQuantities && selection.quantity>1)
      return reject("MULTIPLE_QUANTITIES_DISABLED",tierId,budget)

    let unit:number|null|undefined
    let stock:{availableUnits:number;reservedUnits:number;verified:boolean;active:boolean}|undefined
    if(selection.kind==="category"){
      const cat=cats.get(selection.id)
      if(!cat||!cat.active||(cat.selectionKind!=="category"&&cat.selectionKind!=="photo"))
        return reject("CATEGORY_UNAVAILABLE",tierId,budget)
      if(cat.parentId && !cats.get(cat.parentId)?.active)
        return reject("CATEGORY_UNAVAILABLE",tierId,budget)
      if(cat.chargeMode!=="per_unit" && cat.chargeMode!=="once_per_category")
        return reject("INVALID_CHARGE_MODE",tierId,budget)
      unit=cat.unitBudgetPaise
      stock=catStock.get(cat.id)
      if(cat.chargeMode==="once_per_category")unit=selection.quantity>0?unit:0
      else if(unit!==null&&unit!==undefined)unit*=selection.quantity
    } else {
      const opt=opts.get(selection.id)
      const parent=opt&&cats.get(opt.categoryId)
      if(!opt||!opt.active||!parent||!parent.active||parent.selectionKind!=="variant")
        return reject("OPTION_UNAVAILABLE",tierId,budget)
      unit=opt.unitBudgetPaise*selection.quantity
      stock=optStock.get(opt.id)
    }
    if(!stock||!stock.active||!stock.verified ||
       !Number.isSafeInteger(stock.availableUnits) || !Number.isSafeInteger(stock.reservedUnits) ||
       stock.availableUnits-stock.reservedUnits < selection.quantity)
      return reject("INSUFFICIENT_VERIFIED_CATEGORY_CAPACITY",tierId,budget)
    if(unit===null||unit===undefined||!Number.isSafeInteger(unit)||unit<0||unit>MAX_TOTAL ||
       spent>MAX_TOTAL-unit)return reject("INVALID_INTERNAL_BUDGET",tierId,budget)
    spent+=unit
    if(spent>budget)return reject("TIER_BUDGET_EXCEEDED",tierId,budget)
  }
  // Internal spent amount is server-only; never use this return object in a
  // customer JSON response or HTML. This is not a payment authorization.
  return {ok:true,code:"WITHIN_PRIVATE_BUDGET",tierId,internalSpentPaise:spent,allowancePaise:budget}
}
