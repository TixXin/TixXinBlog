/**
 * @file useThemeRuntime.ts
 * @description 布局主题运行时（宿主自有，替代引擎运行时）：SSR 以 cookie 决策、水合期信任 payload、
 *              水合后对账、持久化 cookie 与 storage 备份、跨标签同步，且服务端从不写主题 cookie
 * @author TixXin
 * @since 2026-10-22
 */

import type { Ref } from 'vue'
import { DEFAULT_LAYOUT_THEME_ID, registeredThemeIds } from '~/features/appearance/themeRegistry'
import {
  isLayoutThemeId,
  isLayoutThemeSource,
  isPreviewLayoutThemeSource,
  LAYOUT_THEME_BOOTSTRAP_KEY,
  LAYOUT_THEME_COOKIE_KEY,
  LAYOUT_THEME_RECONCILE_KEY,
  LAYOUT_THEME_SOURCE_KEY,
  LAYOUT_THEME_STATE_KEY,
  LAYOUT_THEME_STORAGE_KEY,
  layoutThemeCookieOptions,
  parseQueryLayoutTheme,
  planThemeReconcile,
  readStoredLayoutTheme,
  resolveLayoutTheme,
  writeStoredLayoutTheme,
  type LayoutThemeSource,
  type ThemeStorageLike,
} from '~/features/appearance/themeRuntimeState'

let clientRuntimeBound = false
let clientRuntimeScheduled = false
let suppressPersist = false

export interface ThemeRuntime {
  currentTheme: Readonly<Ref<string>>
  currentSource: Readonly<Ref<LayoutThemeSource>>
  availableThemes: Readonly<Ref<readonly string[]>>
  /** 用户主动切换：校验通过后写入状态并触发持久化；query 预览会被用户操作覆盖 */
  setTheme: (id: string) => boolean
  /** 当前是否处于 ?theme= 首屏预览（预览不写任何持久化） */
  isPreview: () => boolean
}

