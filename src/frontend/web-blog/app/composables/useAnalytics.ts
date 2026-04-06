/**
 * @file useAnalytics.ts
 * @description 统计分析 composable，支持 Umami / Plausible 配置注入
 * @author TixXin
 * @since 2026-04-06
 */

interface AnalyticsConfig {
  provider: 'umami' | 'plausible' | ''
  siteId: string
  scriptUrl: string
}

export function useAnalytics() {
  const config = useRuntimeConfig()
  const analytics = (config.public?.analytics ?? {}) as Partial<AnalyticsConfig>

  if (!analytics.provider || !analytics.scriptUrl) return

  // Respect Do Not Track
  if (import.meta.client && navigator.doNotTrack === '1') return

  if (analytics.provider === 'umami') {
    useHead({
      script: [
        {
          src: analytics.scriptUrl,
          'data-website-id': analytics.siteId,
          async: true,
          defer: true,
        },
      ],
    })
  } else if (analytics.provider === 'plausible') {
    useHead({
      script: [
        {
          src: analytics.scriptUrl,
          'data-domain': analytics.siteId,
          async: true,
          defer: true,
        },
      ],
    })
  }
}

type WindowWithAnalytics = Window & {
  umami?: { track: (name: string, data?: Record<string, string | number>) => void }
  plausible?: (name: string, options?: { props?: Record<string, string | number> }) => void
}

export function trackEvent(name: string, data?: Record<string, string | number>) {
  if (import.meta.server) return
  const w = window as WindowWithAnalytics
  if (w.umami) {
    w.umami.track(name, data)
  }
  if (w.plausible) {
    w.plausible(name, { props: data })
  }
}
