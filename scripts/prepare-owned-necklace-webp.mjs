#!/usr/bin/env node
/**
 * Produce lossless-source, display-optimized WebP derivatives of the 22
 * owner-hosted necklace PNGs. Keep each original and its SKU unchanged.
 *
 * This runs BEFORE Next builds or starts its development server. Generated
 * files are ignored by Git, never stored in PostgreSQL or Cloudflare R2.
 * A failed conversion aborts the build rather than publishing broken URLs.
 */
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import sharp from "sharp"

const sourceDir = fileURLToPath(new URL("../public/catalog/necklaces/", import.meta.url))
const outputDir = fileURLToPath(new URL("../public/catalog/necklaces-optimized/", import.meta.url))
const EXPECTED = 22
const VARIANTS = {
  thumb: { width: 360, quality: 75 },
  main: { width: 900, quality: 81 },
  zoom: { width: 1600, quality: 83 }
}

const entries = await readdir(sourceDir, { withFileTypes: true })
const originals = entries.filter((entry) =>
  entry.isFile() && /^celebration-necklace-(?:00[1-9]|01\d|02[0-2])\.png$/.test(entry.name)
).map((entry) => entry.name).sort()
if (originals.length !== EXPECTED) {
  throw new Error(`Expected ${EXPECTED} original Celebration necklace PNGs, found ${originals.length}. Refusing partial output.`)
}

await mkdir(outputDir, { recursive: true })
let created = 0
let reused = 0
for (const name of originals) {
  const source = join(sourceDir, name)
  const sourceStat = await stat(source)
  const base = name.slice(0, -4)
  const metadata = await sharp(source, { limitInputPixels: 60_000_000 }).metadata()
  if (metadata.format !== "png" || !metadata.width || !metadata.height) {
    throw new Error(`Invalid original image: ${name}`)
  }

  for (const [size, { width, quality }] of Object.entries(VARIANTS)) {
    const target = join(outputDir, `${base}-${size}.webp`)
    const existing = await stat(target).catch(() => null)
    if (existing?.size && existing.mtimeMs >= sourceStat.mtimeMs) {
      reused++
      continue
    }
    const temp = `${target}.tmp-${process.pid}`
    try {
      await sharp(source, { limitInputPixels: 60_000_000 })
        .rotate()
        .resize({ width, fit: "inside", withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toFile(temp)
      const verified = await sharp(temp).metadata()
      if (verified.format !== "webp" || !verified.width || !verified.height ||
          verified.width > width || verified.height < 1) {
        throw new Error(`Invalid WebP output: ${base}-${size}`)
      }
      await rename(temp, target)
      created++
    } finally {
      await rm(temp, { force: true })
    }
  }
}
console.log(`Celebration WebP: ${originals.length} exact-SKU source photos; ${created} variants generated, ${reused} current variants retained.`)
