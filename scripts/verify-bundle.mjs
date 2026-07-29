import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

const targets = [
  { name: 'core (IIFE)', path: 'packages/core/dist/nexus-core.iife.js', maxGzipKB: 15 },
  { name: 'core (ESM)', path: 'packages/core/dist/nexus-core.js', maxGzipKB: 15 },
  { name: 'vue (ESM)', path: 'packages/vue/dist/nexus-vue.js', maxGzipKB: 10 },
  { name: 'fields (JS)', path: 'packages/fields/dist/assets/index.js', maxGzipKB: 60 },
  { name: 'fields (CSS)', path: 'packages/fields/dist/assets/index.css', maxGzipKB: 15 },
]

const sriTargets = [
  { name: 'nexus-core.iife.js', path: 'packages/core/dist/nexus-core.iife.js' },
]

let failed = false

console.log('=== Bundle Size Report ===\n')
console.log('Package'.padEnd(20) + 'Raw'.padStart(10) + 'Gzip'.padStart(10) + 'Limit'.padStart(10) + '  Status')
console.log('─'.repeat(62))

for (const t of targets) {
  const fullPath = resolve(root, t.path)
  if (!existsSync(fullPath)) {
    console.log(`${t.name.padEnd(20)}  ${'MISSING'.padStart(10)}`)
    failed = true
    continue
  }
  const raw = readFileSync(fullPath)
  const gzipped = gzipSync(raw)
  const rawKB = (raw.length / 1024).toFixed(2)
  const gzipKB = (gzipped.length / 1024).toFixed(2)
  const over = gzipped.length / 1024 > t.maxGzipKB
  const status = over ? 'OVER' : 'OK'
  if (over) failed = true
  console.log(
    `${t.name.padEnd(20)}${(rawKB + ' KB').padStart(10)}${(gzipKB + ' KB').padStart(10)}${(t.maxGzipKB + ' KB').padStart(10)}  ${status}`,
  )
}

console.log('\n=== SRI Hashes ===\n')

for (const t of sriTargets) {
  const fullPath = resolve(root, t.path)
  if (!existsSync(fullPath)) {
    console.log(`${t.name}: MISSING`)
    failed = true
    continue
  }
  const raw = readFileSync(fullPath)
  const hash = createHash('sha384').update(raw).digest('base64')
  const integrity = `sha384-${hash}`
  console.log(`${t.name}:`)
  console.log(`  ${integrity}`)
  console.log()
}

const sdkTotalGzip = targets
  .filter((t) => t.path.includes('core') || t.path.includes('fields'))
  .reduce((sum, t) => {
    const fullPath = resolve(root, t.path)
    if (!existsSync(fullPath)) return sum
    return sum + gzipSync(readFileSync(fullPath)).length
  }, 0)

const sdkTotalKB = (sdkTotalGzip / 1024).toFixed(2)
const sdkOver = sdkTotalGzip / 1024 > 80
console.log(`SDK total (core+fields) gzip: ${sdkTotalKB} KB ${sdkOver ? 'OVER 80 KB' : 'OK'}`)
if (sdkOver) failed = true

if (failed) {
  console.log('\nBuild verification FAILED.')
  process.exit(1)
} else {
  console.log('\nBuild verification passed.')
}
