// @vitest-environment node
/** @file postPreviewRoutes.test.ts @description 在 Node 中核对预览路由规则，避免 Nuxt 测试环境改写配置模块地址 */
import { expect, it } from 'vitest'
import config from '../../nuxt.config'

it('预览 HTML 与 API 在所有环境禁用缓存、预渲染、索引与来源传递', () => {
  for (const path of ['/posts/preview', '/api/v1/posts/preview', '/api/v1/admin/posts/*/preview-link'] as const) {
    expect(config.routeRules?.[path]).toEqual({
      cache: false,
      prerender: false,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
        'Referrer-Policy': 'no-referrer',
      },
    })
  }
  expect(config.sitemap?.exclude).toContain('/posts/preview')
  expect(config.robots?.disallow).toContain('/posts/preview')
})
