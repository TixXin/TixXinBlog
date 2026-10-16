/**
 * @file [...path].ts
 * @description 同源 API 网关：浏览器不感知内网后端地址，认证 Cookie 保持相同路径
 */
import { canCacheMediaResponse, createProxyTrust, resolveProxyClientIp } from '../../utils/trustedProxy'

let proxyTrustConfig: string | undefined
let proxyTrust = createProxyTrust('')

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const path = getRouterParam(event, 'path') ?? ''
  if (
    !/^(?:posts|comments|auth|admin|flashes|moments|guestbook|gallery|prompts|projects|subscriptions|links|media|site)(?:\/|$)/.test(
      path,
    ) ||
    path.split('/').some((part) => part === '..' || part === '.')
  ) {
    throw createError({ statusCode: 404, message: '接口不存在' })
  }
  const requestUrl = getRequestURL(event)
  const origin = getHeader(event, 'origin')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.method) && origin) {
    let sameOrigin = false
    try {
      sameOrigin = new URL(origin).origin === requestUrl.origin
    } catch {
      /* 非法来源拒绝。 */
    }
    if (!sameOrigin) throw createError({ statusCode: 403, message: '不允许跨站写入' })
  }
  const config = useRuntimeConfig(event)
  const base = String(config.apiBaseUrl).replace(/\/$/, '')
  if (!/^https?:\/\//.test(base)) throw createError({ statusCode: 503, message: '后端连接尚未配置' })
  const trustConfig = String(config.trustedProxyCidrs || '')
  if (proxyTrustConfig !== trustConfig) {
    proxyTrust = createProxyTrust(trustConfig)
    proxyTrustConfig = trustConfig
  }
  const clientIp = resolveProxyClientIp(
    event.node.req.socket.remoteAddress,
    getHeader(event, 'x-forwarded-for'),
    proxyTrust,
  )
  // h3 默认透传原始请求头；清除其他地址提示，防止下游将其误认为可信身份。
  delete event.node.req.headers.forwarded
  delete event.node.req.headers['x-real-ip']
  delete event.node.req.headers['x-forwarded-for']
  try {
    return await proxyRequest(event, `${base}/${path}${requestUrl.search}`, {
      headers: { 'x-forwarded-for': clientIp },
      fetchOptions: {
        signal: AbortSignal.timeout(
          path.startsWith('admin/backup/') || path === 'admin/maintenance/media-check'
            ? 120000
            : ['admin/media', 'admin/posts/batch/execute'].includes(path) && event.method === 'POST'
              ? 60000
              : 10000,
        ),
      },
      onResponse: (_event, response) => {
        if (!canCacheMediaResponse(path, event.method, response.status)) {
          setResponseHeader(event, 'cache-control', 'no-store')
        }
      },
    })
  } catch {
    throw createError({ statusCode: 502, message: '后端暂时不可用，请稍后重试' })
  }
})
