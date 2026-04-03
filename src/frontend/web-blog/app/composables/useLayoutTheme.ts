/**
 * @file useLayoutTheme.ts
 * @description 对接主题引擎并补齐博客宿主所需的主题元信息、切换状态与预热能力
 * @author TixXin
 * @since 2026-04-03
 */

import {
  DEFAULT_LAYOUT_THEME_ID,
  getLayoutThemeMeta,
  isKnownLayoutThemeId,
  type LayoutThemeMeta,
} from '~/features/theme/layoutThemes'
import { themeComponentLoaders } from '#build/theme-engine.registry.mjs'

type ThemeLoader = () => Promise<unknown>

export type ThemeSwitchState = 'idle' | 'loading' | 'error'

const preloadedThemes = new Set<string>()
const preloadTasks = new Map<string, Promise<void>>()

function ensureKnownThemeId(id: string): string {
  return isKnownLayoutThemeId(id) ? id : DEFAULT_LAYOUT_THEME_ID
}

function getThemeLoaders(id: string): ThemeLoader[] {
  const loaderMap = themeComponentLoaders[id as keyof typeof themeComponentLoaders]
  if (!loaderMap) return []

  return Object.values(loaderMap) as ThemeLoader[]
}

async function preloadThemeRuntime(id: string) {
  const themeId = ensureKnownThemeId(id)

  if (preloadedThemes.has(themeId)) return

  const currentTask = preloadTasks.get(themeId)
  if (currentTask) {
    await currentTask
    return
  }

  const nextTask = Promise.all(getThemeLoaders(themeId).map(loader => loader()))
    .then(() => {
      preloadedThemes.add(themeId)
    })
    .finally(() => {
      preloadTasks.delete(themeId)
    })

  preloadTasks.set(themeId, nextTask)

  await nextTask
}

export function useLayoutTheme() {
  const {
    currentTheme,
    availableThemes: engineThemeIds,
    setTheme,
  } = useThemeEngine()

  /** 主题切换状态：idle / loading / error */
  const switchingState = useState<ThemeSwitchState>('layout-theme-switch-state', () => 'idle')

  const currentThemeId = computed(() => ensureKnownThemeId(currentTheme.value))

  const activeTheme = computed<LayoutThemeMeta>(() => getLayoutThemeMeta(currentThemeId.value))

  const availableThemes = computed<LayoutThemeMeta[]>(() =>
    engineThemeIds.value.map(themeId => getLayoutThemeMeta(themeId)),
  )

  /**
   * 切换布局主题：先预热目标主题组件，再切换当前主题。
   * 这样可以保留原先的 loading/error 状态与 hover 预热体验。
   */
  async function setLayoutTheme(id: string) {
    const themeId = ensureKnownThemeId(id)

    if (themeId === currentThemeId.value) {
      switchingState.value = 'idle'
      return
    }

    switchingState.value = 'loading'
    try {
      await preloadThemeRuntime(themeId)
      setTheme(themeId)
      switchingState.value = 'idle'
    }
    catch {
      switchingState.value = 'error'
    }
  }

  /**
   * 预加载主题运行时代码（hover 预热）。
   * 静默执行，不影响当前主题，失败不抛出。
   */
  function preloadTheme(id: string) {
    preloadThemeRuntime(id).catch(() => {})
  }

  /** 禁用当前主题并回退到默认 */
  function disableCurrentTheme() {
    setTheme(DEFAULT_LAYOUT_THEME_ID)
    switchingState.value = 'idle'
  }

  return {
    currentThemeId,
    activeTheme,
    availableThemes,
    switchingState,
    setLayoutTheme,
    preloadTheme,
    disableCurrentTheme,
  }
}
