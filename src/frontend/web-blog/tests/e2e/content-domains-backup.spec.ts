/** @file content-domains-backup.spec.ts @description 三模块真实内容包下载、预览、草稿迁入和同票据结果重读的维护界面闭环 */
import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import type { ContentImportView } from '../../app/features/backup/types'
import type { GalleryEditable, GearItem } from '../../app/features/gallery/types'
import type { ProjectEditable } from '../../app/features/project/types'
import type { LinkEditable, LinkSettings } from '../../app/features/link/types'
import type { MediaReferences } from '../../app/features/media/types'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

interface PackageRecord<T> {
  sourceId: number
  createdAt: string
  publishedAt: string | null
  deleted: boolean
  values: T
}
interface DownloadedPackage {
  [key: string]: unknown
  format: string
  version: number
  mediaIncluded: boolean
  gallery: PackageRecord<GalleryEditable>[]
  projects: PackageRecord<ProjectEditable>[]
  links: PackageRecord<LinkEditable>[]
  gallerySettings: { gear: GearItem[] }
  linkSettings: { rules: string[] }
  media: { id: string; base64: string; sha256: string; byteSize: number }[]
}
type Domain = 'gallery' | 'projects' | 'links'
interface PageResult {
  items: { id: number }[]
  total: number
}

test.beforeEach(({ page, browserName }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  prepareMotionCapture(page, browserName)
})

