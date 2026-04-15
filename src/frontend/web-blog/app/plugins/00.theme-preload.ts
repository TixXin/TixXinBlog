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
    const themeEntries = Object.entries(themeComponentLoaders)

    // 组件级进度锚点映射 10% → 60% 区间：
    // dev 模式下每个主题组件的 dynamic import 会触发一次 Vite on-demand transform，
    // 串行累加就是"0% 停留 8-12s"的主要来源；在每个组件完成后打锚点能把这段
    // 切成 N 个小步，中央百分比感知明显更连续（prod 下 bundle 已预编译，瞬时通过）
    //
    // 先统计去重后的总组件数，再在 await 后按 completed / total 比例递进
    const allKeys = new Set<string>()
    for (const [themeName, components] of themeEntries) {
      const registry = themeComponentRegistry[themeName]
      if (!registry) continue
      for (const componentName of Object.keys(components as Record<string, unknown>)) {
        const entry = registry[componentName]
        if (!entry) continue
        allKeys.add(`${entry.sourceTheme}:${componentName}`)
      }
    }
    const totalComponents = allKeys.size

    // 仅 client 维护 progress API 引用，SSR 阶段无 UI 可驱动；多次调用 set()
    // 复用同一 useState，但只在此处调一次 useLoadingProgress() 避免重复注册 onScopeDispose
    const progressApi = import.meta.client ? useLoadingProgress() : null
    // 启动锚点：plugin 一进入即推进 10%，即使 app.vue onMounted 尚未触发
    // （plugin enforce:'pre' 早于组件挂载），用户至少看到"开始预加载"的反馈
    progressApi?.set(10)

    let completed = 0
    for (const [themeName, components] of themeEntries) {
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

        completed++
        // 每个组件完成推进一档；totalComponents=0 时跳过，避免除零
        if (totalComponents > 0) {
          progressApi?.set(10 + (completed / totalComponents) * 50)
        }
      }
    }

    // 保底锚点：确保 plugin 结束时至少到 60%
    // （若所有迭代均 continue 导致 completed=0，或 totalComponents 为 0 时兜底）
    progressApi?.set(60)
  },
})
