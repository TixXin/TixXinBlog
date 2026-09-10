/** @file editor-recovery.spec.ts @description 真实管理页兼容旧恢复键，异内容库完整输入在新编辑与刷新后仍只读保留 */
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { projectForm } from '../../app/features/project/editor'
import { galleryForm } from '../../app/features/gallery/editor'
import { linkForm } from '../../app/features/link/editor'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'
test.beforeEach(({ page, browserName }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  prepareMotionCapture(page, browserName)
})
for (const domain of ['project', 'gallery', 'link'] as const) {
  test(`${domain} 旧键完整副本迁入独立代次，恢复后新输入不覆盖旧资料`, async ({ page }, testInfo) => {
    const login = await page.request.post('/api/v1/auth/login', {
      data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
    })
    expect(login.status()).toBe(200)
    const auth = (await login.json()).data as { accessToken: string; user: { id: string } }
    const headers = { Authorization: `Bearer ${auth.accessToken}` }
    let mediaId: string | undefined
    if (domain === 'gallery')
      mediaId = (await (await page.request.get('/api/v1/admin/gallery?pageSize=1', { headers })).json()).data.items[0]
        .mediaId
    const path = domain === 'project' ? 'projects' : domain === 'gallery' ? 'gallery' : 'links'
    const created = await page.request.post(`/api/v1/admin/${path}`, {
      headers,
      data: {
        requestId: randomUUID(),
        ...(domain === 'link'
          ? { name: '当前内容库中的友链', url: `https://example.com/${randomUUID()}` }
          : { title: '当前内容库中的记录' }),
        ...(mediaId ? { mediaId } : {}),
      },
    })
    expect(created.status()).toBe(201)
    const current = (await created.json()).data as { id: number }
    const contextResponse = await page.request.get('/api/v1/site')
    const currentContext = contextResponse.headers()['x-content-context']!
    expect(currentContext).toBeTruthy()
    const oldContext = 'before-restore-' + randomUUID(),
      oldMedia = randomUUID()
    const form =
      domain === 'project'
        ? {
            ...projectForm(),
            title: '旧项目独有输入',
            progress: 'archived',
            status: 'withdrawn',
            sortOrder: 45,
            coverMediaId: oldMedia,
            tags: [{ label: 'UnstoredTech', color: 'rose' }],
            links: [{ kind: 'docs', href: 'https://example.com/OnlyInDraft?version=Original' }],
          }
        : domain === 'gallery'
          ? {
              ...galleryForm(),
              title: '旧图库独有输入',
              status: 'withdrawn',
              sortOrder: 45,
              category: '原分类',
              takenOn: '2024-01-08',
              location: '原地点',
              device: '原器材',
              mediaId: oldMedia,
            }
          : {
              ...linkForm(),
              name: '旧友链独有输入',
              status: 'withdrawn',
              isFeatured: true,
              sortOrder: 45,
              url: 'https://example.com/OnlyInDraft?version=Original',
              logoMediaId: oldMedia,
            }
    const prefix = `tixxin-${domain}-editor:${auth.user.id}:${current.id}`
    const legacy = {
      version: 1,
      context: oldContext,
      id: current.id,
      revision: 80,
      requestId: randomUUID(),
      savedAt: '2026-09-01T12:00:00.000Z',
      form,
      pendingCreate: null,
    }
    await page.goto('/admin')
    await expect(page.getByRole('button', { name: '退出登录', exact: true })).toBeVisible()
    await page.evaluate(({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)), {
      key: prefix,
      value: legacy,
    })
    await page.setViewportSize({ width: 390, height: 960 })
    await page.goto(`/admin/${path}/${current.id}`)
    const copies = page.getByRole('region', {
      name:
        domain === 'project'
          ? '另外保留的项目恢复副本'
          : domain === 'gallery'
            ? '另外保留的图库恢复副本'
            : '另外保留的友链恢复副本',
      exact: true,
    })
    await expect(copies).toContainText(oldMedia)
    await expect(copies).toContainText(domain !== 'gallery' ? 'OnlyInDraft?version=Original' : '2024-01-08')
    await expect(copies).toContainText(domain === 'project' ? 'UnstoredTech' : domain === 'gallery' ? '原器材' : '推荐')
    await expect(copies.locator('img, a, input, button')).toHaveCount(0)
    if (domain === 'project')
      await expect(page.getByRole('combobox', { name: '项目进展', exact: true })).toHaveValue('dev')
    await page
      .getByRole('textbox', {
        name: domain === 'project' ? '项目介绍' : domain === 'gallery' ? '作品说明' : '友链站点介绍',
        exact: true,
      })
      .fill('当前内容库继续编辑的新输入')
    await expect
      .poll(() =>
        page.evaluate((key) => Object.keys(sessionStorage).filter((name) => name.startsWith(key + ':')).length, prefix),
      )
      .toBe(2)
    page.once('dialog', (dialog) => dialog.accept())
    await page.reload()
    await expect(copies).toContainText(oldMedia)
    await expect(copies).toContainText(domain !== 'gallery' ? 'OnlyInDraft?version=Original' : '原地点')
    const retained = await page.evaluate(
      (key) =>
        Object.keys(sessionStorage)
          .filter((name) => name.startsWith(key + ':'))
          .map((name) => JSON.parse(sessionStorage.getItem(name)!)),
      prefix,
    )
    expect(retained.find((value) => value.context === oldContext)?.form).toEqual(form)
    expect(retained.find((value) => value.context === currentContext)?.form.description).toBe(
      '当前内容库继续编辑的新输入',
    )
    expect(await page.evaluate((key) => sessionStorage.getItem(key), prefix)).toBeNull()
    expect(
      (await (await page.request.get(`/api/v1/admin/${path}/${current.id}`, { headers })).json()).data.description,
    ).toBe('')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await captureMotion(page, testInfo, `${domain}-previous-library-copy.png`, { target: copies })
  })
}
