/** @file postPreviewPrivacy.test.ts @description 预览页面的统计隔离、文档导航与索引缓存约束 */
import { beforeEach, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useAnalytics, trackEvent } from '~/composables/useAnalytics'
import previewPrivacyMiddleware from '~/middleware/post-preview-privacy.global'
import { isPostPreviewPath } from '~/utils/postPreviewPrivacy'

const mocks = vi.hoisted(() => ({
  route: { path: '/posts/preview' },
  app: { isHydrating: false },
  head: vi.fn(),
  navigate: vi.fn(),
}))
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport('useNuxtApp', (original) => () => {
  const app = original()
  Object.defineProperty(app, 'isHydrating', { configurable: true, get: () => mocks.app.isHydrating })
  return app
})
mockNuxtImport('useHead', () => mocks.head)
mockNuxtImport('navigateTo', () => mocks.navigate)
mockNuxtImport('useRuntimeConfig', (original) => () => ({
  ...original(),
  public: {
    ...original().public,
    analytics: { provider: 'umami', siteId: 'site', scriptUrl: 'https://stats.example/script.js' },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.route.path = '/posts/preview'
  mocks.app.isHydrating = false
  window.history.replaceState(null, '', '/')
})

it('仅匹配预览路由及其尾斜杠，正常文章不受影响', () => {
  expect(isPostPreviewPath('/posts/preview')).toBe(true)
  expect(isPostPreviewPath('/posts/preview/')).toBe(true)
  expect(isPostPreviewPath('/articles/preview')).toBe(false)
  expect(isPostPreviewPath('/posts/preview-other')).toBe(false)
})

it('预览不加载统计脚本，普通页面沿用既有统计配置', () => {
  useAnalytics()
  expect(mocks.head).not.toHaveBeenCalled()
  mocks.route.path = '/articles/12'
  useAnalytics()
  expect(mocks.head).toHaveBeenCalledWith({
    script: [expect.objectContaining({ src: 'https://stats.example/script.js', 'data-website-id': 'site' })],
  })
})

it('预览即使已有统计对象也不发送自定义事件', () => {
  const umami = { track: vi.fn() }
  const plausible = vi.fn()
  Object.assign(window, { umami, plausible })
  try {
    window.history.replaceState(null, '', '/posts/preview?token=private-preview')
    trackEvent('click')
    expect(umami.track).not.toHaveBeenCalled()
    expect(plausible).not.toHaveBeenCalled()
    window.history.replaceState(null, '', '/')
    trackEvent('click')
    expect(umami.track).toHaveBeenCalledWith('click', undefined)
    expect(plausible).toHaveBeenCalledWith('click', { props: undefined })
  } finally {
    Reflect.deleteProperty(window, 'umami')
    Reflect.deleteProperty(window, 'plausible')
  }
})

const route = (path: string, fullPath = path) => ({ path, fullPath }) as RouteLocationNormalized

it('跨预览边界整页导航，在脚本接收客户端路由变动前隔离文档', async () => {
  await previewPrivacyMiddleware(route('/posts/preview', '/posts/preview?token=private'), route('/articles/12'))
  expect(mocks.navigate).toHaveBeenCalledWith('/posts/preview?token=private', { external: true })
  mocks.navigate.mockClear()
  await previewPrivacyMiddleware(route('/'), route('/posts/preview'))
  expect(mocks.navigate).toHaveBeenCalledWith('/', { external: true })
})

it('初始 hydration 不重复重载，预览内换令牌与普通页面切换沿用客户端路由', async () => {
  mocks.app.isHydrating = true
  await previewPrivacyMiddleware(route('/posts/preview'), route('/'))
  mocks.app.isHydrating = false
  await previewPrivacyMiddleware(route('/posts/preview', '/posts/preview?token=new'), route('/posts/preview'))
  await previewPrivacyMiddleware(route('/articles/1'), route('/'))
  expect(mocks.navigate).not.toHaveBeenCalled()
})
