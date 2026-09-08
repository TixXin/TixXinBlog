<!--
  @file ThemeComponent.vue
  @description 水合安全的主题组件加载器，覆盖 @tixxin/nuxt-theme-engine 的原始版本。
               优先从预加载缓存同步读取组件，避免水合时 defineAsyncComponent 导致的空帧 mismatch。
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
import { useThemeEngine } from '@tixxin/nuxt-theme-engine/runtime/composables/useThemeEngine'
import { getThemeComponentCache } from '~/utils/themeComponentCache'
import ThemeLoadError from '~/components/common/ThemeLoadError.vue'
import { useState } from 'nuxt/app'

/** 加载句柄跟随组件缓存所有者：浏览器共享，SSR不跨请求保留旧模块。 */
const runtimeCaches = new WeakMap()
function getRuntimeCaches(cache) {
  if (!runtimeCaches.has(cache)) runtimeCaches.set(cache, { loading: new Map(), wrappers: new Map() })
  return runtimeCaches.get(cache)
}

function resolveThemeComponent(themeName, componentName, firstThemeName) {
  const entry =
    themeComponentRegistry[themeName]?.[componentName] ?? themeComponentRegistry[firstThemeName]?.[componentName]
  const loader =
    themeComponentLoaders[themeName]?.[componentName] ?? themeComponentLoaders[firstThemeName]?.[componentName]

  if (!entry || !loader) return null

  return {
    cacheKey: `${entry.sourceTheme}:${componentName}`,
    loader,
  }
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
    const { currentTheme } = useThemeEngine()
    const firstThemeName = Object.keys(themeComponentRegistry)[0] ?? ''
    const startupContent = useState('theme-startup-content', () => null)
    const startupError = useState('theme-startup-error', () => null)

    const displayedComponent = shallowRef(null)
    const displayedCacheKey = shallowRef(null)

    const targetComponent = computed(() => resolveThemeComponent(currentTheme.value, props.name, firstThemeName))

    let activeRequestId = 0
    onBeforeUnmount(() => {
      activeRequestId++
    })

    async function syncDisplayedComponent() {
      const requestId = ++activeRequestId
      const resolved = targetComponent.value

      if (!resolved) {
        displayedComponent.value = null
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

    watch(
      [() => currentTheme.value, () => props.name],
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
      return h(
        displayedComponent.value,
        {
          ...attrs,
          ...(displayedComponent.value === ThemeLoadError && props.name === 'RootLayout'
            ? { snapshot: startupContent.value }
            : {}),
        },
        slots,
      )
    }
  },
})
</script>
