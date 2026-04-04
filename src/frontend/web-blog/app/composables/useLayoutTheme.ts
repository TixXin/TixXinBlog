/**
 * @file useLayoutTheme.ts
 * @description 对接主题引擎并合并宿主侧配置，提供主题元信息、切换状态与预热能力
 * @author TixXin
 * @since 2026-04-03
 */

import {
  DEFAULT_LAYOUT_THEME_ID,
  ensureKnownThemeId,
  themeHostConfigs,
  type LayoutThemeMeta,
} from '~/features/appearance/themeRegistry'
import { themeComponentLoaders } from '#build/theme-engine.registry.mjs'

type ThemeLoader = () => Promise<unknown>

export type ThemeSwitchState = 'idle' | 'loading' | 'error'

const preloadedThemes = new Set<string>()
const preloadTasks = new Map<string, Promise<void>>()

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

  const nextTask = Promise.all(getThemeLoaders(themeId).map((loader) => loader()))
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
  const { currentTheme, availableThemes: engineThemeIds, setTheme, themeDefinitions } = useThemeEngine()

  const switchingState = useState<ThemeSwitchState>('layout-theme-switch-state', () => 'idle')

  const currentThemeId = computed(() => ensureKnownThemeId(currentTheme.value))

  /**
   * 合并引擎发现的主题定义与宿主侧配置，生成统一的 LayoutThemeMeta。
   * 优先使用引擎提供的 label/description/meta，
   * 引擎未提供时回退到 theme.config.ts 中的值。
   */
  function buildThemeMeta(id: string): LayoutThemeMeta {
    const hostConfig = themeHostConfigs[id]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engineDef = (themeDefinitions as any)?.value?.find((d: any) => d.name === id)

    return {
      id,
      name: engineDef?.label ?? id,
      description: engineDef?.description ?? '',
      version: (engineDef?.meta?.version as string) ?? hostConfig?.version ?? '0.0.0',
      icon: (engineDef?.meta?.icon as string) ?? hostConfig?.icon ?? 'lucide:layout',
      capabilities: hostConfig?.capabilities ?? { leftSidebar: false, rightSidebar: false },
    }
  }

  const activeTheme = computed<LayoutThemeMeta>(() => buildThemeMeta(currentThemeId.value))

  /**
   * 按 themeHostConfigs 定义顺序返回可用主题列表，
   * 仅包含引擎已注册（可激活）的主题。
   */
  const availableThemes = computed<LayoutThemeMeta[]>(() => {
    const engineIds = new Set(engineThemeIds.value)
    return Object.keys(themeHostConfigs)
      .filter((id) => engineIds.has(id))
      .map((id) => buildThemeMeta(id))
  })

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
    } catch {
      switchingState.value = 'error'
    }
  }

  function preloadTheme(id: string) {
    preloadThemeRuntime(id).catch(() => {})
  }

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
