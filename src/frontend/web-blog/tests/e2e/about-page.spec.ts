/**
 * @file about-page.spec.ts
 * @description 关于页端到端：后台保存的条目链接、“现在”栏目、装备、英文资料、本站信息与支持方式经真实接口展示；
 *              网页主页声明 rel="me"，邮箱与主页不重复，结构化数据带更新时间；支持方式关闭时关于页与文章页都不出现占位
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { LOCALE_COOKIE_KEY } from '../../i18n/localeOptions'

test.beforeEach(() => {
  expect(process.env.E2E_ISOLATED).toBe('true')
})

async function admin(page: Page) {
  const login = await page.request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const token = (await login.json()).data.accessToken
  const context = (await page.request.get('/api/v1/site')).headers()['x-content-context']
  return async (path: string, method = 'GET', data?: unknown, owner = true) => {
    const response = await page.request.fetch('/api/v1' + path, {
      method,
      data,
      headers: {
        'X-Visitor-Id': 'about-' + randomUUID(),
        ...(context ? { 'X-Content-Context': context } : {}),
        ...(owner ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    expect(response.status(), `${method} ${path}`).toBeLessThan(300)
    return (await response.json()).data
  }
}
type Api = Awaited<ReturnType<typeof admin>>
async function setSite(api: Api, values: Record<string, unknown>) {
  const current = await api('/admin/site')
  const {
    updatedAt: _updatedAt,
    announcementUpdatedAt: _announcementUpdatedAt,
    ...editable
  } = {
    ...current,
    ...values,
  }
  return api('/admin/site', 'PATCH', { ...editable, revision: current.revision })
}

const about = {
  visible: true,
  introduction: '围绕这个博客记录**技术实践**。也整理 [项目](https://example.org/projects) 的维护过程。',
  en: { introduction: 'Notes on **web practice** around this blog.' },
  showSiteInfo: true,
  support: {
    visible: true,
    message: '如果文章有帮助，欢迎请我喝杯咖啡',
    messageEn: 'Buy me a coffee if a post helped',
    methods: [{ label: 'Ko-fi', url: 'https://ko-fi.com/example', image: '' }],
  },
  sections: [
    {
      kind: 'now',
      visible: true,
      updatedAt: '2026-11-01',
      items: [
        {
          title: '整理关于页',
          detail: '',
          period: '',
          visible: true,
          en: { title: 'Polishing the About page', detail: '', period: '' },
        },
      ],
    },
    {
      kind: 'uses',
      visible: true,
      items: [{ title: '机械键盘', detail: '', period: '外设', visible: true, url: 'https://example.org/keyboard' }],
    },
  ],
}

test('关于页展示新栏目、链接、本站信息与支持方式，网页主页声明 rel="me"', async ({ page }) => {
  const api = await admin(page),
    original = await api('/admin/site')
  try {
    await setSite(api, {
      about,
      socials: [
        { label: 'GitHub', href: 'https://github.com/example', icon: 'lucide:github' },
        { label: '邮箱', href: 'mailto:hi@example.org', icon: 'lucide:mail' },
      ],
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/about')
    const body = page.locator('.about-body')
    await expect(body.locator('.profile-content__intro strong')).toHaveText('技术实践')
    await expect(body.getByRole('heading', { name: '现在', exact: true })).toBeVisible()
    await expect(body.locator('.profile-content__updated time')).toHaveAttribute('datetime', '2026-11-01')
    await expect(body.getByRole('link', { name: /机械键盘/ })).toHaveAttribute('href', 'https://example.org/keyboard')
    await expect(body.getByRole('heading', { name: '关于本站', exact: true })).toBeVisible()
    // 网页主页只在顶部出现一次并声明 rel="me"；邮箱在联系卡片，当前页打开
    await expect(body.locator('a[href="https://github.com/example"]')).toHaveCount(1)
    await expect(body.locator('a[href="https://github.com/example"]')).toHaveAttribute('rel', 'me noopener')
    await expect(body.locator('a[href="mailto:hi@example.org"]')).not.toHaveAttribute('target', '_blank')
    await expect(body.locator('a[href="/guestbook"]')).toBeVisible()
    await expect(page.locator('head link[rel="me"][href="https://github.com/example"]')).toHaveCount(1)
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents()
    const profile = jsonLd.map((text) => JSON.parse(text)).find((item) => item['@type'] === 'ProfilePage')
    expect(profile.dateModified).toBeTruthy()
    expect(profile.mainEntity.description).toBe('围绕这个博客记录技术实践。')
    // 支持方式在右栏
    await expect(page.locator('.donate-card .donate-card__link')).toHaveAttribute('href', 'https://ko-fi.com/example')

    // 英文界面优先取英文资料，缺英文的条目回退中文
    await page.context().addCookies([{ name: LOCALE_COOKIE_KEY, value: 'en', url: process.env.E2E_BASE_URL! }])
    await page.reload()
    await expect(body.locator('.profile-content__intro strong')).toHaveText('web practice')
    await expect(body.getByRole('heading', { name: 'Polishing the About page' })).toBeVisible()
    await expect(body.getByRole('link', { name: /机械键盘/ })).toBeVisible()
    await expect(page.locator('.donate-card__desc')).toHaveText('Buy me a coffee if a post helped')
  } finally {
    await page.context().clearCookies({ name: LOCALE_COOKIE_KEY })
    await setSite(api, original)
  }
})

test('支持方式关闭时关于页与文章页都不显示占位卡片', async ({ page }) => {
  const api = await admin(page),
    original = await api('/admin/site')
  try {
    await setSite(api, { about: { ...about, support: { ...about.support, visible: false } } })
    const publicly = await api('/site', 'GET', undefined, false)
    expect(publicly.about.support).toBeUndefined()
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/about')
    await expect(page.locator('.about-body h1')).toBeVisible()
    await expect(page.locator('.donate-card')).toHaveCount(0)
    const post = (await api('/posts?pageSize=1', 'GET', undefined, false)).items?.[0]
    if (post) {
      await page.goto(`/articles/${post.id}`)
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(page.locator('.donate-card')).toHaveCount(0)
    }
  } finally {
    await setSite(api, original)
  }
})
