/** @file identity.get.ts @description 本机开发服务归属探针；生产构建和非本机请求返回 404 */
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineEventHandler((event) => {
  // Nuxt 本机开发代理向 Nitro worker 转发请求时，原始地址位于转发头。
  const address = event.node.req.socket.remoteAddress ?? getRequestIP(event, { xForwardedFor: true })
  if (!import.meta.dev || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? ''))
    throw createError({ statusCode: 404 })
  const root = realpathSync(resolve(process.cwd(), '../../..')).replaceAll('\\', '/')
  return {
    service: 'web-blog',
    workspace: createHash('sha256')
      .update(process.platform === 'win32' ? root.toLowerCase() : root)
      .digest('hex'),
    pid: process.pid,
    session: process.env.TIXXIN_DEV_SESSION ?? null,
  }
})
