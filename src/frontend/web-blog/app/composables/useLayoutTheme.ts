/**
 * @file useLayoutTheme.ts
 * @description 布局主题门面：合并引擎主题元信息与宿主能力，管理预热、切换事务（可回滚/可重试）与失败反馈
 * @author TixXin
 * @since 2026-04-03
 */

import {
  DEFAULT_LAYOUT_THEME_ID,
  ensureKnownThemeId,
  findEngineThemeDefinition,
  getThemeCapabilities,
  layoutThemeIds,
  type LayoutThemeMeta,
  registeredThemeIds,
} from '~/features/appearance/themeRegistry'
import { useThemeRuntime } from '~/composables/useThemeRuntime'
import { preloadLayoutTheme } from '~/utils/themeRuntime'
import { captureThemeSwitchSnapshot, restoreThemeSwitchSnapshot } from '~/utils/themeSwitchScroll'

export type ThemeSwitchState = 'idle' | 'loading' | 'error'

export function useLayoutTheme() {
  const { currentTheme, availableThemes: runtimeThemeIds, setTheme } = useThemeRuntime()

  const switchingState = useState<ThemeSwitchState>('layout-theme-switch-state', () => 'idle')
  const switchVersion = useState('layout-theme-switch-version', () => 0)
  const preloadErrors = useState<Record<string, string>>('layout-theme-preload-errors', () => ({}))
  const { startThemeSwitchLoading, endThemeSwitchLoading } = useAppLoading()
  const { error: notifyThemeError } = useToast()
  const i18n = useNuxtApp().$i18n

  /** theme.json 的 label/description 写 theme 域字典 key；第三方主题写字面文案时原样展示 */
  function localizeThemeText(value: string | null | undefined): string | undefined {
    return value && i18n.te(value) ? i18n.t(value) : (value ?? undefined)
  }

  const currentThemeId = computed(() => ensureKnownThemeId(currentTheme.value))

  /**
   * 合并引擎发现的主题定义与宿主能力，生成统一的 LayoutThemeMeta。
   * 名称/介绍/版本/图标只来自 theme.json（单一事实源）；缺失时使用中性兜底并在开发期告警。
   */
  function buildThemeMeta(id: string): LayoutThemeMeta {
    const definition = findEngineThemeDefinition(id)
    if (!definition && import.meta.dev) {
      // eslint-disable-next-line no-console -- 开发期诊断：主题元信息缺失属于必须提示的配置错误
      console.warn(`[theme] 引擎未发现主题 "${id}" 的 theme.json 定义，外观面板使用中性兜底元信息`)
    }
    return {
      id,
      name: localizeThemeText(definition?.label) ?? id,
      description: localizeThemeText(definition?.description) ?? '',
      version: typeof definition?.meta?.version === 'string' ? definition.meta.version : '0.0.0',
      icon: typeof definition?.meta?.icon === 'string' ? definition.meta.icon : 'lucide:layout',
      capabilities: getThemeCapabilities(id),
    }
  }

  const activeTheme = computed<LayoutThemeMeta>(() => buildThemeMeta(currentThemeId.value))

  /**
   * 按 themeHostConfigs 定义顺序返回可用主题列表，
   * 仅包含引擎已注册（可激活）的主题。
   */
  const availableThemes = computed<LayoutThemeMeta[]>(() => {
    const runtimeIds = new Set(runtimeThemeIds.value)
    return layoutThemeIds.filter((id) => runtimeIds.has(id) && registeredThemeIds.includes(id)).map(buildThemeMeta)
  })

  /**
   * 切换布局主题：先预热目标主题全部组件，再提交当前主题。
   * 返回 Promise<boolean> 供抽屉等待结果（成功后才关闭，失败保留并提示重试）。
   * 失败会回滚上一主题；迟到请求用版本号丢弃，不会覆盖更新的选择。
   */
  async function setLayoutTheme(id: string): Promise<boolean> {
    const themeId = ensureKnownThemeId(id)
    const version = ++switchVersion.value
    if (themeId === currentThemeId.value) {
      switchingState.value = 'idle'
      endThemeSwitchLoading()
      return true
    }
    switchingState.value = 'loading'
    const previousTheme = currentThemeId.value
    const snapshot = import.meta.client ? captureThemeSwitchSnapshot() : null
    startThemeSwitchLoading()
    try {
      await preloadLayoutTheme(themeId)
      if (switchVersion.value !== version) return false
      if (!setTheme(themeId)) throw new Error('主题不可用')
      await nextTick()
      if (switchVersion.value !== version) return false
      if (snapshot) restoreThemeSwitchSnapshot(snapshot)
      switchingState.value = 'idle'
      return true
    } catch {
      if (switchVersion.value !== version) return false
      if (currentThemeId.value !== previousTheme) setTheme(previousTheme)
      switchingState.value = 'error'
      notifyThemeError(i18n.t('theme.switch.loadFailed'))
      return false
    } finally {
      if (switchVersion.value === version) endThemeSwitchLoading()
    }
  }

  function preloadTheme(id: string) {
    const themeId = ensureKnownThemeId(id)
    void preloadLayoutTheme(themeId).then(
      () => {
        preloadErrors.value = Object.fromEntries(Object.entries(preloadErrors.value).filter(([key]) => key !== themeId))
      },
      () => {
        preloadErrors.value[themeId] = i18n.t('theme.switch.preloadFailed')
      },
    )
  }

  /** 抽屉打开/选择新主题前清掉上一次的失败态，避免过期错误常驻 */
  function resetSwitchState() {
    if (switchingState.value === 'error') switchingState.value = 'idle'
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
    resetSwitchState,
    disableCurrentTheme,
  }
}
