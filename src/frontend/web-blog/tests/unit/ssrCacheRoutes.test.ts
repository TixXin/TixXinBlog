// @vitest-environment node
/**
 * @file ssrCacheRoutes.test.ts
 * @description 服务端缓存页面清单的路径匹配，以及缓存页面条件请求只凭 ETag 验证
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { H3Event } from 'h3'
import { once } from 'node:events'
import { isSsrCachedPage, prepareSsrCachedPageRevalidation } from '../../server/utils/ssrCacheRoutes'

const require = createRequire(import.meta.url)
const h3 = createRequire(require.resolve('nuxt/package.json'))('h3')
const servers: Server[] = []
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
})

/** 按 Nitro 路由缓存处理器的出口方式回应：先用 handleCacheHeaders 判断条件请求，未命中再写缓存条目的头 */
async function startCachedPage(etag: string, modifiedTime: Date, prepare: boolean) {
  const app = h3.createApp({
    onRequest: prepare
      ? (event: H3Event) => prepareSsrCachedPageRevalidation(event.node.req, event.node.res)
      : undefined,
  })
  app.use(
    h3.eventHandler((event: H3Event) => {
      // Nitro 从缓存条目的 last-modified 字符串还原时间，精度只到秒
      const lastModified = modifiedTime.toUTCString()
      if (h3.handleCacheHeaders(event, { modifiedTime: new Date(lastModified), etag, maxAge: 60 })) return
      event.node.res.setHeader('cache-control', 's-maxage=60, stale-while-revalidate')
      event.node.res.setHeader('etag', etag)
      event.node.res.setHeader('last-modified', lastModified)
      return 'new page'
    }),
  )
  const server = createServer(h3.toNodeListener(app))
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('未取得端口')
  return `http://127.0.0.1:${address.port}/about`
}

describe('isSsrCachedPage', () => {
  it('精确页面与子路径通配均命中，查询串不影响判断', () => {
    expect(isSsrCachedPage('/')).toBe(true)
    expect(isSsrCachedPage('/?page=2')).toBe(true)
    expect(isSsrCachedPage('/projects')).toBe(true)
    expect(isSsrCachedPage('/articles/42')).toBe(true)
    expect(isSsrCachedPage('/tags/Vue3?page=2')).toBe(true)
    expect(isSsrCachedPage('/moments/topic/旅行')).toBe(true)
  })

  it('后台、接口、静态资源与未列出的页面不命中', () => {
    expect(isSsrCachedPage('/admin')).toBe(false)
    expect(isSsrCachedPage('/admin/posts')).toBe(false)
    expect(isSsrCachedPage('/api/v1/posts')).toBe(false)
    expect(isSsrCachedPage('/_nuxt/entry.js')).toBe(false)
    expect(isSsrCachedPage('/search')).toBe(false)
    expect(isSsrCachedPage('/posts/preview')).toBe(false)
    expect(isSsrCachedPage('/projectsx')).toBe(false)
  })
})

describe('prepareSsrCachedPageRevalidation', () => {
  // 旧副本与写后重新渲染的新页面生成于同一秒，Last-Modified 相同、ETag 不同
  const renderedAt = new Date('2026-10-18T13:13:49.900Z')
  const staleRequest = {
    'if-none-match': 'W/"old"',
    'if-modified-since': new Date('2026-10-18T13:13:49.100Z').toUTCString(),
  }

  it('未处理时同秒内的 If-Modified-Since 让 ETag 已变的页面仍回 304', async () => {
    const url = await startCachedPage('W/"new"', renderedAt, false)
    const response = await fetch(url, { headers: staleRequest })
    expect(response.status).toBe(304)
  })

  it('ETag 变化时返回新页面，浏览器缓存头为 no-cache', async () => {
    const url = await startCachedPage('W/"new"', renderedAt, true)
    const response = await fetch(url, { headers: staleRequest })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('new page')
    expect(response.headers.get('cache-control')).toBe('no-cache')
  })

  it('ETag 未变仍回 304，且不让浏览器在本地复用 60s', async () => {
    const url = await startCachedPage('W/"new"', renderedAt, true)
    const response = await fetch(url, { headers: { ...staleRequest, 'if-none-match': 'W/"new"' } })
    expect(response.status).toBe(304)
    expect(response.headers.get('cache-control')).toBe('no-cache')
  })
})
