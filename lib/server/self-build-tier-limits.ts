// Private Self-Build hamper budget policy (never expose as client props).
// Standard hampers: target 80%; Grand/Large and above (₹1,299+): 75%.
// Owner permits a 5-PERCENTAGE-POINT overrun for a final item; the ceiling is
// therefore 85%/80%. No artificial minimum spend, product SKU mapping,
// inventory availability, or quantity-on-hand check is part of this policy.
// The published catalog price/maxChoices are the only inputs: changing the
// price recomputes the allowance automatically with no admin stock work.
export type SelfBuildTierLimits = {
  targetPaise: number
  ceilingPaise: number
  maxItems: number
  targetPercent: 80 | 75
  ceilingPercent: 85 | 80
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
  const ceilingPercent=larger?80:85
  return {
    targetPaise:Math.floor(sellingPricePaise*targetPercent/100),
    ceilingPaise:Math.floor(sellingPricePaise*ceilingPercent/100),
    maxItems:tier.maxChoices,
    targetPercent,ceilingPercent
  }
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
