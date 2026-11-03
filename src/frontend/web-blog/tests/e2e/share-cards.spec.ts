/** @file share-cards.spec.ts @description 分享卡片：缺图的文章、闪念与朋友圈输出内容卡，有图时用原图，首页与列表页兜底为站点卡，卡片地址经同源网关返回 PNG */
import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { randomUUID } from 'node:crypto'

test.beforeEach(() => {
  expect(process.env.E2E_ISOLATED).toBe('true')
})

function headValues(html: string, attribute: 'property' | 'name', value: string) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? ''
  return [...head.matchAll(/<meta\b[^>]*>/gi)]
    .map((entry) => Object.fromEntries([...entry[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!])))
    .filter((attributes) => attributes[attribute] === value)
    .map((attributes) => attributes.content!.replaceAll('&amp;', '&'))
}

async function admin(request: APIRequestContext) {
  const login = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const token = (await login.json()).data.accessToken
  return async (path: string, body: unknown) => {
    const response = await request.post('/api/v1/admin' + path, {
      data: body,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status(), path).toBeLessThan(300)
    return (await response.json()).data
  }
}

test('缺图页面输出对应分享卡片，卡片地址返回 1200×630 PNG', async ({ request }) => {
  const write = await admin(request),
    marker = randomUUID().slice(0, 8)
  const post = await write('/posts', { title: '分享卡片 ' + marker, contentRaw: '正文', status: 'published' })
  const flash = await write('/flashes', { content: '闪念卡片 ' + marker, isDraft: false })
  const moment = await write('/moments', {
    requestId: randomUUID(),
    content: '朋友圈卡片 ' + marker,
    status: 'published',
  })
  for (const [path, card] of [
    ['/', /\/api\/v1\/og\/nexus\/zh-CN\/site\.png\?v=[0-9a-z]+$/],
    ['/links', /\/api\/v1\/og\/nexus\/zh-CN\/site\.png\?v=[0-9a-z]+$/],
    [`/articles/${post.id}`, new RegExp(`/api/v1/og/nexus/zh-CN/post/${post.id}\\.png\\?v=[0-9a-z]+$`)],
    [`/flash/${flash.id}`, new RegExp(`/api/v1/og/nexus/zh-CN/flash/${flash.id}\\.png\\?v=[0-9a-z]+$`)],
    [`/moments/${moment.id}`, new RegExp(`/api/v1/og/nexus/zh-CN/moment/${moment.id}\\.png\\?v=[0-9a-z]+$`)],
  ] as const) {
    const html = await (await request.get(path)).text()
    const images = headValues(html, 'property', 'og:image')
    expect(images, path).toEqual([expect.stringMatching(card)])
    expect(headValues(html, 'name', 'twitter:card'), path).toEqual(['summary_large_image'])
    const url = new URL(images[0]!)
    const image = await request.get(url.pathname + url.search)
    expect(image.status(), path).toBe(200)
    expect(image.headers()['content-type']).toBe('image/png')
    expect(image.headers()['cache-control']).toBe('public, max-age=86400')
    const png = await image.body()
    // PNG 文件头中的宽高（IHDR）
    expect([png.readUInt32BE(16), png.readUInt32BE(20)], path).toEqual([1200, 630])
  }
})

test('有封面的文章用封面作分享图，草稿卡片与站外路径不可访问', async ({ request }) => {
  const write = await admin(request)
  const draft = await write('/posts', { title: '草稿 ' + randomUUID(), contentRaw: '正文', status: 'draft' })
  expect((await request.get(`/api/v1/og/nexus/zh-CN/post/${draft.id}.png`)).status()).toBe(404)
  expect((await request.get('/api/v1/og/retro/zh-CN/site.png')).status()).toBe(404)
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Allow: /api/v1/og/')
  const cover = 'https://example.com/cover-' + randomUUID() + '.jpg'
  const post = await write('/posts', {
    title: '有封面 ' + randomUUID(),
    cover,
    contentRaw: '正文',
    status: 'published',
  })
  const html = await (await request.get(`/articles/${post.id}`)).text()
  expect(headValues(html, 'property', 'og:image')).toEqual([cover])
})