/** 安全取 localStorage：隐私模式/被禁用时返回 null，不阻断主题切换 */
function getSafeStorage(): ThemeStorageLike | null {
  if (!import.meta.client) return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * 只允许在 Nuxt 上下文内调用；返回跨组件共享的 useState 引用。
 * 服务端每次调用都基于当前请求重新解析；客户端只在首次调用初始化一次。
 */
export function useThemeRuntime(): ThemeRuntime {
  const nuxtApp = useNuxtApp()
  const route = useRoute()
  const currentTheme = useState<string>(LAYOUT_THEME_STATE_KEY, () => DEFAULT_LAYOUT_THEME_ID)
  const currentSource = useState<LayoutThemeSource>(LAYOUT_THEME_SOURCE_KEY, () => 'default')
  const bootstrapped = useState<boolean>(LAYOUT_THEME_BOOTSTRAP_KEY, () => false)
  const reconciled = useState<boolean>(LAYOUT_THEME_RECONCILE_KEY, () => false)
  const cookie = useCookie<string | null>(LAYOUT_THEME_COOKIE_KEY, layoutThemeCookieOptions())
  const storage = getSafeStorage()

  if (import.meta.server) {
    // 服务端按请求解析：query 预览 → cookie → 默认主题；localStorage 对服务端不可见，不参与 SSR 决策
    const resolution = resolveLayoutTheme(
      {
        queryTheme: parseQueryLayoutTheme(route.query.theme),
        cookieTheme: cookie.value,
      },
      registeredThemeIds,
      DEFAULT_LAYOUT_THEME_ID,
    )
    currentTheme.value = resolution.theme
    currentSource.value = resolution.source
    bootstrapped.value = true
  } else {
    // bootstrapped 由 SSR payload 序列化：水合期不复位状态，但客户端副作用（持久化/对账/跨标签）
    // 仍必须在这台浏览器上绑定一次，否则用户之后的切换不会被持久化。
    if (!bootstrapped.value) {
      bootstrapped.value = true
      if (nuxtApp.isHydrating) {
        // 水合期唯一正确做法：信任 SSR payload（useState 已自动恢复），不读 localStorage、不覆盖。
        // 只在 payload 非法（旧版本/被篡改）时回退默认主题。
        if (!isLayoutThemeId(currentTheme.value, registeredThemeIds)) currentTheme.value = DEFAULT_LAYOUT_THEME_ID
        if (!isLayoutThemeSource(currentSource.value)) currentSource.value = 'default'
      } else {
        // 纯客户端首启（ssr:false 或应用内二次初始化）：query → cookie → storage → 默认
        const resolution = resolveLayoutTheme(
          {
            queryTheme: parseQueryLayoutTheme(route.query.theme),
            cookieTheme: cookie.value,
            storedTheme: readStoredLayoutTheme(storage, registeredThemeIds),
          },
          registeredThemeIds,
          DEFAULT_LAYOUT_THEME_ID,
        )
        currentTheme.value = resolution.theme
        currentSource.value = resolution.source
      }
    }
    scheduleClientRuntime()
  }

  function persist(theme: string) {
    if (isPreviewLayoutThemeSource(currentSource.value)) return
    // 客户端单写 cookie：服务端写 Set-Cookie 会进入 SSR 缓存响应，串给同缓存键的其他访客
    cookie.value = theme
    writeStoredLayoutTheme(storage, theme)
  }

  function setTheme(id: string): boolean {
    if (!isLayoutThemeId(id, registeredThemeIds)) return false
    if (currentTheme.value === id && currentSource.value !== 'query') return true
    currentSource.value = 'user'
    currentTheme.value = id
    return true
  }

  function isPreview() {
    return currentSource.value === 'query'
  }

  /** 水合完成后：query 预览不持久化；cookie 权威同步备份；无 cookie 时恢复本地偏好 */
  function reconcileAfterHydration() {
    if (reconciled.value) return
    reconciled.value = true
    const plan = planThemeReconcile(
      { theme: currentTheme.value, source: currentSource.value },
      { cookieTheme: cookie.value, storedTheme: readStoredLayoutTheme(storage, registeredThemeIds) },
      registeredThemeIds,
    )
    if (plan.syncStorageTo) writeStoredLayoutTheme(storage, plan.syncStorageTo)
    if (plan.switchTo) {
      currentSource.value = 'storage'
      currentTheme.value = plan.switchTo
    }
  }

  function bindClientRuntime() {
    if (clientRuntimeBound) return
    clientRuntimeBound = true
    watch(
      currentTheme,
      (theme) => {
        if (suppressPersist) return
        if (!isLayoutThemeId(theme, registeredThemeIds)) return
        persist(theme)
      },
      { flush: 'sync' },
    )
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LAYOUT_THEME_STORAGE_KEY) return
      if (!isLayoutThemeId(event.newValue, registeredThemeIds)) return
      if (currentTheme.value === event.newValue) return
      // 其它标签页已写入 cookie+storage；本页只同步内存状态，不回写，避免广播风暴
      suppressPersist = true
      currentTheme.value = event.newValue
      currentSource.value = 'storage'
      suppressPersist = false
    }
    window.addEventListener('storage', onStorage)
    // 纯客户端首启时把解析结果落盘一次（水合路径由对账负责，不写）
    if (!nuxtApp.isHydrating && currentSource.value === 'storage') persist(currentTheme.value)
    import.meta.hot?.dispose(() => {
      window.removeEventListener('storage', onStorage)
      clientRuntimeBound = false
    })
  }

  function scheduleClientRuntime() {
    if (clientRuntimeScheduled || reconciled.value) return
    clientRuntimeScheduled = true
    bindClientRuntime()
    if (nuxtApp.isHydrating) {
      nuxtApp.hooks.hookOnce('app:suspense:resolve', reconcileAfterHydration)
    } else {
      reconcileAfterHydration()
    }
  }

  return {
    currentTheme: readonly(currentTheme),
    currentSource: readonly(currentSource),
    availableThemes: computed(() => registeredThemeIds),
    setTheme,
    isPreview,
  }
}