test('v6 内容维护界面真实迁入三域草稿，规则与媒体保留且同票据不增殖', async ({ page }, testInfo) => {
  const login = await page.request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const accessToken = ((await login.json()).data as { accessToken: string }).accessToken
  await page.goto('/admin/maintenance')
  await expect(page.getByRole('button', { name: '退出登录', exact: true })).toBeVisible()
  const context = (await page.request.get('/api/v1/site')).headers()['x-content-context']
  expect(context).toBeTruthy()
  const headers = { Authorization: `Bearer ${accessToken}`, 'X-Content-Context': context! }
  async function read<T>(path: string, admin = false): Promise<T> {
    const response = await page.request.get(`/api/v1${path}`, { headers: admin ? headers : undefined })
    expect(response.status(), path).toBe(200)
    const envelope = (await response.json()) as { code: number; data: T }
    expect(envelope.code, path).toBe(0)
    return envelope.data
  }
  // 用真实设置建立有内容的规则前置；后续导出和迁入均由维护界面完成。
  const rules = ['希望链接指向可以直接阅读的内容。', '站点介绍以作者公开资料为准。']
  const settings = await read<LinkSettings>('/admin/links/settings', true)
  const configured = await page.request.patch('/api/v1/admin/links/settings', {
    headers,
    data: { revision: settings.revision, rules },
  })
  expect(configured.status()).toBe(200)
  const before = new Map<Domain, { publicPage: PageResult; metadata: unknown; adminTotal: number }>()
  for (const domain of ['gallery', 'projects', 'links'] as const) {
    const publicPage = await read<PageResult>(`/${domain}?pageSize=48`)
    expect(publicPage.items.length).toBe(publicPage.total)
    expect(publicPage.total).toBeGreaterThan(0)
    before.set(domain, {
      publicPage,
      metadata: await read(`/${domain}/metadata`),
      adminTotal: (await read<PageResult>(`/admin/${domain}?pageSize=1`, true)).total,
    })
  }
  const mediaTotal = (await read<PageResult>('/admin/media?pageSize=1', true)).total
  const mediaCheckbox = page.getByRole('checkbox', { name: '包含受管媒体图片文件', exact: true })
  await expect(mediaCheckbox).toBeEnabled()
  await mediaCheckbox.check()
  const downloading = page.waitForEvent('download')
  const exportResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/admin/backup/export' && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '下载内容包', exact: true }).click()
  expect((await exportResponse).status()).toBe(201)
  const download = await downloading
  const originalPath = testInfo.outputPath('v6-three-domains-original.json')
  await download.saveAs(originalPath)
  const bundle = JSON.parse(await readFile(originalPath, 'utf8')) as DownloadedPackage
  expect(bundle.format).toBe('tixxin-content')
  expect(bundle.version).toBe(6)
  expect(bundle.mediaIncluded).toBe(true)
  for (const domain of ['gallery', 'projects', 'links'] as const)
    expect(bundle[domain]).toHaveLength(before.get(domain)!.adminTotal)
  expect(bundle.linkSettings).toEqual({ rules })
  expect(bundle.gallerySettings.gear).toEqual((await read<{ gear: GearItem[] }>('/admin/gallery/settings', true)).gear)
  expect(bundle.media).toHaveLength(mediaTotal)
  const gallery = bundle.gallery.find((item) => !item.deleted && item.values.status === 'published')
  const project = bundle.projects.find(
    (item) => !item.deleted && item.values.status === 'published' && item.values.coverMediaId,
  )
  const link = bundle.links.find(
    (item) => !item.deleted && item.values.status === 'published' && item.values.logoMediaId,
  )
  if (!gallery || !project || !link) throw new Error('隔离样本必须提供三域公开内容及其受管媒体')
  const chosen = [
    { domain: 'gallery', record: gallery, mediaId: gallery.values.mediaId, kind: 'gallery' },
    { domain: 'projects', record: project, mediaId: project.values.coverMediaId!, kind: 'project' },
    { domain: 'links', record: link, mediaId: link.values.logoMediaId!, kind: 'link' },
  ] as const
  expect(new Set(chosen.map((item) => item.mediaId)).size).toBe(3)
  const sourceRecords = new Map<Domain, unknown>()
  const referenceCounts = new Map<string, number>()
  for (const item of chosen) {
    sourceRecords.set(item.domain, await read(`/admin/${item.domain}/${item.record.sourceId}`, true))
    const media = bundle.media.find((asset) => asset.id === item.mediaId)
    expect(media).toBeDefined()
    const bytes = Buffer.from(media!.base64, 'base64')
    expect(bytes.length).toBe(media!.byteSize)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(media!.sha256)
    referenceCounts.set(
      item.mediaId,
      (await read<MediaReferences>(`/admin/media/${item.mediaId}/references`, true)).total,
    )
  }
  // 仅裁去无关业务记录；保留真实 v6 配置和全部媒体清单/字节，避免丢掉站点头像等引用。
  const selected = {
    ...bundle,
    posts: [],
    flashes: [],
    moments: [],
    guestbook: [],
    gallery: [gallery],
    projects: [project],
    links: [link],
  }
  const selectedPath = testInfo.outputPath('v6-three-domains-copy.json')
  await writeFile(selectedPath, JSON.stringify(selected, null, 2))
  await page.getByRole('combobox', { name: '重复内容策略', exact: true }).selectOption('copy')
  await page.getByRole('checkbox', { name: /同时迁入站点资料、器材介绍、友链须知和评论审核设置/ }).check()
  const fileInput = page.getByRole('region', { name: '选择内容包', exact: true }).locator('input[type="file"]')
  await expect(fileInput).toBeEnabled()
  await fileInput.setInputFiles(selectedPath)
  const previewing = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/admin/backup/imports/preview' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '生成导入预览', exact: true }).click()
  const previewResponse = await previewing
  expect(previewResponse.status()).toBe(201)
  const planned = (await previewResponse.json()).data as ContentImportView
  expect(planned.strategy).toBe('copy')
  expect(planned.plan.ready).toBe(true)
  expect(planned.plan.errors).toEqual([])
  expect(planned.plan.counts).toMatchObject({
    posts: 0,
    flashes: 0,
    moments: 0,
    guestbook: 0,
    comments: 0,
    gallery: 1,
    projects: 1,
    links: 1,
    skipped: 0,
    media: 0,
    files: 0,
    settings: true,
  })
  expect(planned.linkSettingsPreview).toEqual({ rules })
  const preview = page.getByRole('region', { name: '内容导入预览', exact: true })
  await expect(preview).toContainText(planned.ticket)
  await expect(preview).toContainText(/迁入\s+1\s+件图库作品/)
  await expect(preview).toContainText(/迁入\s+1\s+个项目/)
  await expect(preview).toContainText(/迁入\s+1\s+条友链草稿/)
  for (const rule of rules)
    await expect(page.getByRole('region', { name: '将写入的友链须知', exact: true })).toContainText(rule)
  const confirm = preview.getByRole('button', { name: '确认导入预览内容', exact: true })
  await expect(confirm).toBeDisabled()
  await preview.getByRole('textbox', { name: '输入“导入为新草稿”确认', exact: true }).fill('导入为新草稿')
  await expect(confirm).toBeEnabled()
  const executing = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/admin/backup/imports/${planned.ticket}/execute` &&
      response.request().method() === 'POST',
  )
  await confirm.click()
  const executeResponse = await executing
  expect(executeResponse.status()).toBe(201)
  const completed = (await executeResponse.json()).data as ContentImportView
  expect(completed.completed).toBe(true)
  expect(completed.result).toMatchObject({
    posts: [],
    flashes: [],
    moments: [],
    guestbook: [],
    comments: 0,
    media: 0,
    files: 0,
    settings: true,
  })
  await expect(preview).toContainText(/已迁入\s+1\s+件图库草稿/)
  await expect(preview).toContainText(/已迁入\s+1\s+个项目草稿/)
  await expect(preview).toContainText(/已迁入\s+1\s+条友链草稿/)
  await expect(preview.getByRole('button', { name: '查询导入结果', exact: true })).toBeEnabled()
  for (const item of chosen) {
    const copies = completed.result?.[item.domain]
    expect(copies).toHaveLength(1)
    const copy = copies![0]!
    expect(copy.sourceId).toBe(item.record.sourceId)
    expect(copy.id).not.toBe(copy.sourceId)
    expect(await read(`/admin/${item.domain}/${copy.id}`, true)).toMatchObject({
      ...item.record.values,
      status: 'draft',
    })
    expect((await page.request.get(`/api/v1/${item.domain}/${copy.id}`)).status()).toBe(404)
    expect(await read(`/admin/${item.domain}/${item.record.sourceId}`, true)).toEqual(sourceRecords.get(item.domain))
    expect((await read<PageResult>(`/admin/${item.domain}?pageSize=1`, true)).total).toBe(
      before.get(item.domain)!.adminTotal + 1,
    )
    expect(await read(`/${item.domain}?pageSize=48`)).toEqual(before.get(item.domain)!.publicPage)
    expect(await read(`/${item.domain}/metadata`)).toEqual(before.get(item.domain)!.metadata)
    const references = await read<MediaReferences>(`/admin/media/${item.mediaId}/references`, true)
    expect(references.total).toBe(referenceCounts.get(item.mediaId)! + 1)
    expect(
      references.items.some((entry) => entry.kind === item.kind && entry.url === `/admin/${item.domain}/${copy.id}`),
    ).toBe(true)
  }
  expect((await read<PageResult>('/admin/media?pageSize=1', true)).total).toBe(mediaTotal)
  // 已完成票据没有第二个执行按钮；对同一真实票据重放原确认，再从界面读回持久化结果。
  const repeated = await page.request.post(`/api/v1/admin/backup/imports/${planned.ticket}/execute`, {
    headers,
    data: { acknowledgement: '导入为新草稿', confirmation: planned.confirmation },
  })
  expect(repeated.status()).toBe(201)
  expect((await repeated.json()).data.result).toEqual(completed.result)
  await page.goto(`/admin/maintenance?import=${planned.ticket}`)
  await expect(page.getByRole('button', { name: '退出登录', exact: true })).toBeVisible()
  await expect(preview).toContainText(planned.ticket)
  await expect(preview.getByRole('link', { name: '检查图库草稿', exact: true })).toBeVisible()
  await expect(preview.getByRole('link', { name: '检查项目草稿', exact: true })).toBeVisible()
  await expect(preview.getByRole('link', { name: '检查友链草稿', exact: true })).toBeVisible()
  await preview.getByRole('button', { name: '查询导入结果', exact: true }).click()
  await expect(preview.getByRole('button', { name: '查询导入结果', exact: true })).toBeEnabled()
  for (const item of chosen) {
    expect((await read<PageResult>(`/admin/${item.domain}?pageSize=1`, true)).total).toBe(
      before.get(item.domain)!.adminTotal + 1,
    )
    expect(await read(`/admin/${item.domain}/${item.record.sourceId}`, true)).toEqual(sourceRecords.get(item.domain))
    expect(await read(`/${item.domain}?pageSize=48`)).toEqual(before.get(item.domain)!.publicPage)
    expect(await read(`/${item.domain}/metadata`)).toEqual(before.get(item.domain)!.metadata)
  }
  const persisted = await read<ContentImportView>(`/admin/backup/imports/${planned.ticket}`, true)
  expect(persisted.result).toEqual(completed.result)
  await writeFile(
    testInfo.outputPath('v6-three-domains-result.json'),
    JSON.stringify({ ticket: planned.ticket, plan: planned.plan.counts, result: persisted.result }, null, 2),
  )
  await page.setViewportSize({ width: 390, height: 960 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await captureMotion(page, testInfo, 'v6-three-domains-result-mobile.png', { target: preview })
})
