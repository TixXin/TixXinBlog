<!--
  @file ThemeComponent.vue
  @description 水合安全的主题组件加载器，覆盖 @tixxin/nuxt-theme-engine 的原始版本。
               优先从预加载缓存同步读取组件；缺失组件只回退宿主默认壳层（绝不跨主题回退），
               失败态提供重试，迟到资源通过缓存版本号自动恢复。
  @author TixXin
  @since 2026-04-10
-->

<script>
import {
  computed,
  defineAsyncComponent,
  defineComponent,
  h,
  onBeforeUnmount,
  onServerPrefetch,
  shallowRef,
  useAttrs,
  useSlots,
  watch,
} from 'vue'
import { themeComponentLoaders, themeComponentRegistry } from '#build/theme-engine.registry.mjs'
import { useThemeRuntime } from '~/composables/useThemeRuntime'
import { getThemeComponentCache } from '~/utils/themeComponentCache'
import { preloadLayoutTheme, themeCacheVersion } from '~/utils/themeRuntime'
import ThemeLoadError from '~/components/common/ThemeLoadError.vue'
import DefaultPostCard from '~/components/theme/DefaultPostCard.vue'
import DefaultStatusFooter from '~/components/theme/DefaultStatusFooter.vue'
import { useState } from 'nuxt/app'

/** 宿主默认壳层：主题未实现可选契约组件时使用，语义上等价于“宿主缺省样式” */
const HOST_DEFAULT_COMPONENTS = {
  PostCard: DefaultPostCard,
  StatusFooter: DefaultStatusFooter,
}
/** 未实现即合法不渲染的契约组件 */
const OPTIONAL_COMPONENTS = new Set(['ThemeAccessory'])
const warnedComponents = new Set()

/** 加载句柄跟随组件缓存所有者：浏览器共享，SSR不跨请求保留旧模块。 */
const runtimeCaches = new WeakMap()
function getRuntimeCaches(cache) {
  if (!runtimeCaches.has(cache)) runtimeCaches.set(cache, { loading: new Map(), wrappers: new Map() })
  return runtimeCaches.get(cache)
}

function resolveThemeComponent(themeName, componentName) {
  const entry = themeComponentRegistry[themeName]?.[componentName]
  const loader = themeComponentLoaders[themeName]?.[componentName]
  if (entry && loader) {
    return { cacheKey: `${entry.sourceTheme}:${componentName}`, loader }
  }
  const hostDefault = HOST_DEFAULT_COMPONENTS[componentName]
  if (hostDefault) {
    return { cacheKey: `host:${componentName}`, loader: async () => ({ default: hostDefault }) }
  }
  if (import.meta.dev && !OPTIONAL_COMPONENTS.has(componentName) && !warnedComponents.has(componentName)) {
    warnedComponents.add(componentName)
    // eslint-disable-next-line no-console -- 开发期诊断：契约组件缺失必须能被主题作者看到
    console.warn(
      `[theme] 主题 "${themeName}" 缺少契约组件 "${componentName}"，且没有宿主默认实现；请补齐契约或登记可选组件`,
    )
  }
  return null
}

async function loadThemeComponent(cacheKey, loader, themeComponentCache) {
  const loadingTaskCache = getRuntimeCaches(themeComponentCache).loading
  // 优先检查预加载缓存
  const preloaded = themeComponentCache.get(cacheKey)
  if (preloaded) {
    return preloaded
  }

  const loading = loadingTaskCache.get(cacheKey)
  if (loading) return loading

  const task = loader()
    .then((module) => {
      const component = module.default ?? null
      if (component) {
        themeComponentCache.set(cacheKey, component)
      }
      return component
    })
    .finally(() => {
      loadingTaskCache.delete(cacheKey)
    })

  loadingTaskCache.set(cacheKey, task)
  return task
}

