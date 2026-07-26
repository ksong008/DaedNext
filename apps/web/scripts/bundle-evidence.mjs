import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { bundledLanguagesInfo, bundledThemesInfo } from 'shiki'

const checkMode = process.argv.includes('--check')
const appRoot = path.resolve(import.meta.dirname, '..')
const distDir = path.join(appRoot, 'dist')
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
    maxRawBytes: 4.5 * 1024 * 1024,
    maxGzipBytes: 1.1 * 1024 * 1024,
  },
  {
    name: 'editor.worker',
    pattern: /^editor\.worker-.*\.js$/,
    maxRawBytes: 400 * 1024,
    maxGzipBytes: 150 * 1024,
  },
  {
    name: 'browser LSP worker',
    pattern: /^server\.browser-.*\.js$/,
    maxRawBytes: 260 * 1024,
    maxGzipBytes: 80 * 1024,
  },
]

const globalBudgets = [
  {
    name: 'largest-js-asset',
    select: (assets) => assets.filter((asset) => asset.name.endsWith('.js')).sort((a, b) => b.rawBytes - a.rawBytes)[0],
    maxRawBytes: 4.5 * 1024 * 1024,
    maxGzipBytes: 1.1 * 1024 * 1024,
  },
]

const bundleBudgets = {
  maxRawBytes: 8 * 1024 * 1024,
  maxGzipBytes: 2.5 * 1024 * 1024,
  maxFiles: 120,
  maxJavaScriptFiles: 100,
}

const allowedRootFiles = new Set(['index.html', 'logo.webp'])
const allowedMonacoWorkers = [/^editor\.worker-[A-Za-z0-9_-]+\.js$/]
const allowedShikiLanguages = new Set([
  'css',
  'html',
  'javascript',
  'json',
  'markdown',
  'shellscript',
  'typescript',
  'yaml',
])
const allowedShikiThemes = new Set(['github-dark', 'github-light', 'vitesse-dark', 'vitesse-light'])
const shikiEngineChunkStems = new Set(['wasm'])

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
  return `${(bytes / 1024).toFixed(1)} KiB`
}

function withinBudget(asset, budget) {
  return asset.rawBytes <= budget.maxRawBytes && asset.gzipBytes <= budget.maxGzipBytes
}

async function loadAsset(filePath, name = path.basename(filePath)) {
  const [fileStat, content] = await Promise.all([stat(filePath), readFile(filePath)])
  return {
    name,
    rawBytes: fileStat.size,
    gzipBytes: gzipSync(content).length,
  }
}

async function loadDirectory(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(directory, entry.name)
      const relativeName = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) return loadDirectory(filePath, relativeName)
      return [await loadAsset(filePath, relativeName)]
    }),
  )
  return files.flat()
}

function chunkStem(name) {
  return name.match(/^(.*)-[A-Za-z0-9_-]{8}\.js$/)?.[1] ?? null
}

function registrationNames(info) {
  return [info.id, ...(info.aliases ?? [])]
}

function emittedShikiRegistrations(assets, registrations) {
  const registrationByName = new Map()
  for (const registration of registrations) {
    for (const name of registrationNames(registration)) registrationByName.set(name, registration.id)
  }

  const emitted = new Set()
  for (const asset of assets) {
    const stem = chunkStem(asset.name)
    if (stem && shikiEngineChunkStems.has(stem)) continue
    const registration = stem ? registrationByName.get(stem) : null
    if (registration) emitted.add(registration)
  }
  return [...emitted].sort()
}

if (!existsSync(distAssetsDir)) {
  console.error(`dist assets not found: ${distAssetsDir}`)
  console.error('Run `pnpm --filter daed build` before bundle evidence checks.')
  process.exit(1)
}

const assetNames = await readdir(distAssetsDir)
const assets = await Promise.all(assetNames.map((name) => loadAsset(path.join(distAssetsDir, name))))
const distFiles = await loadDirectory(distDir)
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
const distRawBytes = distFiles.reduce((sum, asset) => sum + asset.rawBytes, 0)
const distGzipBytes = distFiles.reduce((sum, asset) => sum + asset.gzipBytes, 0)
const largestAssets = [...assets].sort((a, b) => b.rawBytes - a.rawBytes).slice(0, 10)
const rootFiles = distFiles.filter((asset) => !asset.name.includes('/')).map((asset) => asset.name)
const unexpectedRootFiles = rootFiles.filter((name) => !allowedRootFiles.has(name))
const monacoWorkers = jsAssets.filter((asset) => asset.name.includes('.worker-')).map((asset) => asset.name)
const unexpectedMonacoWorkers = monacoWorkers.filter(
  (name) => !allowedMonacoWorkers.some((pattern) => pattern.test(name)),
)
const emittedShikiLanguages = emittedShikiRegistrations(jsAssets, bundledLanguagesInfo)
const emittedShikiThemes = emittedShikiRegistrations(jsAssets, bundledThemesInfo)
const unexpectedShikiLanguages = emittedShikiLanguages.filter((language) => !allowedShikiLanguages.has(language))
const unexpectedShikiThemes = emittedShikiThemes.filter((theme) => !allowedShikiThemes.has(theme))

if (checkMode) {
  if (distRawBytes > bundleBudgets.maxRawBytes) {
    failures.push(`total raw ${formatBytes(distRawBytes)} exceeds ${formatBytes(bundleBudgets.maxRawBytes)}`)
  }
  if (distGzipBytes > bundleBudgets.maxGzipBytes) {
    failures.push(`total gzip ${formatBytes(distGzipBytes)} exceeds ${formatBytes(bundleBudgets.maxGzipBytes)}`)
  }
  if (distFiles.length > bundleBudgets.maxFiles) {
    failures.push(`file count ${distFiles.length} exceeds ${bundleBudgets.maxFiles}`)
  }
  if (jsAssets.length > bundleBudgets.maxJavaScriptFiles) {
    failures.push(`JavaScript file count ${jsAssets.length} exceeds ${bundleBudgets.maxJavaScriptFiles}`)
  }
  if (monacoWorkers.length !== 1 || unexpectedMonacoWorkers.length > 0) {
    failures.push(`Monaco worker set is not editor-only: ${monacoWorkers.join(', ') || 'none'}`)
  }
  if (unexpectedShikiLanguages.length > 0) {
    failures.push(`unexpected Shiki languages: ${unexpectedShikiLanguages.join(', ')}`)
  }
  if (unexpectedShikiThemes.length > 0) {
    failures.push(`unexpected Shiki themes: ${unexpectedShikiThemes.join(', ')}`)
  }
  if (unexpectedRootFiles.length > 0) {
    failures.push(`unexpected packaged public files: ${unexpectedRootFiles.join(', ')}`)
  }
}

console.log('Daed Web bundle evidence')
console.log(`dist assets: ${distAssetsDir}`)
console.log(`assets: ${assets.length} total, ${jsAssets.length} js, ${cssAssets.length} css`)
console.log(`assets total: raw ${formatBytes(totalRawBytes)} / gzip ${formatBytes(totalGzipBytes)}`)
console.log(
  `full dist: ${distFiles.length} files / raw ${formatBytes(distRawBytes)} / gzip ${formatBytes(distGzipBytes)}`,
)
console.log(`Monaco workers: ${monacoWorkers.join(', ')}`)
console.log(`Shiki languages: ${emittedShikiLanguages.join(', ') || 'bundled into editor island'}`)
console.log(`Shiki themes: ${emittedShikiThemes.join(', ') || 'bundled into editor island'}`)
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
