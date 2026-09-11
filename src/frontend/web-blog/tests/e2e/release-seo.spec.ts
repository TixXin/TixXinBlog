/** @file release-seo.spec.ts @description 隔离发布版本的运行时域名、索引边界及公开状态回归。 */
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

test('运行时域名贯穿订阅、站点地图与分享，草稿和撤回不被收录', async ({ request, page, baseURL }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  const origin = new URL(baseURL!).origin
  const login = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const token = (await login.json()).data.accessToken as string
  const site = await request.get('/api/v1/site')
  const headers = { Authorization: `Bearer ${token}`, 'X-Content-Context': site.headers()['x-content-context']! }
  const suffix = randomUUID().slice(0, 8)
  // 默认浏览器工厂不创建闪念；显式准备公开记录，避免以空订阅验证域名。
  const flash = await request.post('/api/v1/admin/flashes', {
    headers,
    data: { content: `订阅地址核对 ${suffix}`, isDraft: false },
  })
  expect(flash.status()).toBeLessThan(300)
  async function create(status: 'published' | 'draft', seoNoindex = false) {
    const result = await request.post('/api/v1/admin/posts', {
      headers,
      data: {
        title: `发布地址核对 ${suffix} ${status} ${seoNoindex}`,
        contentRaw: '# 发布地址\n\n文章正文与公开页面保持一致。',
        summary: '核对公开地址、订阅和索引状态。',
        status,
        seoNoindex,
      },
    })
    expect(result.status()).toBeLessThan(300)
    return (await result.json()).data as { id: number; revision: number }
  }
  const published = await create('published'),
    draft = await create('draft'),
    noindex = await create('published', true)
  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  const sitemapText = await sitemap.text()
  const locations = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!.replaceAll('&amp;', '&'))
  expect(locations.length).toBeGreaterThan(3)
  expect(locations.every((location) => new URL(location).origin === origin)).toBe(true)
  expect(locations).toContain(`${origin}/articles/${published.id}`)
  expect(locations).not.toContain(`${origin}/articles/${draft.id}`)
  expect(locations).not.toContain(`${origin}/articles/${noindex.id}`)
  expect(locations.some((location) => new URL(location).pathname.startsWith('/admin'))).toBe(false)

  for (const path of ['/rss.xml', '/flash.xml', '/moments.xml']) {
    const feed = await request.get(path)
    expect(feed.status()).toBe(200)
    const urls = [...(await feed.text()).matchAll(/<(?:link|guid)(?:\s[^>]*)?>([^<]+)<\/(?:link|guid)>/g)].map(
      (match) => match[1]!.replaceAll('&amp;', '&'),
    )
    expect(urls.length).toBeGreaterThan(1)
    expect(urls.every((url) => new URL(url).origin === origin)).toBe(true)
  }
  const robots = await request.get('/robots.txt')
  expect(await robots.text()).toContain(`${origin}/sitemap.xml`)
  const admin = await request.get('/admin/login')
  expect(admin.headers()['x-robots-tag']).toContain('noindex')
  expect((await request.get('/api/v1/posts/' + draft.id)).status()).toBe(404)

  await page.goto(`/articles/${published.id}`)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${origin}/articles/${published.id}`)
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${origin}/articles/${published.id}`)
  await expect(page.locator('meta[name="twitter:site"]')).toHaveCount(0)
  const structured = await page.locator('script[type="application/ld+json"]').allTextContents()
  expect(structured.join('')).toContain(`${origin}/articles/${published.id}`)
  await expect(page.locator('.loading-screen')).toHaveCount(0)

  const current = await request.get(`/api/v1/admin/posts/${published.id}`, { headers })
  expect(current.status()).toBe(200)
  const saved = (await current.json()).data
  const withdrawn = await request.patch(`/api/v1/admin/posts/${published.id}`, {
    headers,
    data: {
      title: saved.title,
      summary: saved.summary,
      contentRaw: saved.contentRaw,
      revision: saved.revision,
      status: 'draft',
    },
  })
  expect(withdrawn.status()).toBeLessThan(300)
  expect((await request.get(`/api/v1/posts/${published.id}`)).status()).toBe(404)
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain(`${origin}/articles/${published.id}</loc>`)
  expect(await (await request.get('/rss.xml')).text()).not.toContain(`${origin}/articles/${published.id}</link>`)
})
