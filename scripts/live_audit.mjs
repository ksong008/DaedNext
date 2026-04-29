import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { firefox } from 'playwright'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:4199/#/setup'
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:2023/api'
const SUBSCRIPTION_SOURCE = process.env.SUBSCRIPTION_SOURCE || 'http://127.0.0.1:18080/sub.txt'
const USERNAME = process.env.AUDIT_USERNAME || 'admin'
const PASSWORD = process.env.AUDIT_PASSWORD || 'abc123'
const AUDIT_ARTIFACT_DIR = process.env.AUDIT_ARTIFACT_DIR || ''
const AUDIT_ARTIFACT_PREFIX = process.env.AUDIT_ARTIFACT_PREFIX || 'live-audit'

let browser
let page

function makeArtifactBaseName(label) {
  return `${AUDIT_ARTIFACT_PREFIX}-${label}`.replace(/[^a-zA-Z0-9._-]+/g, '-')
}

async function captureFailureArtifacts(currentPage, label, extraText = '') {
  if (!AUDIT_ARTIFACT_DIR || !currentPage) return

  await mkdir(AUDIT_ARTIFACT_DIR, { recursive: true })

  const artifactBase = path.join(AUDIT_ARTIFACT_DIR, makeArtifactBaseName(label))
  await currentPage.screenshot({ path: `${artifactBase}.png`, fullPage: true }).catch(() => {})

  const bodyText = await currentPage
    .locator('body')
    .innerText()
    .catch(() => '')
  const details = [
    `label: ${label}`,
    `url: ${currentPage.url()}`,
    extraText ? `details: ${extraText}` : '',
    '',
    bodyText,
  ]
    .filter(Boolean)
    .join('\n')

  await writeFile(`${artifactBase}.txt`, details).catch(() => {})
}

