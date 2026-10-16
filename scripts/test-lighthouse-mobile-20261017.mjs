import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8")
const globals = read("app/globals.css")
const admin = read("app/admin/layout.tsx")
const cssFiles = ["admin.css","admin-v2.css","admin-systematic.css","admin-shell.css","admin-individual-sales.css","admin-catalog-polish.css","admin-reservation-review.css"]
for (const css of cssFiles) {
  assert.ok(!globals.includes('@import "../styles/' + css + '";'), "Public page leaks " + css)
  assert.ok(admin.includes('import "../../styles/' + css + '"'), "Admin route missing " + css)
}
assert.ok(globals.includes('@import "../styles/jewelry-two-column-scroll-header-fix.css";'))
assert.ok(globals.includes('@import "../styles/catalog-image-reliability.css";'))
assert.ok(read("app/api/catalog/image/route.ts").includes("publicCatalogImageCacheControl(key)"))
const compiled = ts.transpileModule(read("lib/domain/catalog-image-cache.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const m = { exports: {} }
runInNewContext(compiled, { module: m, exports: m.exports })
const cache = m.exports.publicCatalogImageCacheControl
assert.equal(cache("catalog/rehost/meesho/" + "a".repeat(64) + "/main.webp"), "public, max-age=604800, immutable")
assert.equal(cache("catalog/5d353c94-0177-4436-81a4-fd60a1b83db1.webp"), "public, max-age=604800, immutable")
assert.equal(cache("catalog/editorial/category-v7/earrings.webp"), "public, max-age=3600, stale-while-revalidate=86400")
assert.equal(cache("catalog/editorial/category-v7/earrings.webp?fake"), "public, max-age=300, stale-while-revalidate=1800")
assert.ok(!read("config/http-security.mjs").includes("static.cloudflareinsights.com"), "Never weaken CSP for optional Cloudflare beacon")
console.log("PASS: public route CSS split, catalog photo caching, security preserved")
