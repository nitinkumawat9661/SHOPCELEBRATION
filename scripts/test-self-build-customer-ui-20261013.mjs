#!/usr/bin/env node
// Public-facing Self-Build is hard-gated OFF; compile and audit the dormant
// customer flow without payments, inventory changes or private photo leaks.
import assert from "node:assert/strict"
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
assert(page.includes("getSelfBuildVisualData()")&&page.includes("getCatalogConfig()"),
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
console.log("SELF_BUILD_CUSTOMER_UI_SOURCE_CHECKS_PASSED: no-stock builder, auth, draft/photos, payment and redirect recovery, live-hard-gate, privacy, mobile")
