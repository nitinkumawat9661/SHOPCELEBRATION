import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"

const root = process.cwd()
const allowedEnvFiles = new Set([join(root, "config", "env.ts"), join(root, "config", "public-env.ts")])
const boundedBodyHelper = join(root, "lib", "security", "request.ts")
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
  const display = relative(root, path)
  if (!allowedEnvFiles.has(path) && text.includes("process.env")) violations.push(`${display} reads process.env directly`)

  const riskyLiterals = [/917414853321/, /@upi\b/i, /DATABASE_URL\s*=\s*['\"]/]
  for (const pattern of riskyLiterals) if (pattern.test(text)) violations.push(`${display} contains a business/secret literal: ${pattern}`)

  if (text.includes("dangerouslySetInnerHTML")) violations.push(`${display} uses dangerouslySetInnerHTML`)
  if (/\beval\s*\(/.test(text) || /\bnew\s+Function\s*\(/.test(text)) violations.push(`${display} uses dynamic code execution`)
  if (path !== boundedBodyHelper && /\brequest\.(?:text|arrayBuffer)\s*\(/.test(text)) {
    violations.push(`${display} reads an unbounded request body directly; use lib/security/request.ts`)
  }
}

for (const dir of scanRoots) await walk(dir)
if (violations.length) {
  console.error(violations.join("\n"))
  process.exit(1)
}
console.log("Source audit passed: environment access centralized; no known credential literals, unsafe HTML/code execution, or unbounded request-body reads in application code.")
