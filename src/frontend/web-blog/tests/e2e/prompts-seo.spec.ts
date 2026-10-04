/** @file prompts-seo.spec.ts @description 独立隔离环境检查分享深链原始 SSR head、匿名水合复用与私有/撤回索引边界。 */
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'

function headValues(html: string, tag: 'meta' | 'link', name: string, value: string, target: string) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? ''
  const result: string[] = []
  for (const entry of head.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))) {
    const attributes = Object.fromEntries(
      [...entry[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map((match) => [match[1]!, match[3]!]),
    )
    if (attributes[name] === value && attributes[target] !== undefined)
      result.push(attributes[target]!.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'"))
  }
  return result
}

test('公开分享 SSR 使用选中作品，水合不重复读详情，草稿/编辑与已撤回链接无错误图片', async ({
  request,
  page,
  baseURL,
}) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  const origin = new URL(baseURL!).origin
  const login = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const token = (await login.json()).data.accessToken as string
  const site = await request.get('/api/v1/site')
  const headers = { Authorization: `Bearer ${token}`, 'X-Content-Context': site.headers()['x-content-context']! }
  const upload = await request.post('/api/v1/admin/media', {
    headers,
    multipart: {
      file: {
        name: 'prompt-share.png',
        mimeType: 'image/png',
        buffer: Buffer.from(process.env.E2E_MEDIA_SAMPLE!, 'base64'),
      },
    },
  })
  expect(upload.status()).toBe(201)
  const media = (await upload.json()).data as { id: string; url: string }
  const suffix = randomUUID().slice(0, 8)
  async function create(title: string, status: 'draft' | 'published') {
    const response = await request.post('/api/v1/admin/prompts', {
      headers,
      data: {
        requestId: randomUUID(),
        title,
        description: `光影与纸张的质感 ${suffix}`,
        prompt: `Soft light on textured paper. ${suffix}`,
        mediaId: media.id,
        externalImageUrl: null,
        imageAlt: `纸张与光 ${suffix}`,
        status,
      },
    })
    expect(response.status()).toBe(201)
    return (await response.json()).data as {
      id: number
      revision: number
      title: string
      description: string
      prompt: string
    }
  }
  const selected = await create(`被分享的画面 ${suffix}`, 'published')
  const other = await create(`列表首图 ${suffix}`, 'published')
  const secret = await create(`私有配方 ${suffix}`, 'draft')
  expect(other.id).not.toBe(selected.id)
  const canonical = `${origin}/prompts?prompt=${selected.id}`
  const selectedUrl = `/prompts?prompt=${selected.id}&q=${encodeURIComponent(suffix)}&utm_source=share`
  const response = await request.get(selectedUrl)
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(headValues(html, 'meta', 'property', 'og:title', 'content')).toEqual([`${selected.title} · 灵感图鉴`])
  expect(headValues(html, 'meta', 'property', 'og:description', 'content')).toEqual([selected.description])
  expect(headValues(html, 'meta', 'property', 'og:image', 'content')).toEqual([new URL(media.url, origin).href])
  expect(headValues(html, 'meta', 'property', 'og:url', 'content')).toEqual([canonical])
  expect(headValues(html, 'link', 'rel', 'canonical', 'href')).toEqual([canonical])
  expect(headValues(html, 'meta', 'name', 'robots', 'content').join(',')).not.toContain('noindex')

  // 匿名浏览器只应消费服务端的详情 payload；SSR 中的站内 API 请求不会出现在此列表。
  await page.context().clearCookies()
  const detailRequests: string[] = []
  page.on('request', (entry) => {
    if (new URL(entry.url()).pathname === `/api/v1/prompts/${selected.id}`) detailRequests.push(entry.url())
  })
  await page.goto(selectedUrl)
  await expect(page.getByRole('dialog', { name: selected.title, exact: true })).toContainText(selected.prompt)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new URL(media.url, origin).href)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical)
  expect(detailRequests).toEqual([])

  for (const path of [`/prompts?view=drafts&prompt=${secret.id}`, `/prompts?edit=${secret.id}&prompt=${secret.id}`]) {
    const privateResponse = await request.get(path)
    expect(privateResponse.status()).toBe(200)
    const privateHtml = await privateResponse.text()
    expect(headValues(privateHtml, 'meta', 'name', 'robots', 'content').join(',')).toContain('noindex')
    expect(headValues(privateHtml, 'meta', 'property', 'og:image', 'content')).toEqual([])
    expect(privateHtml).not.toContain(secret.title)
  }
  const withdrawn = await request.patch(`/api/v1/admin/prompts/${selected.id}`, {
    headers,
    data: { revision: selected.revision, status: 'draft' },
  })
  expect(withdrawn.status()).toBe(200)
  const missing = await request.get(selectedUrl)
  const missingHtml = await missing.text()
  expect(headValues(missingHtml, 'meta', 'name', 'robots', 'content').join(',')).toContain('noindex')
  expect(headValues(missingHtml, 'meta', 'property', 'og:image', 'content')).toEqual([])
  expect(headValues(missingHtml, 'meta', 'property', 'og:title', 'content').join('')).not.toContain(other.title)
})
