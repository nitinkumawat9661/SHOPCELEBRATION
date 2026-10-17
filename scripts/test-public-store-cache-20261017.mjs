import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { readFile } from "node:fs/promises"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8")
const source = await read("lib/server/public-store-cache.ts")
const wrapper = await read("lib/server/public-storefront.ts")
const catalog = await read("lib/server/catalog.ts")
const inventory = await read("lib/server/inventory.ts")
const settings = await read("lib/server/store-settings.ts")
const app = await read("app/page.tsx")
const collection = await read("app/jewelry/page.tsx")
const detail = await read("app/jewelry/[id]/page.tsx")

function respArgs(bytes) {
  const raw = bytes.toString()
  let offset = 0
  const all = []
  while (offset < raw.length) {
    const lineEnd = raw.indexOf("\r\n", offset)
    assert(lineEnd >= 0)
    const count = Number(raw.slice(offset + 1, lineEnd))
    assert.equal(raw[offset], "*")
    offset = lineEnd + 2
    const args = []
    for (let i = 0; i < count; i++) {
      const lengthEnd = raw.indexOf("\r\n", offset)
      assert.equal(raw[offset], "$")
      const size = Number(raw.slice(offset + 1, lengthEnd))
      offset = lengthEnd + 2
      args.push(raw.slice(offset, offset + size))
      offset += size + 2
    }
    all.push(args)
  }
  return all
}

let clock = 1_000_000
const FakeDate = { now: () => clock }
const data = new Map()
const commands = []
function createConnection() {
  const socket = new EventEmitter()
  socket.setTimeout = () => socket
  socket.destroy = () => socket
  socket.write = (bytes) => {
    const batch = respArgs(bytes)
    const replies = []
    for (const args of batch) {
      const [verb, key, value] = args
      commands.push(verb)
      if (verb === "GET") {
        const found = data.get(key)
        replies.push(found === undefined ? "$-1\r\n" : `$${Buffer.byteLength(found)}\r\n${found}\r\n`)
      } else if (verb === "SET") {
        data.set(key, value)
        replies.push("+OK\r\n")
      } else if (verb === "DEL") {
        data.delete(key)
        replies.push(":1\r\n")
      } else {
        throw new Error("Unexpected Redis command: " + verb)
      }
    }
    const combined = Buffer.from(replies.join(""))
    // Redis TCP responses may arrive fragmented.
    queueMicrotask(() => socket.emit("data", combined.subarray(0, 3)))
    queueMicrotask(() => socket.emit("data", combined.subarray(3)))
  }
  queueMicrotask(() => socket.emit("connect"))
  return socket
}

const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const mod = { exports: {} }
runInNewContext(compiled, {
  exports: mod.exports, module: mod, require: (name) => {
    if (name === "node:net") return { createConnection }
    if (name === "../../config/env") return { env: { celebrationRedisUrl: "redis://127.0.0.1:6379/0" } }
    throw new Error("Unexpected dependency: " + name)
  },
  process: { env: { CELEBRATION_REDIS_URL: "redis://127.0.0.1:6379/0" } },
  Buffer, URL, Date: FakeDate, Map, Number, Promise, Error, JSON, queueMicrotask
})
const { publicSnapshot, invalidatePublicSnapshot } = mod.exports
let dbReads = 0
const loader = async () => ({ version: ++dbReads, products: [{ id: "same-sku" }] })
const requests = await Promise.all(Array.from({ length: 12 }, () => publicSnapshot("catalog", 8, loader)))
assert.equal(dbReads, 1, "All simultaneous customers must share a single catalog DB load")
assert(requests.every((x) => x.version === 1))
clock += 3000
assert.equal((await publicSnapshot("catalog", 8, loader)).version, 1, "L1 expiry must hit Redis L2")
assert.equal(dbReads, 1)
await invalidatePublicSnapshot("catalog")
assert.equal((await publicSnapshot("catalog", 8, loader)).version, 2, "After a publish, fresh catalog must replace Redis")
assert.equal(dbReads, 2)
assert(commands.includes("GET") && commands.includes("SET") && commands.includes("DEL"))
assert(wrapper.includes('publicSnapshot("catalog", 8, getCatalogConfig)'))
assert(wrapper.includes('publicSnapshot("store-settings", 60, getStoreSettings)'))
assert(wrapper.includes('publicSnapshot("home-category-media", 120, getHomeCategoryMedia)'))
assert(catalog.includes('await invalidatePublicSnapshot("catalog")'))
assert(inventory.includes('await invalidatePublicSnapshot("catalog")'))
assert(settings.includes('await invalidatePublicSnapshot("store-settings")'))
for (const page of [app, collection, detail]) {
  assert(page.includes("getPublicCatalogConfig"), "Public page bypasses shared Redis snapshot")
}
assert(!source.includes("customerAccountId") && !source.includes("orderId") && !source.includes("paymentStatus"),
  "Never include private customer/order/payment values in the public cache")
console.log("PASS: actual Redis protocol, 12-user coalescing, L1/L2, cross-request reuse and immediate publish invalidation")
