import http from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtemp, access, mkdir } from 'node:fs/promises'
import { constants as fsConstants, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] || '0', 10)
if (nodeMajor < 20) {
  console.error(`[live-audit-runner] Node ${process.versions.node} is too old. Use Node 22+ to run the live audit.`)
  process.exit(1)
}

const pnpmBin = process.env.PNPM_BIN || 'pnpm'
const goBin = process.env.GO_BIN || 'go'
const frontendPort = process.env.LIVE_AUDIT_FRONTEND_PORT || '4199'
const apiPort = process.env.LIVE_AUDIT_API_PORT || '2024'
const subscriptionPort = process.env.LIVE_AUDIT_SUBSCRIPTION_PORT || '18080'
const skipBuild = process.env.LIVE_AUDIT_SKIP_BUILD === '1'

function resolveWingDir() {
  if (process.env.DAEWING_DIR) return process.env.DAEWING_DIR

  const candidates = [path.join(repoRoot, 'wing'), path.resolve(repoRoot, '../dae-wing')]

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'go.mod'))) {
      return candidate
    }
  }

  throw new Error('Unable to locate dae-wing repository. Set DAEWING_DIR explicitly.')
}

function streamProcess(name, proc) {
  const attach = (stream, level) => {
    if (!stream) return
    const rl = readline.createInterface({ input: stream })
    rl.on('line', (line) => {
      console.log(`[${name}:${level}] ${line}`)
    })
  }
  attach(proc.stdout, 'out')
  attach(proc.stderr, 'err')
}

function spawnManaged(name, command, args, options) {
  const proc = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  streamProcess(name, proc)
  proc.on('exit', (code, signal) => {
    if (!options.expectedExit && code !== 0 && signal == null) {
      console.error(`[${name}] exited unexpectedly with code ${code}`)
    }
  })
  return proc
}

async function runCommand(name, command, args, options) {
  return new Promise((resolve, reject) => {
    const proc = spawnManaged(name, command, args, { ...options, expectedExit: true })
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${name} failed with code ${code}`))
      }
    })
  })
}

async function waitForUrl(url, label, timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`)
}

async function killProcess(proc, signal = 'SIGINT') {
  if (!proc || proc.killed) return
  proc.kill(signal)
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL')
      resolve()
    }, 5000)
    proc.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function main() {
  const wingDir = resolveWingDir()
  const frontendUrl = `http://127.0.0.1:${frontendPort}/#/setup`
  const apiBase = `http://127.0.0.1:${apiPort}/api`
  const subscriptionUrl = `http://127.0.0.1:${subscriptionPort}/sub.txt`

  console.log(`[live-audit-runner] repoRoot=${repoRoot}`)
  console.log(`[live-audit-runner] wingDir=${wingDir}`)

  const tempConfigDir = await mkdtemp(path.join(os.tmpdir(), 'daed-live-audit-'))
  const artifactDir = process.env.AUDIT_ARTIFACT_DIR || path.join(tempConfigDir, 'artifacts')
  console.log(`[live-audit-runner] temp config dir: ${tempConfigDir}`)
  await mkdir(artifactDir, { recursive: true })
  console.log(`[live-audit-runner] artifact dir: ${artifactDir}`)

  let subscriptionServer
  const procs = []

  const cleanup = async () => {
    await Promise.allSettled(procs.map((proc) => killProcess(proc)))
    if (subscriptionServer) {
      await new Promise((resolve) => subscriptionServer.close(resolve))
    }
  }

  process.on('SIGINT', async () => {
    await cleanup()
    process.exit(130)
  })
  process.on('SIGTERM', async () => {
    await cleanup()
    process.exit(143)
  })

  try {
    if (!skipBuild || !existsSync(path.join(repoRoot, 'apps/web/dist/index.html'))) {
      await runCommand('build', pnpmBin, ['--filter', 'daed', 'build'], { cwd: repoRoot, env: process.env })
    }

    subscriptionServer = http.createServer((req, res) => {
      const payload = Buffer.from('http://user:pass@127.0.0.1:8089#sub-http-node\n').toString('base64')
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end(payload)
    })
    await new Promise((resolve) => subscriptionServer.listen(Number(subscriptionPort), '127.0.0.1', resolve))
    console.log(`[live-audit-runner] subscription source ready at ${subscriptionUrl}`)

    const apiProc = spawnManaged(
      'dae-wing',
      goBin,
      ['run', '.', 'run', '--api-only', '--listen', `127.0.0.1:${apiPort}`, '-c', tempConfigDir],
      { cwd: wingDir, env: process.env },
    )
    procs.push(apiProc)

    const previewProc = spawnManaged(
      'daed-preview',
      pnpmBin,
      [
        '--filter',
        'daed',
        'exec',
        'vite',
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        String(frontendPort),
        '--strictPort',
      ],
      { cwd: repoRoot, env: process.env },
    )
    procs.push(previewProc)

    await waitForUrl(`http://127.0.0.1:${apiPort}/api/health`, 'dae-wing api')
    await waitForUrl(`http://127.0.0.1:${frontendPort}/`, 'daed preview')

    await runCommand('audit-fresh', process.execPath, [path.join(repoRoot, 'scripts/live_audit.mjs')], {
      cwd: repoRoot,
      env: {
        ...process.env,
        FRONTEND_URL: frontendUrl,
        API_BASE: apiBase,
        SUBSCRIPTION_SOURCE: subscriptionUrl,
        AUDIT_ARTIFACT_DIR: artifactDir,
        AUDIT_ARTIFACT_PREFIX: 'fresh',
      },
    })

    await runCommand('audit-existing', process.execPath, [path.join(repoRoot, 'scripts/live_audit.mjs')], {
      cwd: repoRoot,
      env: {
        ...process.env,
        FRONTEND_URL: frontendUrl,
        API_BASE: apiBase,
        SUBSCRIPTION_SOURCE: subscriptionUrl,
        AUDIT_ARTIFACT_DIR: artifactDir,
        AUDIT_ARTIFACT_PREFIX: 'existing',
      },
    })

    console.log('[live-audit-runner] completed successfully')
  } finally {
    await cleanup()
  }
}

main().catch((error) => {
  console.error(`[live-audit-runner] ${error instanceof Error ? error.stack || error.message : String(error)}`)
  process.exit(1)
})
