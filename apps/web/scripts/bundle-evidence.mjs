import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const checkMode = process.argv.includes('--check')
const appRoot = path.resolve(import.meta.dirname, '..')
const distAssetsDir = path.join(appRoot, 'dist', 'assets')

const trackedChunks = [
  {
    name: 'Header',
    pattern: /^Header-.*\.js$/,
    maxRawBytes: 180 * 1024,
    maxGzipBytes: 60 * 1024,
  },
  {
    name: 'Orchestrate',
    pattern: /^Orchestrate-.*\.js$/,
    maxRawBytes: 460 * 1024,
    maxGzipBytes: 145 * 1024,
  },
  {
    name: 'DaeEditorInner',
    pattern: /^DaeEditorInner-.*\.js$/,
    maxRawBytes: 340 * 1024,
    maxGzipBytes: 105 * 1024,
  },
  {
    name: 'ts.worker',
    pattern: /^ts\.worker-.*\.js$/,
    maxRawBytes: 7 * 1024 * 1024,
    maxGzipBytes: 1.5 * 1024 * 1024,
  },
]

const globalBudgets = [
  {
    name: 'largest-js-asset',
    select: (assets) => assets.filter((asset) => asset.name.endsWith('.js')).sort((a, b) => b.rawBytes - a.rawBytes)[0],
    maxRawBytes: 7 * 1024 * 1024,
    maxGzipBytes: 1.5 * 1024 * 1024,
  },
]

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
  return `${(bytes / 1024).toFixed(1)} KiB`
}

function withinBudget(asset, budget) {
  return asset.rawBytes <= budget.maxRawBytes && asset.gzipBytes <= budget.maxGzipBytes
}

async function loadAsset(name) {
  const filePath = path.join(distAssetsDir, name)
  const [fileStat, content] = await Promise.all([stat(filePath), readFile(filePath)])
  return {
    name,
    rawBytes: fileStat.size,
    gzipBytes: gzipSync(content).length,
  }
}

if (!existsSync(distAssetsDir)) {
  console.error(`dist assets not found: ${distAssetsDir}`)
  console.error('Run `pnpm --filter daed build` before bundle evidence checks.')
  process.exit(1)
}

const assetNames = await readdir(distAssetsDir)
const assets = await Promise.all(assetNames.map(loadAsset))
const jsAssets = assets.filter((asset) => asset.name.endsWith('.js'))
const cssAssets = assets.filter((asset) => asset.name.endsWith('.css'))
const evidenceRows = []
const failures = []

for (const chunk of trackedChunks) {
  const matches = assets.filter((asset) => chunk.pattern.test(asset.name)).sort((a, b) => b.rawBytes - a.rawBytes)
  const asset = matches[0]

  if (!asset) {
    failures.push(`${chunk.name}: missing chunk matching ${chunk.pattern}`)
    continue
  }

  evidenceRows.push({ ...chunk, asset })
  if (checkMode && !withinBudget(asset, chunk)) {
    failures.push(
      `${chunk.name}: ${asset.name} raw ${formatBytes(asset.rawBytes)} / gzip ${formatBytes(
        asset.gzipBytes,
      )} exceeds budget raw ${formatBytes(chunk.maxRawBytes)} / gzip ${formatBytes(chunk.maxGzipBytes)}`,
    )
  }
}

for (const budget of globalBudgets) {
  const asset = budget.select(assets)
  if (!asset) {
    failures.push(`${budget.name}: no matching asset`)
    continue
  }

  evidenceRows.push({ ...budget, asset })
  if (checkMode && !withinBudget(asset, budget)) {
    failures.push(
      `${budget.name}: ${asset.name} raw ${formatBytes(asset.rawBytes)} / gzip ${formatBytes(
        asset.gzipBytes,
      )} exceeds budget raw ${formatBytes(budget.maxRawBytes)} / gzip ${formatBytes(budget.maxGzipBytes)}`,
    )
  }
}

const totalRawBytes = assets.reduce((sum, asset) => sum + asset.rawBytes, 0)
const totalGzipBytes = assets.reduce((sum, asset) => sum + asset.gzipBytes, 0)
const largestAssets = [...assets].sort((a, b) => b.rawBytes - a.rawBytes).slice(0, 10)

console.log('Daed Web bundle evidence')
console.log(`dist assets: ${distAssetsDir}`)
console.log(`assets: ${assets.length} total, ${jsAssets.length} js, ${cssAssets.length} css`)
console.log(`total: raw ${formatBytes(totalRawBytes)} / gzip ${formatBytes(totalGzipBytes)}`)
console.log('')
console.log('Tracked chunks:')
for (const row of evidenceRows) {
  const status = withinBudget(row.asset, row) ? 'ok' : 'over'
  console.log(
    `- ${row.name}: ${row.asset.name} raw ${formatBytes(row.asset.rawBytes)} / gzip ${formatBytes(
      row.asset.gzipBytes,
    )} budget raw ${formatBytes(row.maxRawBytes)} / gzip ${formatBytes(row.maxGzipBytes)} [${status}]`,
  )
}
console.log('')
console.log('Largest assets:')
for (const asset of largestAssets) {
  console.log(`- ${asset.name} raw ${formatBytes(asset.rawBytes)} / gzip ${formatBytes(asset.gzipBytes)}`)
}

if (checkMode && failures.length > 0) {
  console.error('')
  console.error('Bundle evidence check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}
