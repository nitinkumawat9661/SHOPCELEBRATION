import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import ts from "typescript"
const read = file => readFile(new URL("../"+file,import.meta.url),"utf8")
const [eta,shipway,route,component,detail,css,globals,checkout] = await Promise.all([
 "lib/domain/shipway-eta.ts","lib/server/shipway.ts","app/api/shipping/product-estimate/route.ts",
 "features/catalog/ProductPincodeEstimate.tsx","app/jewelry/[id]/page.tsx",
 "styles/product-pincode-estimate-20261012.css","app/globals.css","app/api/shipping/quote/route.ts"
].map(read))
const code=ts.transpileModule(eta,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const exportsRef={}
vm.runInNewContext(code,{exports:exportsRef,Date})
const parse=exportsRef.carrierEstimateFromRate
const now=new Date("2026-10-12T10:00:00Z")
const plain=parse({zone:2,courier_id:8,shipment_charges:30,charge_weight:0.5},now)
assert.equal(plain.estimatedDeliveryDate,null,"Shipway regular rate carries no ETA")
assert.equal(plain.estimatedTransitDays,null,"Never guess transit from zone or price")
const dated=parse({expected_delivery_date:"2026-10-18",delivery_days:5},now)
assert.equal(dated.estimatedDeliveryDate,"2026-10-18")
assert.equal(dated.estimatedTransitDays,5)
assert.equal(parse({expected_delivery_date:"2026-02-30",delivery_days:"two days"},now).estimatedDeliveryDate,null)
assert.equal(parse({expected_delivery_date:"2025-01-01",delivery_days:0},now).estimatedTransitDays,null)
assert.equal(parse({expected_delivery_date:"2027-02-01",transit_days:31},now).estimatedDeliveryDate,null)
assert.equal(parse({delivery_days:"3",charge:12},now).estimatedTransitDays,3)
assert.equal(parse({delivery_days:"2 - 3"},now).estimatedTransitDays,null)
assert(shipway.includes('...carrierEstimateFromRate(row)') && shipway.includes("estimatedDeliveryDate: selected.estimatedDeliveryDate"))
assert(route.includes('enforceSameOrigin(request)') && route.includes('consumeRequestRateLimit') && route.includes('readJsonBody<'))
assert(route.includes('product.active !== false') && route.includes('isIndividuallySellable(product)'))
assert(route.includes('toPincode: pincode, weightGrams: 80'),"Weight consistent with existing checkout")
assert(!/bookShipwayShipment\s*\(/.test(route) && !route.includes('carrierName: quote.'),"Read-only response; hide courier identity")
assert(route.includes('estimatedDeliveryDate: quote.estimatedDeliveryDate') && route.includes('estimatedTransitDays: quote.estimatedTransitDays'))
assert(route.includes('DELIVERY_CHECK_UNAVAILABLE') && route.includes('NOT_SERVICEABLE'))
assert(component.includes('inputMode="numeric"') && component.includes('autoComplete="postal-code"'))
assert(component.includes('controller.abort()') || component.includes('currentRequest.current?.abort()'))
assert(component.includes('signal: controller.signal') && component.includes('aria-live="polite"'))
assert(component.includes('after dispatch') && component.includes('isn’t available from the courier yet'))
assert(component.includes('not a guaranteed date') && !component.includes('Estimated delivery in 3-5'))
assert(detail.includes('{individual && <ProductPincodeEstimate productId={product.id} />}'))
assert(globals.includes('product-pincode-estimate-20261012.css') && css.includes('min-height:46px'))
assert(checkout.includes('quoteShipwayShipping'),"Existing checkout verification preserved")
console.log("Phase 2 delivery estimate checks passed: strict upstream fields only, no fictional dates, product/CSRF/rate guards, faithful checkout and keyboard/mobile UI.")
