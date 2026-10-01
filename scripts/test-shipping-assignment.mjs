import assert from "node:assert/strict"
import ts from "typescript"
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"

const root = process.cwd()
const out = join(root, ".shipping-test")
await rm(out, { recursive: true, force: true })
await mkdir(join(out, "config"), { recursive: true })
await mkdir(join(out, "lib", "domain"), { recursive: true })

async function compile(source, destination) {
  const text = await readFile(source, "utf8")
  const result = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true
    },
    fileName: source
  })
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, result.outputText)
}

try {
  await compile(join(root, "config", "shipping.ts"), join(out, "config", "shipping.js"))
  await compile(join(root, "lib", "domain", "shipping-assignment.ts"), join(out, "lib", "domain", "shipping-assignment.js"))
  await cp(join(root, "config", "shipping.json"), join(out, "config", "shipping.json"))

  const require = createRequire(import.meta.url)
  const { decideShippingAssignment, cheapestServiceableQuote, shippingDistanceKm } = require(join(out, "lib", "domain", "shipping-assignment.js"))
  const origin = { latitude: 0, longitude: 0 }
  const earthRadiusKm = 6371.0088
  const pointAtDistance = (distanceKm) => ({ latitude: 0, longitude: distanceKm / earthRadiusKm * 180 / Math.PI })
  const quotes = [
    { provider: "Shipway", carrierId: 22, serviceName: "Courier B", totalPaise: 3200, estimatedDeliveryDays: 3 },
    { provider: "Shipway", carrierId: 11, serviceName: "Courier A", totalPaise: 2800, estimatedDeliveryDays: 4 },
    { provider: "Shipway", carrierId: 33, serviceName: "Courier C", totalPaise: 2900, estimatedDeliveryDays: 2 }
  ]

  const inside = decideShippingAssignment({ origin, destination: pointAtDistance(19.999), quotes })
  assert.equal(inside.mode, "manual")
  assert.equal(inside.reason, "LOCAL_RADIUS")

  const boundaryPoint = pointAtDistance(20)
  assert.ok(Math.abs(shippingDistanceKm(origin, boundaryPoint) - 20) < 1e-9)
  const boundary = decideShippingAssignment({ origin, destination: boundaryPoint, quotes })
  assert.equal(boundary.mode, "manual", "Exactly 20 km must stay manual")
  assert.equal(boundary.reason, "LOCAL_RADIUS")

  const outside = decideShippingAssignment({ origin, destination: pointAtDistance(20.001), quotes })
  assert.equal(outside.mode, "auto")
  assert.equal(outside.reason, "CHEAPEST_SERVICEABLE")
  assert.equal(outside.selectedQuote.carrierId, 11, "Outside 20 km must choose the cheapest eligible carrier")

  const unknown = decideShippingAssignment({ origin, destination: null, quotes })
  assert.equal(unknown.mode, "manual")
  assert.equal(unknown.reason, "DISTANCE_UNKNOWN")

  const noRate = decideShippingAssignment({ origin, destination: pointAtDistance(30), quotes: [
    { provider: "Shipway", carrierId: 44, totalPaise: 0 },
    { provider: "Shipway", carrierId: 55, totalPaise: 2500, serviceable: false },
    { provider: "", carrierId: 66, totalPaise: 2000 }
  ] })
  assert.equal(noRate.mode, "manual")
  assert.equal(noRate.reason, "NO_SERVICEABLE_RATE")

  const tie = cheapestServiceableQuote([
    { provider: "Shipway", carrierId: 3, totalPaise: 2500, estimatedDeliveryDays: 4 },
    { provider: "Shipway", carrierId: 2, totalPaise: 2500, estimatedDeliveryDays: 2 },
    { provider: "Shipway", carrierId: 1, totalPaise: 2500, estimatedDeliveryDays: null }
  ])
  assert.equal(tie.carrierId, 2, "Equal-price quotes should prefer the quicker known ETA")

  const deterministicTie = cheapestServiceableQuote([
    { provider: "Zeta", carrierId: 2, totalPaise: 2500, estimatedDeliveryDays: 2 },
    { provider: "Alpha", carrierId: 9, totalPaise: 2500, estimatedDeliveryDays: 2 },
    { provider: "Alpha", carrierId: 3, totalPaise: 2500, estimatedDeliveryDays: 2 }
  ])
  assert.equal(deterministicTie.provider, "Alpha")
  assert.equal(deterministicTie.carrierId, 3)

  assert.equal(cheapestServiceableQuote([
    { provider: "Shipway", carrierId: "", totalPaise: 1000 },
    { provider: "Shipway", carrierId: -1, totalPaise: 900 }
  ]), null)

  assert.throws(() => decideShippingAssignment({ origin, destination: pointAtDistance(30), quotes, manualRadiusKm: -1 }), /INVALID_MANUAL_RADIUS/)
  console.log("Shipping assignment checks passed: <=20 km manual, unknown distance manual, outside radius cheapest eligible auto-assignment.")
} finally {
  await rm(out, { recursive: true, force: true })
}
