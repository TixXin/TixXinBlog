/**
 * @file useAnalytics.ts
 * @description 统计分析 composable，支持 Umami / Plausible 配置注入
 * @author TixXin
 * @since 2026-04-06
 */

import { isPostPreviewPath } from '~/utils/postPreviewPrivacy'

interface AnalyticsConfig {
  provider: 'umami' | 'plausible' | ''
  siteId: string
  scriptUrl: string
}

/** 浏览器发出“请勿追踪”或全球隐私控制信号时不加载统计 */
function prefersNoTracking() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true
}

export function useAnalytics() {
  // 预览页面不加载第三方脚本，避免自动页面统计采集令牌及未发布内容。
  if (isPostPreviewPath(useRoute().path)) return
  const config = useRuntimeConfig()
  const analytics = (config.public?.analytics ?? {}) as Partial<AnalyticsConfig>

  if (!analytics.provider || !analytics.scriptUrl) return
  // 只在浏览器注入：SSR 页面按 cookie 共享缓存，服务端无法为每位访客单独尊重 DNT/GPC
  if (import.meta.server) return
  if (prefersNoTracking()) return

  const dataAttribute = analytics.provider === 'umami' ? 'data-website-id' : 'data-domain'
  if (analytics.provider !== 'umami' && analytics.provider !== 'plausible') return
  useHead({
    script: [
      {
        src: analytics.scriptUrl,
        [dataAttribute]: analytics.siteId,
        async: true,
        defer: true,
      },
    ],
  })
}

type WindowWithAnalytics = Window & {
  umami?: { track: (name: string, data?: Record<string, string | number>) => void }
  plausible?: (name: string, options?: { props?: Record<string, string | number> }) => void
}

export function trackEvent(name: string, data?: Record<string, string | number>) {
  if (import.meta.server) return
  if (isPostPreviewPath(window.location.pathname)) return
  const w = window as WindowWithAnalytics
  if (w.umami) {
    w.umami.track(name, data)
  }
  if (w.plausible) {
    w.plausible(name, { props: data })
  }
}
