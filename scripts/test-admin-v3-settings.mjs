import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

const source = path => readFileSync(path, "utf8")
for (const path of [
  "features/admin/v3/AdminSettingsV3.tsx",
  "features/admin/v3/AdminDashboardV3.tsx",
  "app/admin/v3/page.tsx",
  "app/api/admin/store-settings/v3/route.ts",
  "app/api/admin/security/v3/route.ts",
  "lib/server/store-settings.ts"
]) {
  const parsed = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  assert.deepEqual(
    parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [], "TypeScript/TSX parse failed: " + path
  )
}

const page = source("app/admin/v3/page.tsx")
const shell = source("features/admin/v3/AdminDashboardV3.tsx")
const ui = source("features/admin/v3/AdminSettingsV3.tsx")
const settingsRoute = source("app/api/admin/store-settings/v3/route.ts")
const securityRoute = source("app/api/admin/security/v3/route.ts")
const service = source("lib/server/store-settings.ts")
const passkeyOptions = source("app/api/admin/passkeys/register/options/route.ts")
const passkeyVerify = source("app/api/admin/passkeys/register/verify/route.ts")
const session = source("lib/security/admin-session.ts")
const css = source("styles/admin-v3-settings.css")

assert.match(page, /getAdminAccessState\(\)/, "Protected admin route required")
assert.match(page, /!access\.authenticated/, "Unauthenticated must be gated server side")
assert.match(page, /!access\.passkeyEnabled/, "Existing passkey setup gate remains")
assert.match(page, /index: false/, "Noindex protected route")
assert.match(page, /admin-v3-settings\.css/, "Scoped settings CSS must load in admin V3")
assert.match(shell, /<AdminSettingsV3 onDirtyChange=\{setSettingsDirty\}/, "Final V3 settings screen wired")
assert.match(shell, /view === "settings" && settingsDirty/, "Navigation and logout discard guard")
assert.match(ui, /const dirty = Boolean\(settings && original/, "Dirty must compare to original server state")
assert.match(ui, /expectedVersion: version, settings/, "Settings write sends expected version")
assert.match(ui, /SETTINGS_VERSION_CONFLICT/, "UI explains concurrent-edit rejection")
assert.match(ui, /window\.confirm\(/, "Explicit publish/registration approvals required")
assert.match(ui, /beforeunload/, "Unsaved browser-navigation warning required")
assert.match(ui, /loadSettings\(controller\.signal\)/, "Live state must load from server")
assert.match(ui, /await createAdminPasskey\(optionsBody\.options\)/, "Original WebAuthn client reused")
assert.match(ui, /\/api\/admin\/passkeys\/register\/verify/, "Original registered passkey verify API reused")
assert.match(ui, /register\/options/, "Original WebAuthn challenge API reused")
assert.match(ui, /no public.*forgot admin passkey/i, "No fake credential recovery promise")
assert.match(ui, /Cashfree/, "Payment integration remains outside settings form")
assert.match(ui, /Telegram/, "Messaging integration remains outside settings form")
assert.match(settingsRoute, /isAdminRequest\(\)/, "Store settings admin authenticated")
assert.match(settingsRoute, /enforceSameOrigin\(request\)/, "Same-origin mutation policy")
assert.match(settingsRoute, /consumeRequestRateLimit/, "Rate limit admin data")
assert.match(settingsRoute, /private, no-store/, "Protected settings responses never cached")
assert.match(settingsRoute, /saveStoreSettingsVersioned\(body\.settings, body\.expectedVersion\)/,
  "V3 must use new version gated setter")
assert.match(settingsRoute, /SETTINGS_VERSION_CONFLICT.*409/s, "Version mismatch should be HTTP 409")
assert.match(service, /WHERE id = 'primary' AND version = \$2/, "Atomic DB compare and swap")
assert.match(service, /version = version \+ 1/, "Published version increments")
assert.match(service, /invalidatePublicSnapshot\("store-settings"\)/, "Live settings cache invalidation")
assert.match(securityRoute, /getAdminAccessState\(\)/, "Security API uses existing admin session state")
assert.match(securityRoute, /access\.method !== "passkey"/, "A passkey session required")
assert.match(securityRoute, /adminPasskeyCount\(\)/, "Only credential count is displayed")
assert.match(securityRoute, /private, no-store/, "Security snapshot no-store")
assert.doesNotMatch(securityRoute, /credential_id|public_key_jwk|sign_count|sessionSecret|passwordHash/,
  "Never expose passkey credential IDs or secrets")
assert.match(passkeyOptions, /isAdminRequest\(\)/, "Existing enrollment challenge admin gated")
assert.match(passkeyOptions, /enforceSameOrigin\(request\)/, "Existing challenge same-origin")
assert.match(passkeyVerify, /verifyRegistration\(/, "Original server validates WebAuthn attestation")
assert.match(passkeyVerify, /createAdminSession\("passkey"\)/, "Existing session is refreshed as passkey")
assert.match(session, /passkeyEnabled/, "No password fallback if passkey exists")
assert.match(css, /@media\(max-width:600px\)/, "Mobile layout included")
console.log("PASS: Admin V3 Settings/Passkey source-contract and TSX syntax checks.")
console.log("NOT YET VERIFIED: Full TypeScript build, server/DB/browser security integration or production.")