function unwrapStoredString(value) {
  if (typeof value !== 'string') return ''
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

async function waitFor(predicate, label, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const result = await predicate()
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function main() {
  browser = await firefox.launch({ headless: true })
  const context = await browser.newContext()
  page = await context.newPage()
  let signupDidNotAdvance = false

  page.on('response', async (response) => {
    if (response.url().startsWith(API_BASE)) {
      console.log(`[api] ${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  page.on('console', (message) => {
    console.log(`[console:${message.type()}] ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    console.log(`[pageerror] ${error.stack || error.message}`)
  })
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(API_BASE)) {
      console.log(`[api-fail] ${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`)
    }
  })

  console.log(`[audit] open setup: ${FRONTEND_URL}`)
  await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })

  const endpointInput = page.getByLabel(/endpoint/i)
  await endpointInput.fill(API_BASE)
  await page.getByRole('button', { name: /continue/i }).click()

  const createAccountButton = page.getByRole('button', { name: /create account/i })
  const loginButton = page.getByRole('button', { name: /login/i })

  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    if (await createAccountButton.isVisible().catch(() => false)) break
    if (await loginButton.isVisible().catch(() => false)) break
    await page.waitForTimeout(250)
  }

  if (await createAccountButton.isVisible().catch(() => false)) {
    console.log('[audit] no user exists yet, creating one')
    const signupInputs = page.locator('form').filter({ has: createAccountButton }).locator('input')
    await signupInputs.nth(0).fill(USERNAME)
    await signupInputs.nth(1).fill(PASSWORD)
    await createAccountButton.click()
    await page.waitForTimeout(2000)
  }

  console.log('[audit] logging in')
  if (
    !(await loginButton.isVisible().catch(() => false)) &&
    (await createAccountButton.isVisible().catch(() => false))
  ) {
    signupDidNotAdvance = true
    console.log('[audit] signup completed but UI did not advance to login; reloading setup flow')
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await endpointInput.fill(API_BASE)
    await page.getByRole('button', { name: /continue/i }).click()
    await loginButton.waitFor({ state: 'visible', timeout: 15000 })
  }
  if (!(await loginButton.isVisible().catch(() => false))) {
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '')
    await captureFailureArtifacts(page, 'login-button-missing', 'Login button never appeared after setup flow')
    throw new Error(`Login button never appeared. Page text snapshot:\n${text}`)
  }
  const loginInputs = page.locator('form').filter({ has: loginButton }).locator('input')
  await loginInputs.nth(0).fill(USERNAME)
  await loginInputs.nth(1).fill(PASSWORD)
  await loginButton.click()

  await page.getByRole('link', { name: /start your journey/i }).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByRole('link', { name: /start your journey/i }).click()

  await page.waitForURL(/#\/?$/, { timeout: 15000 })
  await page.waitForSelector('[data-testid="section"]', { timeout: 15000 })
  await page.waitForTimeout(1500)

  const sectionTitles = await page.locator('[data-testid="section"] h4').allInnerTexts()
  console.log(`[audit] sections: ${sectionTitles.join(', ')}`)

  const expectedSections = ['Config', 'Routing', 'DNS', 'Group', 'Node', 'Subscription']
  for (const expected of expectedSections) {
    if (!sectionTitles.some((title) => title.toLowerCase().includes(expected.toLowerCase()))) {
      throw new Error(`Missing section title: ${expected}`)
    }
  }

  const token = unwrapStoredString(await page.evaluate(() => window.localStorage.getItem('token') || ''))
  if (!token) {
    throw new Error('Token missing from localStorage after login')
  }
  console.log('[audit] token captured from browser state')

  const headers = { Authorization: `Bearer ${token}` }
  const apiJson = async (path, init = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...headers,
      },
    })
    if (!response.ok) {
      throw new Error(`${path} failed: ${response.status} ${await response.text()}`)
    }
    return response.json()
  }

  const storageResp = await fetch(
    `${API_BASE}/user/me/storage?path=defaultConfigID&path=defaultRoutingID&path=defaultDNSID&path=defaultGroupID&path=mode`,
    { headers },
  )
  if (!storageResp.ok) {
    throw new Error(`Storage query failed: ${storageResp.status}`)
  }
  const storage = await storageResp.json()
  console.log(`[audit] storage values: ${JSON.stringify(storage.values)}`)
  if (!Array.isArray(storage.values) || storage.values.length !== 5 || storage.values.slice(0, 4).some((v) => !v)) {
    throw new Error(`Default resource storage incomplete: ${JSON.stringify(storage)}`)
  }

  const configsResp = await fetch(`${API_BASE}/configs?expand=parsed`, { headers })
  const groupsResp = await fetch(`${API_BASE}/groups`, { headers })
  const runtimeResp = await fetch(`${API_BASE}/runtime/overview`, { headers })
  if (!configsResp.ok || !groupsResp.ok || !runtimeResp.ok) {
    throw new Error(
      `API status failure: configs=${configsResp.status} groups=${groupsResp.status} runtime=${runtimeResp.status}`,
    )
  }

  const configs = await configsResp.json()
  const groups = await groupsResp.json()
  const runtime = await runtimeResp.json()
  console.log(`[audit] configs=${configs.items?.length ?? 0}, groups=${groups.items?.length ?? 0}`)
  console.log(
    `[audit] runtime metrics rss=${runtime.rssBytes} heap=${runtime.heapAllocBytes} goroutines=${runtime.goroutines}`,
  )

  if (!runtime.rssBytes || !runtime.heapAllocBytes || typeof runtime.goroutines !== 'number') {
    throw new Error(`Runtime overview missing process metrics: ${JSON.stringify(runtime)}`)
  }

  const smokeNodeTag = `http-node-${Date.now()}`
  const createNodeResp = await fetch(`${API_BASE}/nodes`, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      rollbackError: false,
      args: [{ link: `http://user:pass@127.0.0.1:8080#${smokeNodeTag}`, tag: smokeNodeTag }],
    }),
  })
  if (!createNodeResp.ok) {
    throw new Error(`Node import failed: ${createNodeResp.status} ${await createNodeResp.text()}`)
  }
  const createNode = await createNodeResp.json()
  const createdNodeId = createNode.items?.[0]?.node?.id
  if (!createdNodeId) {
    throw new Error(`Node import returned no node id: ${JSON.stringify(createNode)}`)
  }

  const nodeResp = await fetch(`${API_BASE}/nodes/${createdNodeId}`, { headers })
  if (!nodeResp.ok) {
    throw new Error(`Node fetch failed: ${nodeResp.status}`)
  }
  const node = await nodeResp.json()
  console.log(`[audit] created node transport=${node.transport}`)
  if (node.transport !== 'http') {
    throw new Error(`Expected backend-supplied transport=http, got ${JSON.stringify(node)}`)
  }
  const cleanupSmokeNodeResp = await fetch(`${API_BASE}/nodes`, {
    method: 'DELETE',
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ids: [createdNodeId] }),
  })
  if (!cleanupSmokeNodeResp.ok) {
    throw new Error(`Smoke node cleanup failed: ${cleanupSmokeNodeResp.status} ${await cleanupSmokeNodeResp.text()}`)
  }

  const sections = page.locator('[data-testid="section"]')
  const configSection = sections.nth(0)
  const dnsSection = sections.nth(1)
  const routingSection = sections.nth(2)
  const groupSection = sections.nth(3)
  const nodeSection = sections.nth(4)

  const initialConfigCount = configs.items.length
  const currentFallbackResolver = configs.items?.[0]?.parsedGlobal?.fallbackResolver || '8.8.8.8:53'
  await configSection.locator('button:has(svg.lucide-copy)').first().click()
  await waitFor(async () => {
    const data = await apiJson('/configs?expand=parsed')
    return data.items?.length === initialConfigCount + 1 ? data : null
  }, 'duplicated config to appear')
  console.log('[audit] config duplicate flow passed')
  const renamedConfig = `global-copy-${Date.now()}`
  await configSection.locator('button:has(svg.lucide-type)').last().click()
  const configRenameInput = configSection.locator('input').last()
  await configRenameInput.fill(renamedConfig)
  await configRenameInput.press('Enter')
  await waitFor(async () => {
    const data = await apiJson('/configs?expand=parsed')
    return data.items?.some((item) => item.name === renamedConfig) ? data : null
  }, 'renamed config to appear')
  console.log('[audit] config rename flow passed')
  const updatedFallbackResolver = currentFallbackResolver === '1.0.0.1:53' ? '8.8.8.8:53' : '1.0.0.1:53'
  await configSection.locator('button:has(svg.lucide-settings-2)').first().click()
  const configDialog = page.getByRole('dialog').last()
  const fallbackResolverInput = configDialog.locator(`input[value="${currentFallbackResolver}"]`).first()
  await fallbackResolverInput.fill(updatedFallbackResolver)
  await configDialog.getByRole('button', { name: /submit/i }).click()
  await waitFor(async () => {
    const data = await apiJson('/configs?expand=parsed')
    return data.items?.some((item) => item.parsedGlobal?.fallbackResolver === updatedFallbackResolver) ? data : null
  }, 'updated config fallbackResolver to appear')
  console.log('[audit] config content update flow passed')
  await configSection.locator('button:has(svg.lucide-trash-2)').first().click()
  await page
    .getByRole('button', { name: /confirm/i })
    .last()
    .click()
  await waitFor(async () => {
    const data = await apiJson('/configs?expand=parsed')
    return data.items?.length === initialConfigCount ? data : null
  }, 'duplicated config to be removed')
  console.log('[audit] config remove flow passed')

  const initialDNSCount = (await apiJson('/dns?expand=parsed')).items.length
  await dnsSection.locator('button:has(svg.lucide-copy)').first().click()
  await waitFor(async () => {
    const data = await apiJson('/dns?expand=parsed')
    return data.items?.length === initialDNSCount + 1 ? data : null
  }, 'duplicated dns to appear')
  console.log('[audit] dns duplicate flow passed')
  const renamedDNS = `dns-copy-${Date.now()}`
  await dnsSection.locator('button:has(svg.lucide-type)').last().click()
  const dnsRenameInput = dnsSection.locator('input').last()
  await dnsRenameInput.fill(renamedDNS)
  await dnsRenameInput.press('Enter')
  await waitFor(async () => {
    const data = await apiJson('/dns?expand=parsed')
    return data.items?.some((item) => item.name === renamedDNS) ? data : null
  }, 'renamed dns to appear')
  console.log('[audit] dns rename flow passed')
  const currentDNS = (await apiJson('/dns?expand=parsed')).items.find((item) => item.name === renamedDNS)
  const currentUpstream = currentDNS?.dns?.includes('223.5.5.6:53') ? 'udp://223.5.5.6:53' : 'udp://223.5.5.5:53'
  const updatedUpstream = currentUpstream === 'udp://223.5.5.6:53' ? 'udp://223.5.5.5:53' : 'udp://223.5.5.6:53'
  const renamedDNSCard = dnsSection.locator('.border').filter({ hasText: renamedDNS }).first()
  await renamedDNSCard.locator('button:has(svg.lucide-settings-2)').click()
  const dnsDialog = page.getByRole('dialog').last()
  const dnsInputs = dnsDialog.locator('input')
  await dnsInputs.nth(2).fill(updatedUpstream)
  await dnsDialog.getByRole('button', { name: /confirm/i }).click()
  await waitFor(async () => {
    const data = await apiJson('/dns?expand=parsed')
    return data.items?.some(
      (item) => item.name === renamedDNS && typeof item.dns === 'string' && item.dns.includes(updatedUpstream),
    )
      ? data
      : null
  }, 'updated dns upstream to appear')
  console.log('[audit] dns content update flow passed')
  await dnsSection.locator('button:has(svg.lucide-trash-2)').first().click()
  await page
    .getByRole('button', { name: /confirm/i })
    .last()
    .click()
  await waitFor(async () => {
    const data = await apiJson('/dns?expand=parsed')
    return data.items?.length === initialDNSCount ? data : null
  }, 'duplicated dns to be removed')
  console.log('[audit] dns remove flow passed')

  const initialRoutingCount = (await apiJson('/routings?expand=parsed')).items.length
  await routingSection.locator('button:has(svg.lucide-copy)').first().click()
  await waitFor(async () => {
    const data = await apiJson('/routings?expand=parsed')
    return data.items?.length === initialRoutingCount + 1 ? data : null
  }, 'duplicated routing to appear')
  console.log('[audit] routing duplicate flow passed')
  const renamedRouting = `routing-copy-${Date.now()}`
  await routingSection.locator('button:has(svg.lucide-type)').last().click()
  const routingRenameInput = routingSection.locator('input').last()
  await routingRenameInput.fill(renamedRouting)
  await routingRenameInput.press('Enter')
  await waitFor(async () => {
    const data = await apiJson('/routings?expand=parsed')
    return data.items?.some((item) => item.name === renamedRouting) ? data : null
  }, 'renamed routing to appear')
  console.log('[audit] routing rename flow passed')
  const currentRouting = (await apiJson('/routings?expand=parsed')).items.find((item) => item.name === renamedRouting)
  const nextRoutingValue =
    typeof currentRouting?.routing === 'string' && currentRouting.routing.includes('domain(geosite:cn) -> direct')
      ? 'global'
      : 'nonCn'
  const renamedRoutingCard = routingSection.locator('.border').filter({ hasText: renamedRouting }).first()
  await renamedRoutingCard.locator('button:has(svg.lucide-settings-2)').click()
  const routingDialog = page.getByRole('dialog').last()
  await routingDialog.locator(`[data-slot="radio-group-item"][value="${nextRoutingValue}"]`).click()
  await routingDialog.getByRole('button', { name: /submit/i }).click()
  await waitFor(async () => {
    const data = await apiJson('/routings?expand=parsed')
    const updated = data.items?.find((item) => item.name === renamedRouting)
    if (!updated) return null
    if (nextRoutingValue === 'global') {
      return typeof updated.routing === 'string' && !updated.routing.includes('domain(geosite:cn) -> direct')
        ? data
        : null
    }
    return typeof updated.routing === 'string' && updated.routing.includes('domain(geosite:cn) -> direct') ? data : null
  }, 'updated routing mode to appear')
  console.log('[audit] routing content update flow passed')
  await routingSection.locator('button:has(svg.lucide-trash-2)').first().click()
  await page
    .getByRole('button', { name: /confirm/i })
    .last()
    .click()
  await waitFor(async () => {
    const data = await apiJson('/routings?expand=parsed')
    return data.items?.length === initialRoutingCount ? data : null
  }, 'duplicated routing to be removed')
  console.log('[audit] routing remove flow passed')

  const groupName = `audit-group-${Date.now()}`
  const initialGroupCount = groups.items.length
  await groupSection.locator('button:has(svg.lucide-plus)').first().click()
  const groupCreateDialog = page.getByRole('dialog')
  await groupCreateDialog.locator('input').first().fill(groupName)
  await groupCreateDialog.getByRole('button', { name: /submit/i }).click()
  await waitFor(async () => {
    const data = await apiJson('/groups')
    return data.items?.some((item) => item.name === groupName) && data.items.length === initialGroupCount + 1
      ? data
      : null
  }, 'group creation to appear')
  console.log('[audit] group create flow passed')
  await groupSection.locator('button:has(svg.lucide-settings-2)').last().click()
  const groupSettingsDialog = page.getByRole('dialog').last()
  await groupSettingsDialog.locator('[data-slot="select-trigger"]').click()
  await page
    .locator('[data-slot="select-item"]')
    .filter({ hasText: /^random$/i })
    .last()
    .click()
  await groupSettingsDialog.getByRole('button', { name: /submit/i }).click()
  await waitFor(async () => {
    const data = await apiJson('/groups')
    return data.items?.some((item) => item.name === groupName && item.policy === 'random') ? data : null
  }, 'group policy update to appear')
  console.log('[audit] group policy update flow passed')
  const renamedGroup = `audit-group-renamed-${Date.now()}`
  await groupSection.locator('button:has(svg.lucide-type)').last().click()
  const groupRenameInput = groupSection.locator('input').last()
  await groupRenameInput.fill(renamedGroup)
  await groupRenameInput.press('Enter')
  await waitFor(async () => {
    const data = await apiJson('/groups')
    return data.items?.some((item) => item.name === renamedGroup) ? data : null
  }, 'renamed group to appear')
  console.log('[audit] group rename flow passed')
  const updatedGroupCard = groupSection.locator('div[data-group-card-id]').filter({ hasText: renamedGroup }).first()
  await updatedGroupCard.locator('button:has(svg.lucide-trash-2)').click()
  await page
    .getByRole('button', { name: /confirm/i })
    .last()
    .click()
  await waitFor(async () => {
    const data = await apiJson('/groups')
    return data.items?.every((item) => item.name !== renamedGroup) ? data : null
  }, 'group removal to complete')
  console.log('[audit] group remove flow passed')

  const uiNodeTag = `ui-node-${Date.now()}`
  const initialNodeCount = (await apiJson('/nodes')).totalCount
  await nodeSection.locator('button:has(svg.lucide-cloud-upload)').first().click()
  const importDialog = page.getByRole('dialog')
  const importInputs = importDialog.locator('input')
  await importInputs.nth(0).fill('http://user:pass@127.0.0.1:8081#ui-node')
  await importInputs.nth(1).fill(uiNodeTag)
  await importDialog.getByRole('button', { name: /submit/i }).click()
  await waitFor(async () => {
    const data = await apiJson('/nodes')
    return data.totalCount === initialNodeCount + 1 && data.items?.some((item) => item.tag === uiNodeTag) ? data : null
  }, 'ui-imported node to appear')
  console.log('[audit] node import flow passed')
  const updatedNodeTag = `edited-${uiNodeTag}`
  const createdNodeCard = nodeSection.locator('div.group.relative.bg-card').filter({ hasText: uiNodeTag }).first()
  await createdNodeCard.locator('button:has(svg.lucide-pencil)').click()
  const editNodeDialog = page.getByRole('dialog').last()
  const editNodeInputs = editNodeDialog.locator('input')
  await editNodeInputs.nth(0).fill(updatedNodeTag)
  await editNodeInputs.nth(2).fill('127.0.0.2')
  await editNodeDialog.getByRole('button', { name: /submit/i }).click()
  await waitFor(async () => {
    const data = await apiJson('/nodes')
    return data.items?.some((item) => item.tag === updatedNodeTag && item.address === '127.0.0.2:8081') ? data : null
  }, 'edited node tag to appear')
  console.log('[audit] node edit flow passed')
  const updatedNodeCard = nodeSection.locator('div.group.relative.bg-card').filter({ hasText: updatedNodeTag }).first()
  await updatedNodeCard.locator('button:has(svg.lucide-trash-2)').click()
  await page
    .getByRole('button', { name: /confirm/i })
    .last()
    .click()
  await waitFor(async () => {
    const data = await apiJson('/nodes')
    return data.totalCount === initialNodeCount && data.items?.every((item) => item.tag !== updatedNodeTag)
      ? data
      : null
  }, 'ui-imported node to be removed')
  console.log('[audit] node remove flow passed')

  const subscriptionSection = sections.nth(5)
  const initialSubscriptionCount = (await apiJson('/subscriptions')).items.length
  const subscriptionTag = `audit-sub-${Date.now()}`
  const subscriptionLink = `${SUBSCRIPTION_SOURCE}?run=${Date.now()}`
  await subscriptionSection.locator('button:has(svg.lucide-cloud-upload)').first().click()
  const subscriptionDialog = page.getByRole('dialog').last()
  const subscriptionInputs = subscriptionDialog.locator('input')
  await subscriptionInputs.nth(0).fill(subscriptionLink)
  await subscriptionInputs.nth(1).fill(subscriptionTag)
  await subscriptionDialog.getByRole('button', { name: /submit/i }).click()
  await waitFor(async () => {
    const data = await apiJson('/subscriptions')
    return data.items?.length === initialSubscriptionCount + 1 &&
      data.items?.some((item) => item.tag === subscriptionTag)
      ? data
      : null
  }, 'subscription import to appear')
  console.log('[audit] subscription import flow passed')

  const updatedSubscriptionTag = `edited-${subscriptionTag}`
  const subscriptionCard = subscriptionSection
    .locator('div.group.relative.bg-card')
    .filter({ hasText: subscriptionTag })
    .first()
  await subscriptionCard.locator('button:has(svg.lucide-pencil)').click()
  const editSubscriptionDialog = page.getByRole('dialog').last()
  const editSubscriptionInputs = editSubscriptionDialog.locator('input')
  await editSubscriptionInputs.nth(1).fill(updatedSubscriptionTag)
  await editSubscriptionDialog.getByRole('button', { name: /submit/i }).click()
  await waitFor(async () => {
    const data = await apiJson('/subscriptions')
    return data.items?.some((item) => item.tag === updatedSubscriptionTag) ? data : null
  }, 'subscription edit to appear')
  console.log('[audit] subscription edit flow passed')

  const updatedSubscriptionCard = subscriptionSection
    .locator('div.group.relative.bg-card')
    .filter({ hasText: updatedSubscriptionTag })
    .first()
  await updatedSubscriptionCard.locator('button:has(svg.lucide-trash-2)').click()
  await page
    .getByRole('button', { name: /confirm/i })
    .last()
    .click()
  await waitFor(async () => {
    const data = await apiJson('/subscriptions')
    return data.items?.length === initialSubscriptionCount &&
      data.items?.every((item) => item.tag !== updatedSubscriptionTag)
      ? data
      : null
  }, 'subscription removal to complete')
  console.log('[audit] subscription remove flow passed')

  if (signupDidNotAdvance) {
    console.log('[audit] issue: signup flow did not transition to login automatically after successful user creation')
  }
  console.log('[audit] live setup/bootstrap and core mutation smoke passed')
  await browser.close()
  browser = undefined
  page = undefined
}

main().catch(async (error) => {
  await captureFailureArtifacts(page, 'failure', error instanceof Error ? error.stack || error.message : String(error))
  console.error(`[audit] failure: ${error instanceof Error ? error.stack || error.message : String(error)}`)
  await browser?.close().catch(() => {})
  process.exit(1)
})
