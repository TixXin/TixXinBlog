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
import { preloadLayoutTheme } from '~/utils/themeRuntime'

export type ThemeSwitchState = 'idle' | 'loading' | 'error'

export function useLayoutTheme() {
  const { currentTheme, availableThemes: engineThemeIds, setTheme, themeDefinitions } = useThemeEngine()

  const switchingState = useState<ThemeSwitchState>('layout-theme-switch-state', () => 'idle')
  const switchVersion = useState('layout-theme-switch-version', () => 0)
  const preloadErrors = useState<Record<string, string>>('layout-theme-preload-errors', () => ({}))
  const { startThemeSwitchLoading, endThemeSwitchLoading } = useAppLoading()
  const { error: notifyThemeError } = useToast()

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
    const version = ++switchVersion.value
    if (themeId === currentThemeId.value) {
      switchingState.value = 'idle'
      endThemeSwitchLoading()
      return
    }
    switchingState.value = 'loading'
    const previousTheme = currentThemeId.value
    startThemeSwitchLoading()
    try {
      await preloadLayoutTheme(themeId)
      if (switchVersion.value !== version) return
      if ((await setTheme(themeId)) === false) throw new Error('主题不可用')
      await nextTick()
      if (switchVersion.value === version) switchingState.value = 'idle'
    } catch {
      if (switchVersion.value !== version) return
      if (currentThemeId.value !== previousTheme) await setTheme(previousTheme)
      switchingState.value = 'error'
      notifyThemeError('主题加载失败，当前布局已保留。恢复网络后请刷新重试。')
    } finally {
      if (switchVersion.value === version) endThemeSwitchLoading()
    }
  }

  function preloadTheme(id: string) {
    void preloadLayoutTheme(ensureKnownThemeId(id)).then(
      () => {
        preloadErrors.value = Object.fromEntries(Object.entries(preloadErrors.value).filter(([key]) => key !== id))
      },
      () => {
        preloadErrors.value[id] = '主题资源未就绪，切换失败时请刷新重试。'
      },
    )
  }

  function disableCurrentTheme() {
    void setLayoutTheme(DEFAULT_LAYOUT_THEME_ID)
  }

  return {
    currentThemeId,
    activeTheme,
    availableThemes,
    switchingState,
    preloadErrors,
    setLayoutTheme,
    preloadTheme,
    disableCurrentTheme,
  }
}
