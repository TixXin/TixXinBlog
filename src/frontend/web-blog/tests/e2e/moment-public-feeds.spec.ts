/** @file moment-public-feeds.spec.ts @description 隔离验证朋友圈订阅的真实发布状态、时间排序、XML 安全和上游故障 */
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { IncomingHttpHeaders, Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import type { ManagedMoment, MomentPage } from '../../app/features/moment/types'

test.beforeAll(() => expect(process.env.E2E_ISOLATED).toBe('true'))

test('真实新动态进入最新30条，草稿归档和撤回不公开，旧置顶不挤占最新记录', async ({ request, page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const login = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const token = (await login.json()).data.accessToken as string
  const siteResponse = await request.get('/api/v1/site')
  const site = (await siteResponse.json()).data as { name: string }
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Content-Context': siteResponse.headers()['x-content-context']!,
  }
  const before = (await (await request.get('/api/v1/moments?pageSize=50&pinnedFirst=false')).json()).data as MomentPage
  expect(before.items.length).toBeGreaterThan(30)
  const oldest = before.items.at(-1)!
  const oldDetail = (await (await request.get(`/api/v1/admin/moments/${oldest.id}`, { headers })).json())
    .data as ManagedMoment
  const pinned = await request.patch(`/api/v1/admin/moments/${oldest.id}`, {
    headers,
    data: { revision: oldDetail.revision, isPinned: true },
  })
  expect(pinned.status()).toBeLessThan(300)
  expect((await (await request.get('/api/v1/moments?pageSize=1')).json()).data.items[0].id).toBe(oldest.id)
  expect((await request.get('/api/v1/moments?pinnedFirst=off')).status()).toBe(400)

  const content = `来信 ${randomUUID()} <&> "引号" '单引号' ]]> <img src=x onerror=alert(1)>`
  async function create(status: 'published' | 'draft' | 'archived') {
    const response = await request.post('/api/v1/admin/moments', {
      headers,
      data: { requestId: randomUUID(), status, content: `${content} ${status}`, topics: ['阅读 & 写作'] },
    })
    expect(response.status()).toBeLessThan(300)
    return (await response.json()).data as ManagedMoment
  }
  const published = await create('published')
  const draft = await create('draft')
  const archived = await create('archived')
  const comment = await request.post(`/api/v1/admin/moments/${published.id}/comments`, {
    headers,
    data: { requestId: randomUUID(), content: '此评论不属于订阅公开字段' },
  })
  expect(comment.status()).toBeLessThan(300)

  const jsonResponse = await request.get('/api/moments.json')
  expect(jsonResponse.status()).toBe(200)
  expect(jsonResponse.headers()['cache-control']).toBe('no-store')
  expect(jsonResponse.headers()['access-control-allow-origin']).toBe('*')
  const json = await jsonResponse.json()
  expect(json.site).toEqual({ name: site.name, url: origin })
  expect(json.count).toBe(30)
  const ordered = (await (await request.get('/api/v1/moments?pageSize=30&pinnedFirst=false')).json()).data as MomentPage
  expect(json.moments.map((moment: { id: string }) => moment.id)).toEqual(ordered.items.map((moment) => moment.id))
  expect(json.moments[0]).toMatchObject({ id: published.id, content: published.content })
  expect(json.moments.some((moment: { id: string }) => [oldest.id, draft.id, archived.id].includes(moment.id))).toBe(
    false,
  )
  for (const moment of json.moments) {
    expect(moment.url).toBe(`${origin}/moments/${moment.id}`)
    for (const field of ['comments', 'commentCount', 'isLiked', 'device', 'status', 'revision', 'linkedArticleId']) {
      expect(moment).not.toHaveProperty(field)
    }
  }

  const rssResponse = await request.get('/moments.xml')
  expect(rssResponse.status()).toBe(200)
  expect(rssResponse.headers()['cache-control']).toBe('no-store')
  const xml = await rssResponse.text()
  expect(xml).not.toContain('<![CDATA[')
  const parsed = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, 'application/xml')
    const first = document.querySelector('item')!
    const description = new DOMParser().parseFromString(first.querySelector('description')!.textContent!, 'text/html')
    return {
      errors: document.querySelectorAll('parsererror').length,
      count: document.querySelectorAll('item').length,
      title: document.querySelector('channel > title')!.textContent,
      links: [...document.querySelectorAll('item > link')].map((item) => item.textContent),
      description: description.body.textContent,
      unsafeHtml: description.querySelectorAll('script, [onerror]').length,
      topic: first.querySelector('category')!.textContent,
    }
  }, xml)
  expect(parsed).toMatchObject({
    errors: 0,
    count: 30,
    title: `${site.name} 朋友圈`,
    unsafeHtml: 0,
    topic: '阅读 & 写作',
  })
  expect(parsed.description).toBe(published.content)
  expect(parsed.links).toEqual(json.moments.map((moment: { url: string }) => moment.url))

  const current = (await (await request.get(`/api/v1/admin/moments/${published.id}`, { headers })).json())
    .data as ManagedMoment
  const withdrawn = await request.patch(`/api/v1/admin/moments/${published.id}`, {
    headers,
    data: { revision: current.revision, status: 'draft' },
  })
  expect(withdrawn.status()).toBeLessThan(300)
  expect((await request.get(`/api/v1/moments/${published.id}`)).status()).toBe(404)
  for (const path of ['/api/moments.json', '/moments.xml']) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toBe('no-store')
    expect(await response.text()).not.toContain(published.id)
    expect((await request.post(path)).status()).toBe(405)
  }
})

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