function getAsyncComponent(cacheKey, loader, themeComponentCache) {
  const asyncComponentCache = getRuntimeCaches(themeComponentCache).wrappers
  if (!asyncComponentCache.has(cacheKey)) {
    asyncComponentCache.set(
      cacheKey,
      defineAsyncComponent({
        errorComponent: ThemeLoadError,
        timeout: 8000,
        loader: async () => {
          try {
            const component = await loadThemeComponent(cacheKey, loader, themeComponentCache)
            return component ?? ThemeLoadError
          } catch {
            return ThemeLoadError
          }
        },
      }),
    )
  }
  return asyncComponentCache.get(cacheKey) ?? null
}

export default defineComponent({
  name: 'ThemeComponent',
  inheritAttrs: false,
  props: {
    name: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const themeComponentCache = getThemeComponentCache()
    const attrs = useAttrs()
    const slots = useSlots()
    const { currentTheme } = useThemeRuntime()
    const startupContent = useState('theme-startup-content', () => null)
    const startupError = useState('theme-startup-error', () => null)

    const displayedComponent = shallowRef(null)
    const displayedCacheKey = shallowRef(null)
    const retrying = shallowRef(false)

    const targetComponent = computed(() => resolveThemeComponent(currentTheme.value, props.name))

    let activeRequestId = 0
    onBeforeUnmount(() => {
      activeRequestId++
    })

    async function syncDisplayedComponent() {
      const requestId = ++activeRequestId
      const resolved = targetComponent.value

      if (!resolved) {
        // 必需组件（RootLayout）缺失时给出可操作错误态；可选组件合法地不渲染
        displayedComponent.value = props.name === 'RootLayout' ? ThemeLoadError : null
        displayedCacheKey.value = null
        return
      }

      if (displayedCacheKey.value === resolved.cacheKey && displayedComponent.value) {
        return
      }

      // 同步路径：从预加载缓存或运行时缓存直接获取（水合关键路径）
      const preloaded = themeComponentCache.get(resolved.cacheKey)
      if (preloaded) {
        if (props.name === 'RootLayout') startupContent.value = null
        displayedComponent.value = preloaded
        displayedCacheKey.value = resolved.cacheKey
        return
      }

      // 初次加载已明确失败时直接挂载错误态，避免水合中的异步包装器再次替换同一SSR节点。
      if (import.meta.client && startupError.value) {
        displayedComponent.value = ThemeLoadError
        displayedCacheKey.value = null
        return
      }

      // 异步路径：首次加载或运行时主题切换
      const hasDisplayed = Boolean(displayedComponent.value)
      if (!hasDisplayed) {
        displayedComponent.value = getAsyncComponent(resolved.cacheKey, resolved.loader, themeComponentCache)
        displayedCacheKey.value = resolved.cacheKey
      }

      try {
        const loaded = await loadThemeComponent(resolved.cacheKey, resolved.loader, themeComponentCache)
        if (!loaded || requestId !== activeRequestId) return
        displayedComponent.value = loaded
        displayedCacheKey.value = resolved.cacheKey
      } catch {
        if (requestId !== activeRequestId) return
        displayedComponent.value = ThemeLoadError
        displayedCacheKey.value = null
      }
    }

    /** 错误态重试：重新预热当前主题；迟到成功的缓存版本变化也会触发同一路径自动恢复 */
    async function retryThemeLoad() {
      if (retrying.value) return
      retrying.value = true
      try {
        await preloadLayoutTheme(currentTheme.value)
        startupError.value = null
        await syncDisplayedComponent()
      } catch {
        startupError.value = 'layout.themeError.failed'
      } finally {
        retrying.value = false
      }
    }

    watch(
      [() => currentTheme.value, () => props.name, themeCacheVersion],
      () => {
        void syncDisplayedComponent()
      },
      { immediate: true },
    )

    onServerPrefetch(syncDisplayedComponent)

    return () => {
      if (!displayedComponent.value) return null
      if (displayedComponent.value === ThemeLoadError && props.name === 'ThemeAccessory' && startupContent.value)
        return null
      const errorProps =
        displayedComponent.value === ThemeLoadError
          ? {
              ...(props.name === 'RootLayout' ? { snapshot: startupContent.value } : {}),
              retry: retryThemeLoad,
              retrying: retrying.value,
            }
          : {}
      return h(displayedComponent.value, { ...attrs, ...errorProps }, slots)
    }
  },
})
</script>
