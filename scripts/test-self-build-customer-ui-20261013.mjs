#!/usr/bin/env node
// Public-facing Self-Build is hard-gated OFF; compile and audit the dormant
// customer flow without payments, inventory changes or private photo leaks.
import assert from "node:assert/strict"
import ts from "typescript"
import {readFile} from "node:fs/promises"
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8")
const [page,ui,css,draftApi,photoApi,createApi,retryApi,gate,provider] = await Promise.all([
  "app/self-build/page.tsx",
  "features/builder/CustomerSelfBuildStudio.tsx",
  "styles/self-build-buyer-20261013.css",
  "app/api/account/self-build/draft/route.ts",
  "app/api/account/self-build/photos/route.ts",
  "app/api/payments/self-build/create/route.ts",
  "app/api/payments/self-build/retry/route.ts",
  "lib/server/self-build-drafts.ts",
  "lib/server/payments/provider.ts"
].map(read))
assert(page.includes("customerSelfBuildEnabled().catch(()=>false)")&&
 page.includes("if(!enabled)")&&page.includes("<CustomerSelfBuildStudio"),
 "Actual production DB hard launch gate must control buyer studio rendering")
assert(page.includes("getSelfBuildVisualData()")&&page.includes("getSelfBuildPublishedCatalog()"),
 "Buyer sees verified category names and public hamper tier prices only")
assert(page.includes("robots:{index:false")&&page.includes("Our create-your-own hamper studio is being prepared"),
 "Unlaunched self-build must be noindex and show honest coming-soon")
assert(ui.includes("CustomerAuthPanel")&&ui.includes("useCustomerAccount()"),
 "Customer verified sign-in integrated")
assert(ui.includes("/api/account/self-build/draft")&&ui.includes("method:\"PUT\""),
 "Authenticated draft save uses existing safe API")
assert(ui.includes("/api/account/self-build/photos")&&ui.includes("image/jpeg,image/png,image/webp"),
 "Private photo upload / read and delete are buyer scoped and image restricted")
assert(ui.includes("photoQuantity")&&ui.includes("photos.length===photoQuantity"),
 "Exact selected photo count required before any payment")
assert(ui.includes('"/api/payments/self-build/create"')&&ui.includes('"/api/payments/self-build/retry"'),
 "Dedicated no-stock payment checkout and retry")
assert(ui.includes('"/api/payments/verify"')&&ui.includes("razorpay_signature")&&
 ui.includes("cashfree.checkout"),"Existing signature-verified gateway confirmation contract")
assert(ui.includes("sessionStorage.setItem")&&ui.includes("paymentStatus")&&
 ui.includes("Check payment status"),"Pending/redirect payment can be resumed without double order")
assert(ui.includes("validateCheckoutDetails")&&ui.includes("policyAccepted:true")&&
 ui.includes("policyVersion:orderConfig.policyVersion"),"Delivery details and accepted policy are validated")
assert(ui.includes("two days after actual delivery")&&
 !ui.includes("self_build_category_capacity")&&!ui.includes("reserveSelfBuild"),
 "Retention is delivery + 48h and customer code has NO inventory dependency")
assert(createApi.includes("customerSelfBuildEnabled()")&&retryApi.includes("customerSelfBuildEnabled()"),
 "Checkout routes fail closed before gateway calls")
assert(gate.includes("customer_enabled===true")&&
 draftApi.includes("customerSelfBuildEnabled()")&&photoApi.includes("customerSelfBuildEnabled()"),
 "Every draft/photo/payment API maintains identical customer hard gate")
assert(css.includes("@media(max-width:650px)")&&css.includes(":focus-visible"),
 "Responsive accessible design at narrow mobile widths")
const [siteHeader,homePage,homeStore]=await Promise.all([
  "features/shell/StorefrontHeader.tsx","app/page.tsx","features/home/Storefront.tsx"
].map(read))
assert(siteHeader.includes("showSelfBuild = false")&&siteHeader.includes("showSelfBuild && <Link"),
 "No public Self-Build nav until the hard launch gate says enabled")
assert(homePage.includes("getCachedSelfBuildEnabled().catch(() => false)")&&
 homeStore.includes("showSelfBuild={initialSelfBuildEnabled}"),
 "Gated homepage link is cached and fail-closed")
assert(provider.includes("verifyProviderWebhook")&&provider.includes("PAYMENT_WEBHOOK_SIGNATURE_INVALID"),
 "Signed provider verification unchanged")
