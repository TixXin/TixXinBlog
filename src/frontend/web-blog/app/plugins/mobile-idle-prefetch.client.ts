/**
 * @file mobile-idle-prefetch.client.ts
 * @description 生产环境触屏设备在首屏空闲后预取底部导航主入口的页面代码，弥补链接只在悬停时预取带来的点击等待；
 *   只预取少数主入口，不恢复按链接可见批量预取。判定规则见 features/nav/idlePrefetch.ts
 * @author TixXin
 * @since 2026-11-05
 */
import { preloadRouteComponents } from '#app/composables/preload'
import { MOBILE_PRIMARY_PATHS } from '~/features/nav/routes'
import { idlePrefetchTargets, shouldIdlePrefetch } from '~/features/nav/idlePrefetch'

/** 不支持 requestIdleCallback 的浏览器（Safari）退化为延时执行 */
const IDLE_FALLBACK_MS = 2000

interface NetworkInformationLike {
  saveData?: boolean
  effectiveType?: string
}

function whenIdle(task: () => void) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(task, { timeout: IDLE_FALLBACK_MS * 2 })
  else setTimeout(task, IDLE_FALLBACK_MS)
}

export default defineNuxtPlugin((nuxtApp) => {
  // dev 模块未打包，预取会占满连接；dev 悬停预取由 route-prefetch.client.ts 负责
  if (import.meta.dev) return
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  const environment = {
    hoverNone: window.matchMedia('(hover: none)').matches,
    saveData: connection?.saveData,
    effectiveType: connection?.effectiveType,
  }
  if (!shouldIdlePrefetch(environment)) return
  const router = useRouter()
  const { navItems } = useNavItems()
  nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
    whenIdle(async () => {
      const navPaths = navItems.value.filter((item) => !item.external).map((item) => item.to)
      for (const path of idlePrefetchTargets(MOBILE_PRIMARY_PATHS, navPaths, router.currentRoute.value.path)) {
        // 逐个预取，避免与首屏后续请求争抢连接；失败只影响点击时是否需要临时加载
        await preloadRouteComponents(path, router).catch(() => {})
      }
    })
  })
})
