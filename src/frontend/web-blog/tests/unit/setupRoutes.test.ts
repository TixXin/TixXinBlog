// @vitest-environment node
/**
 * @file setupRoutes.test.ts
 * @description 初始化向导页的路由规则：只做客户端渲染，所有环境禁用缓存与索引、不外传来源，不在 SSR 缓存清单内，robots 与 sitemap 排除
 * @author TixXin
 * @since 2026-10-19
 */
import { expect, it } from 'vitest'
import config from '../../nuxt.config'
import { isSsrCachedPage, SSR_CACHED_PAGES } from '../../server/utils/ssrCacheRoutes'

it('/setup 不缓存、不索引、不发送 Referer，且不进入 SSR 页面缓存', () => {
  expect(config.routeRules?.['/setup']).toEqual({
    ssr: false,
    cache: false,
    prerender: false,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Referrer-Policy': 'no-referrer',
    },
  })
  expect(SSR_CACHED_PAGES).not.toContain('/setup')
  expect(isSsrCachedPage('/setup')).toBe(false)
  expect(isSsrCachedPage(`/setup?token=${'a'.repeat(64)}`)).toBe(false)
  expect(config.sitemap?.exclude).toContain('/setup')
  expect(config.robots?.disallow).toContain('/setup')
})
