/**
 * @file route-prefetch.client.ts
 * @description 开发模式下补上 NuxtLink 的路由组件预取，悬停即加载目标页模块，切页不再等整张依赖图
 * @author TixXin
 * @since 2026-10-16
 */
import { preloadRouteComponents } from '#app/composables/preload'

// Nuxt 在 dev 下跳过 preloadRouteComponents；生产已自带，这里只在开发环境补齐。
export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.dev) return
  nuxtApp.hook('link:prefetch', (path) => {
    void preloadRouteComponents(path).catch(() => {})
  })
})
