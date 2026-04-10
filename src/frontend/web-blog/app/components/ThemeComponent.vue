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
  onServerPrefetch,
  shallowRef,
  useAttrs,
  useSlots,
  watch,
} from 'vue'
import { themeComponentLoaders, themeComponentRegistry } from '#build/theme-engine.registry.mjs'
import { useThemeEngine } from '@tixxin/nuxt-theme-engine/runtime/composables/useThemeEngine'
import { themeComponentCache } from '~/utils/themeComponentCache'

/** 已加载的组件缓存（运行时，与预加载缓存合并使用） */
const loadedComponentCache = new Map()

/** 正在加载的 Promise 缓存，防止重复请求 */
const loadingTaskCache = new Map()

/** defineAsyncComponent 实例缓存 */
const asyncComponentCache = new Map()

function resolveThemeComponent(themeName, componentName, firstThemeName) {
  const entry =
    themeComponentRegistry[themeName]?.[componentName] ??
    themeComponentRegistry[firstThemeName]?.[componentName]
  const loader =
    themeComponentLoaders[themeName]?.[componentName] ??
    themeComponentLoaders[firstThemeName]?.[componentName]

  if (!entry || !loader) return null

  return {
    cacheKey: `${entry.sourceTheme}:${componentName}`,
    loader,
  }
}

async function loadThemeComponent(cacheKey, loader) {
  // 优先检查预加载缓存
  const preloaded = themeComponentCache.get(cacheKey)
  if (preloaded) {
    loadedComponentCache.set(cacheKey, preloaded)
    return preloaded
  }

  const cached = loadedComponentCache.get(cacheKey)
  if (cached) return cached

  const loading = loadingTaskCache.get(cacheKey)
  if (loading) return loading

  const task = loader()
    .then((module) => {
      const component = module.default ?? null
      if (component) {
        loadedComponentCache.set(cacheKey, component)
      }
      return component
    })
    .finally(() => {
      loadingTaskCache.delete(cacheKey)
    })

  loadingTaskCache.set(cacheKey, task)
  return task
}

function getAsyncComponent(cacheKey, loader) {
  if (!asyncComponentCache.has(cacheKey)) {
    asyncComponentCache.set(
      cacheKey,
      defineAsyncComponent(async () => {
        const component = await loadThemeComponent(cacheKey, loader)
        if (!component) throw new Error(`Theme component "${cacheKey}" failed to load.`)
        return component
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
    const attrs = useAttrs()
    const slots = useSlots()
    const { currentTheme } = useThemeEngine()
    const firstThemeName = Object.keys(themeComponentRegistry)[0] ?? ''

    const displayedComponent = shallowRef(null)
    const displayedCacheKey = shallowRef(null)

    const targetComponent = computed(() =>
      resolveThemeComponent(currentTheme.value, props.name, firstThemeName),
    )

    let activeRequestId = 0

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
        displayedComponent.value = preloaded
        displayedCacheKey.value = resolved.cacheKey
        return
      }

      const cached = loadedComponentCache.get(resolved.cacheKey)
      if (cached) {
        displayedComponent.value = cached
        displayedCacheKey.value = resolved.cacheKey
        return
      }

      // 异步路径：首次加载或运行时主题切换
      const hasDisplayed = Boolean(displayedComponent.value)
      if (!hasDisplayed) {
        displayedComponent.value = getAsyncComponent(resolved.cacheKey, resolved.loader)
        displayedCacheKey.value = resolved.cacheKey
      }

      const loaded = await loadThemeComponent(resolved.cacheKey, resolved.loader)
      if (!loaded || requestId !== activeRequestId) return

      displayedComponent.value = loaded
      displayedCacheKey.value = resolved.cacheKey
    }

    watch([() => currentTheme.value, () => props.name], () => {
      void syncDisplayedComponent()
    }, { immediate: true })

    onServerPrefetch(syncDisplayedComponent)

    return () => {
      if (!displayedComponent.value) return null
      return h(displayedComponent.value, attrs, slots)
    }
  },
})
</script>
