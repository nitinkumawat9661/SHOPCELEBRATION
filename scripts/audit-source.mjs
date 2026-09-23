import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"

const root = process.cwd()
const allowedEnvFiles = new Set([join(root, "config", "env.ts"), join(root, "config", "public-env.ts")])
const scanRoots = ["app", "features", "lib", "config"].map((dir) => join(root, dir))
const violations = []

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await walk(path)
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) await inspect(path)
  }
}

async function inspect(path) {
  const text = await readFile(path, "utf8")
  if (!allowedEnvFiles.has(path) && text.includes("process.env")) violations.push(`${relative(root, path)} reads process.env directly`)
  const risky = [/917414853321/, /@upi\b/i, /DATABASE_URL\s*=\s*['\"]/]
  for (const pattern of risky) if (pattern.test(text)) violations.push(`${relative(root, path)} contains a business/secret literal: ${pattern}`)
}

for (const dir of scanRoots) await walk(dir)
if (violations.length) {
  console.error(violations.join("\n"))
  process.exit(1)
}
console.log("Source audit passed: environment access centralized; no known business credential literals in code.")
