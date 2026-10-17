/**
 * @file csp-analytics.ts
 * @description 配置了 Umami/Plausible 时，按运行时脚本地址放行其 origin（脚本加载与同源上报）；未配置时不改动策略
 * @author TixXin
 * @since 2026-10-18
 */

import { getResponseHeader, setResponseHeader } from 'h3'
import { appendCspSource, scriptOrigin } from '../utils/cspSources'

export default defineNitroPlugin((nitroApp) => {
  const analytics = useRuntimeConfig().public.analytics as { provider?: string; scriptUrl?: string } | undefined
  const origin = analytics?.provider ? scriptOrigin(analytics.scriptUrl) : ''
  if (!origin) return

  nitroApp.hooks.hook('beforeResponse', (event) => {
    const policy = getResponseHeader(event, 'content-security-policy')
    if (typeof policy !== 'string') return
    setResponseHeader(event, 'content-security-policy', appendCspSource(policy, ['script-src', 'connect-src'], origin))
  })
})
