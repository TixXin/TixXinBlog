// @vitest-environment node
/** @file apiGateway.test.ts @description 网关实际 HTTP 条件缓存、错误响应和客户端地址边界。 */
import { afterEach, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { once } from 'node:events'
import { canCacheMediaResponse, createProxyTrust, resolveProxyClientIp } from '../../server/utils/trustedProxy'

const require = createRequire(import.meta.url)
const h3 = createRequire(require.resolve('nuxt/package.json'))('h3')
const servers: Server[] = []
const runtimeConfig = vi.hoisted(() => ({ apiBaseUrl: '', trustedProxyCidrs: '' }))
mockNuxtImport('useRuntimeConfig', () => () => runtimeConfig)
afterEach(async () => {
  vi.unstubAllGlobals()
  for (const server of servers.splice(0)) {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
})
async function listen(server: Server, host = '127.0.0.1') {
  servers.push(server)
  server.listen(0, host)
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('隔离网关未取得端口')
  return `http://127.0.0.1:${address.port}`
}

it('默认忽略伪造头，只逐跳接受显式信任的 IPv4/IPv6 代理', () => {
  const trust = createProxyTrust('127.0.0.1/32, ::1/128, 192.0.2.0/24')
  expect(resolveProxyClientIp('127.0.0.1', '198.51.100.1', createProxyTrust(''))).toBe('127.0.0.1')
  expect(resolveProxyClientIp('::ffff:127.0.0.1', '198.51.100.1,192.0.2.8', trust)).toBe('198.51.100.1')
  expect(resolveProxyClientIp('::1', '203.0.113.4,198.51.100.1', trust)).toBe('198.51.100.1')
  expect(resolveProxyClientIp('127.0.0.1', 'forged,192.0.2.8', trust)).toBe('127.0.0.1')
  expect(resolveProxyClientIp(undefined, '192.0.2.8', trust)).toBe('')
  for (const value of ['true', 'loopback', '*', '127.0.0.1/33', '::1/129', '127.0.0.1/8/1']) {
    expect(() => createProxyTrust(value)).toThrow('NUXT_TRUSTED_PROXY_CIDRS')
  }
})

it('仅精确媒体 GET/HEAD 的 200/304 可保留验证缓存', () => {
  const path = 'media/08c765c3-e450-48ed-bd57-c73cd4aa7001.webp'
  for (const method of ['GET', 'HEAD'])
    for (const status of [200, 304]) expect(canCacheMediaResponse(path, method, status)).toBe(true)
  for (const other of ['posts', 'admin/media', `${path}/other`, 'media/invalid.webp'])
    expect(canCacheMediaResponse(other, 'GET', 200)).toBe(false)
  expect(canCacheMediaResponse(path, 'POST', 200)).toBe(false)
  for (const status of [400, 404, 429, 503]) expect(canCacheMediaResponse(path, 'GET', status)).toBe(false)
})

it('真实网关保留媒体 304 和 Retry-After，拒绝伪造地址，其他响应不缓存', async () => {
  const path = 'media/08c765c3-e450-48ed-bd57-c73cd4aa7001.webp'
  let deleted = false
  let receivedHeaders: Record<string, string | string[] | undefined> = {}
  const backend = await listen(
    createServer((request, response) => {
      receivedHeaders = request.headers
      response.setHeader('cache-control', 'public, max-age=31536000, immutable')
      if (request.url === '/api/v1/posts') {
        response.end('posts')
      } else if (request.url === '/api/v1/posts/limited') {
        response.statusCode = 429
        response.setHeader('retry-after', '42')
        response.end('limited')
      } else if (deleted) {
        response.statusCode = 404
        response.end('missing')
      } else {
        response.setHeader('etag', '"sha256"')
        if (request.headers['if-none-match'] === '"sha256"') response.statusCode = 304
        response.end(response.statusCode === 304 ? undefined : 'image-bytes')
      }
    }),
  )
  for (const [key, value] of Object.entries(h3)) vi.stubGlobal(key, value)
  runtimeConfig.apiBaseUrl = `${backend}/api/v1`
  runtimeConfig.trustedProxyCidrs = ''
  const handler = (await import('../../server/api/v1/[...path]')).default
  let gatewayRemoteAddress: string | undefined
  const app = h3.createApp().use(
    h3.eventHandler((event: Parameters<typeof handler>[0]) => {
      gatewayRemoteAddress = event.node.req.socket.remoteAddress
      event.context.params = { path: event.path.slice('/api/v1/'.length) }
      return handler(event)
    }),
  )
  const gateway = await listen(createServer(h3.toNodeListener(app)))
  const initial = await fetch(`${gateway}/api/v1/${path}`, {
    headers: { 'x-forwarded-for': '198.51.100.9', 'x-real-ip': '198.51.100.8', forwarded: 'for=198.51.100.7' },
  })
  expect(initial.status).toBe(200)
  expect(await initial.text()).toBe('image-bytes')
  expect(initial.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  expect(receivedHeaders['x-forwarded-for']).toBe('127.0.0.1')
  expect(receivedHeaders['x-real-ip']).toBeUndefined()
  expect(receivedHeaders.forwarded).toBeUndefined()
  const revalidated = await fetch(`${gateway}/api/v1/${path}`, { headers: { 'if-none-match': '"sha256"' } })
  expect(revalidated.status).toBe(304)
  expect(await revalidated.text()).toBe('')
  expect(revalidated.headers.get('etag')).toBe('"sha256"')
  expect(revalidated.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  const head = await fetch(`${gateway}/api/v1/${path}`, { method: 'HEAD' })
  expect(head.status).toBe(200)
  expect(await head.text()).toBe('')
  const headRevalidated = await fetch(`${gateway}/api/v1/${path}`, {
    method: 'HEAD',
    headers: { 'if-none-match': '"sha256"' },
  })
  expect(headRevalidated.status).toBe(304)
  expect(headRevalidated.headers.get('etag')).toBe('"sha256"')
  expect(await headRevalidated.text()).toBe('')
  expect((await fetch(`${gateway}/api/v1/posts`)).headers.get('cache-control')).toBe('no-store')
  const limited = await fetch(`${gateway}/api/v1/posts/limited`)
  expect(limited.status).toBe(429)
  expect(limited.headers.get('retry-after')).toBe('42')
  expect(limited.headers.get('cache-control')).toBe('no-store')
  runtimeConfig.trustedProxyCidrs = '127.0.0.1'
  await fetch(`${gateway}/api/v1/posts`, { headers: { 'x-forwarded-for': '198.51.100.9' } })
  expect(receivedHeaders['x-forwarded-for']).toBe('198.51.100.9')
  const dualStackGateway = await listen(createServer(h3.toNodeListener(app)), '::')
  for (const client of ['198.51.100.9', '198.51.100.10']) {
    await fetch(`${dualStackGateway}/api/v1/posts`, { headers: { 'x-forwarded-for': client } })
    expect(gatewayRemoteAddress).toBe('::ffff:127.0.0.1')
    expect(receivedHeaders['x-forwarded-for']).toBe(client)
  }
  deleted = true
  const missing = await fetch(`${gateway}/api/v1/${path}`, { headers: { 'if-none-match': '"sha256"' } })
  expect(missing.status).toBe(404)
  expect(missing.headers.get('cache-control')).toBe('no-store')
  runtimeConfig.apiBaseUrl = ''
  const unavailable = await fetch(`${gateway}/api/v1/${path}`)
  expect(unavailable.status).toBe(503)
  expect(unavailable.headers.get('cache-control')).toBe('no-store')
  runtimeConfig.apiBaseUrl = 'http://127.0.0.1:0/api/v1'
  const unreachable = await fetch(`${gateway}/api/v1/${path}`)
  expect(unreachable.status).toBe(502)
  expect(unreachable.headers.get('cache-control')).toBe('no-store')
})
