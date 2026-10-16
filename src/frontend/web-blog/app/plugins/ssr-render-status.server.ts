/**
 * @file ssr-render-status.server.ts
 * @description 上游读取失败的 SSR 渲染以 503 返回：Nitro 页面缓存不会保存 4xx/5xx 响应，失败页不会被缓存 60s
 * @author TixXin
 * @since 2026-10-16
 */
import { setResponseHeader, setResponseStatus } from 'h3'
import { ssrDegradedStatus } from '~/utils/ssrRenderStatus'

export default defineNuxtPlugin({
  name: 'ssr-render-status',
  setup(nuxtApp) {
    nuxtApp.hook('app:rendered', ({ ssrContext }) => {
      const event = ssrContext?.event
      if (!event || ssrContext.payload.error) return
      const status = ssrDegradedStatus(ssrContext.payload._errors as Record<string, unknown> | undefined)
      if (status === null) return
      setResponseStatus(event, status)
      setResponseHeader(event, 'Retry-After', '30')
      setResponseHeader(event, 'Cache-Control', 'no-store')
    })
  },
})
