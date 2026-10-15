#!/usr/bin/env node
/**
 * Safe frontend cleanup audit. Detect stylesheet references from real source
 * imports, guard against missing CSS and report orphaned stylesheet candidates.
 *
 * This is an audit only: never delete a file from an automated guess. Feature
 * styles can be imported from a route instead of app/globals.css.
 */
import assert from "node:assert/strict"
import { readdir, readFile, access } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sourceRoots = ["app", "features", "styles", "lib", "config"]
const sourceExts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css"])
const cssRefs = new Map()
const sourceFiles = []
const exists = async file => access(file).then(() => true, () => false)

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!["node_modules", ".next", "coverage"].includes(entry.name)) await walk(file)
    } else if (entry.isFile() && sourceExts.has(path.extname(entry.name))) sourceFiles.push(file)
  }
}

for (const dirname of sourceRoots) {
  const directory = path.join(root, dirname)
  if (await exists(directory)) await walk(directory)
}

const referenced = new Set()
for (const source of sourceFiles) {
  const body = await readFile(source, "utf8")
  // CSS imports in source scripts and stylesheet @imports. External URLs and
  // package styles are deliberately excluded; only ./ and ../ are validated.
  const pattern = /["'](\.{1,2}\/[^"'\r\n]+\.css)["']/g
  for (const match of body.matchAll(pattern)) {
    const target = path.resolve(path.dirname(source), match[1])
    const from = path.relative(root, source)
    if (!cssRefs.has(target)) cssRefs.set(target, [])
    cssRefs.get(target).push(from)
    referenced.add(target)
  }
}
const missing = []
for (const [target, sources] of cssRefs) {
  if (!await exists(target)) missing.push({ file: path.relative(root, target), importedBy: sources })
}
assert.deepEqual(missing, [], "Every relative CSS import must resolve to a real file")

const allCss = (await readdir(path.join(root, "styles")))
  .filter(file => file.endsWith(".css"))
  .map(file => path.join(root, "styles", file))
const orphans = allCss.filter(file => !referenced.has(file)).map(file => path.relative(root, file))
const obsoleteFeatured = "styles/home-featured-compact-photo-grid-20261012.css"
assert(!orphans.includes(obsoleteFeatured), "The proven-unreferenced featured-grid draft must be removed")

const curated = await readFile(path.join(root, "app/curated-hampers/page.tsx"), "utf8")
const selfBuild = await readFile(path.join(root, "app/self-build/page.tsx"), "utf8")
const demo = await readFile(path.join(root, "app/self-build-design/page.tsx"), "utf8")
const curatedComponent = await readFile(path.join(root, "features/builder/CuratedHamperFlow.tsx"), "utf8")
const designComponent = await readFile(path.join(root, "features/builder/SelfBuildThreeScreenPreview.tsx"), "utf8")
assert(curated.includes("<CuratedHamperFlow") && curatedComponent.includes("Review & Pay"),
  "Keep production curated budget/occasion/details/payment flow")
assert(selfBuild.includes("customerSelfBuildEnabled().catch(()=>false)"),
  "Original Self-Build customer launch gate must remain fail-closed")
assert(demo.includes("<SelfBuildThreeScreenPreview") &&
  designComponent.includes("Proceed to Payment") &&
  designComponent.includes("Payment is not connected"),
  "Keep the live three-screen Self-Build demo and its non-payment safety notice")

console.log(JSON.stringify({
  status: "SAFE_FRONTEND_CLEANUP_AUDIT_PASSED",
  sourcesScanned: sourceFiles.length,
  cssFiles: allCss.length,
  referencedCss: allCss.length - orphans.length,
  orphanCandidatesForManualReview: orphans
}, null, 2))
