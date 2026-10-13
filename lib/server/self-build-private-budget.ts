// Server-only expense checking shared by PRIVATE draft saves and checkout.
// No retail SKUs, stock availability, categories inventory or client prices.
export type PrivateChoice={kind:"category"|"option";id:string;quantity:number}
export type PrivateCategory={id:string;parent_id:string|null;selection_kind:string;
  charge_mode:string;unit_budget_paise:number|null;label:string;active:boolean}
export type PrivateOption={id:string;category_id:string;unit_budget_paise:number;
  label:string;active:boolean}
function reject(code:string):never{throw Error(code)}
export function evaluatePrivateSelfBuildChoices(
  selections:readonly PrivateChoice[],
  cats:readonly PrivateCategory[],
  opts:readonly PrivateOption[],
  allowMultiple:boolean,
  ceiling:number
) {
  if(!selections.length||!Number.isSafeInteger(ceiling)||ceiling<=0)
    reject("SELF_BUILD_BUDGET_NOT_CONFIGURED")
  const categories=new Map(cats.map(c=>[c.id,c]))
  const options=new Map(opts.map(o=>[o.id,o]))
  let spent=0,photoCount=0
  const snap:{kind:PrivateChoice["kind"];id:string;label:string;quantity:number}[]=[]
  for(const choice of selections){
    if(!Number.isSafeInteger(choice.quantity)||choice.quantity<1||choice.quantity>100)
      reject("INVALID_SELF_BUILD_QUANTITY")
    if(!allowMultiple&&choice.quantity>1)reject("SELF_BUILD_MULTIPLE_QUANTITIES_DISABLED")
    let unit:number|null,label:string
    if(choice.kind==="category"){
      const category=categories.get(choice.id)
      if(!category||!category.active||!["category","photo"].includes(category.selection_kind)||
        (category.parent_id&&!categories.get(category.parent_id)?.active))
        reject("SELF_BUILD_CATEGORY_UNAVAILABLE")
      if(!["per_unit","once_per_category"].includes(category.charge_mode))
        reject("SELF_BUILD_CATEGORY_UNAVAILABLE")
      if(category.selection_kind==="photo")photoCount+=choice.quantity
      unit=category.unit_budget_paise
      label=category.label
      if(category.charge_mode==="per_unit"&&unit!==null)unit*=choice.quantity
    }else{
      const option=options.get(choice.id)
      const parent=option?categories.get(option.category_id):null
      if(!option||!option.active||!parent||!parent.active||parent.selection_kind!=="variant")
        reject("SELF_BUILD_OPTION_UNAVAILABLE")
      unit=option.unit_budget_paise*choice.quantity
      label=option.label
    }
    if(unit===null||!Number.isSafeInteger(unit)||unit<0||unit>2147483647||
      spent>2147483647-unit)reject("SELF_BUILD_PRIVATE_BUDGET_INVALID")
    spent+=unit
    if(spent>ceiling)reject("SELF_BUILD_PRIVATE_BUDGET_EXCEEDED")
    snap.push({kind:choice.kind,id:choice.id,label,quantity:choice.quantity})
  }
  if(photoCount>40)reject("SELF_BUILD_PHOTO_LIMIT")
  return {spent,photoCount,snap}
}
