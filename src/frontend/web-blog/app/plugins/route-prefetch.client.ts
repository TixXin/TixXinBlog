/**
 * @file route-prefetch.client.ts
 * @description 开发模式下按真实悬停意图预取目标页模块，切页不再等整张依赖图；不随链接进入视口批量预取
 * @author TixXin
 * @since 2026-10-16
 */
import { preloadRouteComponents } from '#app/composables/preload'

// 悬停需持续这么久才视为有切换意图，扫过导航栏不会触发预取
const HOVER_INTENT_MS = 120

// Nuxt 在 dev 下跳过 preloadRouteComponents；生产已自带。NuxtLink 的 link:prefetch 钩子
// 不区分视口可见与悬停，dev 模块未打包，按可见批量预取会把浏览器连接占满、拖慢切页。
export default defineNuxtPlugin(() => {
  if (!import.meta.dev) return
  const router = useRouter()
  const preloaded = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined

  function targetPath(node: EventTarget | null): string | null {
    const anchor = node instanceof Element ? node.closest<HTMLAnchorElement>('a[href]') : null
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return null
    if (anchor.origin !== location.origin) return null
    const path = anchor.pathname
    if (preloaded.has(path) || router.resolve(path).matched.length === 0) return null
    return path
  }

  document.addEventListener(
    'pointerover',
    (event) => {
      clearTimeout(timer)
      const path = targetPath(event.target)
      if (!path) return
      timer = setTimeout(() => {
        preloaded.add(path)
        void preloadRouteComponents(path, router).catch(() => preloaded.delete(path))
      }, HOVER_INTENT_MS)
    },
    { passive: true },
  )
})