const [policy,orderFactory,draftService,migration,catalogRaw,createEngine,deliveryConfig] = await Promise.all([
  "lib/server/self-build-tier-limits.ts",
  "lib/server/orders/self-build-no-inventory.ts",
  "lib/server/self-build-drafts.ts",
  "db/migrations/106_self_build_tier_auto_percentage_budgets.sql",
  "content/catalog.json",
  "lib/server/orders/create.ts",
  "config/self-build-delivery.ts"
].map(read))
assert(migration.includes("self_build_tier_allowances")&&migration.includes(">= 1299")&&
 migration.includes("THEN 75 ELSE 80")&&migration.includes("AFTER INSERT OR UPDATE OF payload"),
 "Auto-sync 80/75 target percentages from published tier price")
assert(!migration.includes("self_build_category_capacity") &&
 !migration.includes("self_build_option_capacity") &&
 !migration.includes("retail_inventory") &&
 !migration.includes("reserved_units") &&
 !migration.includes("UPDATE orders"),"Migration MUST NOT alter inventory or existing orders")
assert(orderFactory.includes("getSelfBuildTierLimits(chosenTier)")&&
 orderFactory.includes("limits.ceilingPaise") &&
 orderFactory.includes("countSelfBuildPieces(choices)>limits.maxItems"),
 "Checkout rechecks server-side hard monetary cap and total quantity")
assert(draftService.includes("countSelfBuildPieces(clean.selections)>limits.maxItems"),
 "Draft API cannot be used to bypass tier total count")
assert(ui.includes("TOTAL PIECES IN YOUR HAMPER")&&
 ui.includes("Maximum {maxUnits} pieces")&&ui.includes("selectedUnits>=maxUnits")&&
 ui.includes("selectedUnits>maxUnits")&&
 ui.includes("A hamper made to match your budget.")&&
 !ui.includes("Up to {t.maxChoices} pieces"),
 "Visible upper selection card max counter includes repeated category pieces")
assert(deliveryConfig.includes("SELF_BUILD_DELIVERY_FEE_PAISE = 5000")&&
 ui.includes("SELF_BUILD_DELIVERY_FEE_PAISE/100")&&
 ui.includes("Hamper price")&&ui.includes("Total to pay")&&
 orderFactory.includes("selfBuildShippingPaise:SELF_BUILD_DELIVERY_FEE_PAISE")&&
 createEngine.includes("HAMPER_DELIVERY_FEE_PAISE")&&
 createEngine.includes("pricing.shippingPaise")&&
 createEngine.includes("pricing.payablePaise"),
 "Fixed ₹50 delivery must display in Self-Build checkout and be frozen server-side in the order and payment amount")
assert(!ui.includes("allowancePaise")&&!ui.includes("targetPaise")&&
 !ui.includes("internalSpentPaise"),"Buyer never receives private spending or cost fields")
const result=ts.transpileModule(policy,{compilerOptions:{module:ts.ModuleKind.ESNext,
 target:ts.ScriptTarget.ES2022}}).outputText
const {getSelfBuildTierLimits,countSelfBuildPieces}=await import("data:text/javascript;base64,"+
 Buffer.from(result).toString("base64"))
const tierData=JSON.parse(catalogRaw)
assert(Array.isArray(tierData.tiers)&&tierData.tiers.length>=12)
for(const t of tierData.tiers){
  const limits=getSelfBuildTierLimits(t)
  const pricePaise=Math.round(t.price*100)
  const big=pricePaise>=129900
  assert.equal(limits.targetPercent,big?75:80)
  assert.equal(limits.ceilingPercent,big?80:85)
  assert.equal(limits.targetPaise,Math.floor(pricePaise*(big?75:80)/100))
  assert.equal(limits.ceilingPaise,Math.floor(pricePaise*(big?80:85)/100))
  assert.equal(limits.maxItems,t.maxChoices)
}
assert.deepEqual(getSelfBuildTierLimits({price:499,maxChoices:3}),{
 targetPaise:39920,ceilingPaise:42415,maxItems:3,targetPercent:80,ceilingPercent:85
})
assert.deepEqual(getSelfBuildTierLimits({price:1299,maxChoices:6}),{
 targetPaise:97425,ceilingPaise:103920,maxItems:6,targetPercent:75,ceilingPercent:80
})
assert.equal(countSelfBuildPieces([{quantity:3}]),3,"Three repeats are three products")
assert.equal(countSelfBuildPieces([{quantity:2},{quantity:3}]),5)
assert.throws(()=>countSelfBuildPieces([{quantity:101}]),/INVALID_SELF_BUILD_QUANTITY/)
console.log("SELF_BUILD_CUSTOMER_UI_SOURCE_CHECKS_PASSED: no-stock builder, auth, draft/photos, payment and redirect recovery, live-hard-gate, privacy, mobile")
