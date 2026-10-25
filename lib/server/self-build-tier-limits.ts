// Private Self-Build hamper budget policy (never expose as client props).
// Owner reserves 20% of the pre-delivery hamper tier price for the box and
// packaging. Gift target remains 80% (standard) or 75% (₹1,299+), with
// a strict 80% spend ceiling for both so packaging reserve cannot be spent
// on gift selections. Larger hampers retain up to 5 points of flexibility.
// No artificial minimum spend, product SKU mapping,
// inventory availability, or quantity-on-hand check is part of this policy.
// The published catalog price/maxChoices are the only inputs: changing the
// price recomputes the allowance automatically with no admin stock work.
export type SelfBuildTierLimits = {
  targetPaise: number
  ceilingPaise: number
  maxItems: number
  targetPercent: 80 | 75
  ceilingPercent: 80
}

export function getSelfBuildTierLimits(tier:{
  price:number;maxChoices:number;active?:boolean
}):SelfBuildTierLimits {
  if(tier.active===false||!Number.isFinite(tier.price)||tier.price<=0||
      !Number.isSafeInteger(tier.maxChoices)||tier.maxChoices<1||tier.maxChoices>100)
    throw Error("SELF_BUILD_TIER_INVALID")
  const sellingPricePaise=Math.round(tier.price*100)
  if(!Number.isSafeInteger(sellingPricePaise)||sellingPricePaise<=0)
    throw Error("SELF_BUILD_TIER_INVALID")
  const larger=sellingPricePaise>=129900
  const targetPercent=larger?75:80
  const ceilingPercent=80
  return {
    targetPaise:Math.floor(sellingPricePaise*targetPercent/100),
    ceilingPaise:Math.floor(sellingPricePaise*ceilingPercent/100),
    maxItems:tier.maxChoices,
    targetPercent,ceilingPercent
  }
}

// Server-only guard for the four owner-approved packaging options.
// Never accept a posted cost: callers must fetch the approved DB value.
export type SelfBuildBoxId="kappa"|"corrugated"|"bag-clear"|"bag-print"
const BOX_IDS:readonly string[]=["kappa","corrugated","bag-clear","bag-print"]
export function parseSelfBuildBoxId(value:unknown):SelfBuildBoxId|null {
  if(value===null||value===undefined)return null // Historical drafts only.
  if(typeof value!=="string"||!BOX_IDS.includes(value))throw Error("SELF_BUILD_BOX_INVALID")
  return value as SelfBuildBoxId
}
export function validateSelfBuildPackaging(
  tier:{price:number;maxChoices:number;active?:boolean},
  boxId:unknown,
  cost:{approved:boolean;total_cost_paise:number|null}|undefined
) {
  const box=parseSelfBuildBoxId(boxId)
  if(!box)throw Error("SELF_BUILD_BOX_REQUIRED")
  const limits=getSelfBuildTierLimits(tier)
  // Tier price excludes the fixed ₹50 delivery charge.
  if(box==="kappa"&&tier.price<1000)throw Error("SELF_BUILD_KAPPA_MIN_TIER")
  if(cost?.approved!==true||!Number.isSafeInteger(cost.total_cost_paise)||
     cost.total_cost_paise===null||cost.total_cost_paise<=0)
    throw Error("SELF_BUILD_PACKAGING_COST_UNAPPROVED")
  const pricePaise=Math.round(tier.price*100)
  const reservePaise=pricePaise-limits.ceilingPaise
  if(cost.total_cost_paise>reservePaise)
    throw Error("SELF_BUILD_PACKAGING_BUDGET_EXCEEDED")
  return {boxId:box} // Never serialize cost or private budget to buyers.
}

export function countSelfBuildPieces(selections:readonly {quantity:number}[]){
  let total=0
  for(const selection of selections){
    if(!Number.isSafeInteger(selection.quantity)||selection.quantity<1||selection.quantity>100)
      throw Error("INVALID_SELF_BUILD_QUANTITY")
    total+=selection.quantity
    if(!Number.isSafeInteger(total)||total>10000)
      throw Error("INVALID_SELF_BUILD_QUANTITY")
  }
  return total
}