test('独立订阅进程不转发私人身份，XML特殊字符安全，上游503不会回退样本或缓存', async ({ request, page }) => {
  const seen: { url: string; headers: IncomingHttpHeaders }[] = []
  let failure: 'moments' | 'site' | undefined
  const content = '订阅 <&> "引号" \'单引号\' ]]> <script>alert(1)</script>'
  const note = {
    id: randomUUID(),
    content: content + String.fromCodePoint(0),
    date: '2026-09-11T00:00:00.000Z',
    likes: 3,
    isLiked: true,
    comments: [{ content: '私人上下文评论' }],
    topics: ['话题 < & >'],
    images: ['/api/v1/media/12345678-1234-4123-a123-123456789abc.png?x=1&y=2'],
    linkedArticle: { title: '站内文章', url: '/articles/7' },
    linkedLink: { title: '外部链接', url: 'https://example.org/read?a=1&b=2' },
  }
  const upstream = createServer((incoming, response) => {
    seen.push({ url: incoming.url!, headers: incoming.headers })
    response.setHeader('content-type', 'application/json')
    if (incoming.url?.startsWith(`/api/v1/${failure}`)) {
      response.statusCode = 503
      response.end(JSON.stringify({ code: 1, message: '隔离上游暂不可用' }))
      return
    }
    const data = incoming.url?.startsWith('/api/v1/site')
      ? { name: '来信 < & "站点" >', description: '日常 ]]> 与 <生活>' }
      : {
          items: [
            note,
            { ...note, id: 'private-draft', status: 'draft' },
            { ...note, id: 'private-archived', status: 'archived' },
            { ...note, id: 'private-deleted', deletedAt: '2026-09-11T01:00:00.000Z' },
          ],
          total: 4,
          page: 1,
          pageSize: 30,
        }
    response.end(JSON.stringify({ code: 0, data }))
  })
  const upstreamOrigin = await listen(upstream)
  const reservation = createServer()
  const origin = await listen(reservation)
  await new Promise<void>((resolve) => reservation.close(() => resolve()))
  const preview = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: new URL(origin).port,
      NUXT_API_BASE_URL: `${upstreamOrigin}/api/v1`,
      NUXT_PUBLIC_SITE_URL: origin,
      NUXT_PUBLIC_USE_MOCK_REPO: 'false',
      NUXT_PUBLIC_POST_USE_MOCK_REPO: 'false',
    },
  })
  let output = ''
  preview.stdout!.on('data', (chunk) => {
    output = (output + chunk.toString()).slice(-5000)
  })
  preview.stderr!.on('data', (chunk) => {
    output = (output + chunk.toString()).slice(-5000)
  })
  try {
    await expect
      .poll(
        async () => {
          if (preview.exitCode !== null) throw new Error(`隔离订阅预览启动失败：${output}`)
          return request
            .get(`${origin}/api/moments.json`)
            .then((response) => response.status())
            .catch(() => 0)
        },
        { timeout: 20000 },
      )
      .toBe(200)
    seen.length = 0
    const jsonResponse = await request.get(`${origin}/api/moments.json`, {
      headers: {
        Cookie: 'private_session=isolated',
        Authorization: 'Bearer isolated-private-token',
        'X-Visitor-Id': randomUUID(),
      },
    })
    const json = await jsonResponse.json()
    expect(json.count).toBe(1)
    expect(json.site).toEqual({ name: '来信 < & "站点" >', url: origin })
    expect(json.moments[0].images).toEqual([`${origin}${note.images[0]}`])
    expect(json.moments[0].linkedArticle.url).toBe(`${origin}/articles/7`)
    expect(json.moments[0].linkedLink.url).toBe(note.linkedLink.url)
    expect(json.moments[0]).not.toHaveProperty('comments')
    expect(json.moments[0]).not.toHaveProperty('isLiked')
    expect(seen.some((entry) => entry.url === '/api/v1/moments?pageSize=30&pinnedFirst=false')).toBe(true)
    for (const entry of seen) {
      expect(entry.headers.cookie).toBeUndefined()
      expect(entry.headers.authorization).toBeUndefined()
      expect(entry.headers['x-visitor-id']).toBeUndefined()
    }
    const rss = await request.get(`${origin}/moments.xml`)
    const xml = await rss.text()
    const parsed = await page.evaluate((source) => {
      const document = new DOMParser().parseFromString(source, 'application/xml')
      const description = new DOMParser().parseFromString(
        document.querySelector('item > description')!.textContent!,
        'text/html',
      )
      return {
        errors: document.querySelectorAll('parsererror').length,
        items: document.querySelectorAll('item').length,
        title: document.querySelector('channel > title')!.textContent,
        unsafeHtml: description.querySelectorAll('script, [onerror]').length,
        text: description.body.textContent,
        image: description.querySelector('img')!.getAttribute('src'),
        enclosure: document.querySelector('item > enclosure')!.getAttribute('url'),
        enclosureType: document.querySelector('item > enclosure')!.getAttribute('type'),
      }
    }, xml)
    expect(parsed).toMatchObject({
      errors: 0,
      items: 1,
      title: '来信 < & "站点" > 朋友圈',
      unsafeHtml: 0,
      text: content,
    })
    expect(parsed.image).toBe(`${origin}${note.images[0]}`)
    expect(parsed.enclosure).toBe(`${origin}${note.images[0]}`)
    expect(parsed.enclosureType).toBe('image/png')
    expect(xml).not.toContain('<![CDATA[')
    for (const unavailable of ['moments', 'site'] as const) {
      failure = unavailable
      for (const path of ['/api/moments.json', '/moments.xml']) {
        const response = await request.get(origin + path)
        expect(response.status()).toBe(503)
        expect(response.headers()['cache-control']).toBe('no-store')
        expect(await response.text()).not.toContain(note.id)
      }
    }
  } finally {
    if (preview.exitCode === null && preview.signalCode === null) {
      const exited = once(preview, 'exit')
      preview.kill()
      await exited
    }
    upstream.closeAllConnections()
    await new Promise<void>((resolve) => upstream.close(() => resolve()))
  }
})
