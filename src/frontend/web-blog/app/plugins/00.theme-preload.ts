/**
 * @file 00.theme-preload.ts
 * @description 预加载所有主题组件到共享缓存，确保 ThemeComponent 在水合时可同步获取组件实例
 * @author TixXin
 * @since 2026-04-10
 */

import { defineNuxtPlugin } from '#app'
import { themeComponentLoaders, themeComponentRegistry } from '#build/theme-engine.registry.mjs'
import { themeComponentCache } from '~/utils/themeComponentCache'

export default defineNuxtPlugin({
  name: 'theme-preload',
  enforce: 'pre',
  async setup() {
    const seen = new Set<string>()

    for (const [themeName, components] of Object.entries(themeComponentLoaders)) {
      const registry = themeComponentRegistry[themeName]
      if (!registry) continue

      for (const [componentName, loader] of Object.entries(components as Record<string, unknown>)) {
        const entry = registry[componentName]
        if (!entry) continue

        const cacheKey = `${entry.sourceTheme}:${componentName}`
        if (seen.has(cacheKey)) continue
        seen.add(cacheKey)

        try {
          const mod = await (loader as () => Promise<{ default: unknown }>)()
          const component = mod.default ?? null
          if (component) {
            themeComponentCache.set(cacheKey, component as ReturnType<typeof defineComponent>)
          }
        } catch {
          // 非致命：ThemeComponent 会回退到异步加载
        }
      }
    }

    // 锚点事件：主题组件预加载完成，推进首屏加载进度到 60%
    // 若当前值已高于 60（例如页面非常快）则 set() 内部会保持不倒退
    if (import.meta.client) {
      const { set } = useLoadingProgress()
      set(60)
    }
  },
})
