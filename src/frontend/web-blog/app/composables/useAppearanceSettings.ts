/**
 * @file useAppearanceSettings.ts
 * @description 管理界面设置抽屉状态、动画偏好与本地持久化，并复用主题切换能力
 * @author TixXin
 * @since 2026-03-20
 */

import type {
  ContentTransitionPreset,
  SidebarAnimationPreset,
} from '~/features/theme/types'
import type { ThemeCustomizerCapability } from '~/features/theme/layoutThemes'
import {
  COLOR_MODE_LABELS,
  CONTENT_TRANSITION_OPTIONS,
  DEFAULT_LAYOUT_THEME_ID,
  DEFAULT_CONTENT_TRANSITION_PRESET,
  DEFAULT_SIDEBAR_ANIMATION_PRESET,
  SIDEBAR_ANIMATION_OPTIONS,
} from '~/features/theme/types'

const STORAGE_KEY = 'tixxin-blog-appearance'

interface AppearanceStorage {
  contentTransitionPreset: ContentTransitionPreset
  sidebarAnimationPreset: SidebarAnimationPreset
}

/** 关闭抽屉后让触发按钮失焦，避免 ESC/点击关闭后残留浏览器默认 focus 轮廓 */
function blurAppearanceTrigger() {
  if (!import.meta.client) return

  nextTick(() => {
    const trigger = document.querySelector('button.appearance-fab')

    if (trigger instanceof HTMLElement) {
      trigger.blur()
    }
  })
}

export function useAppearanceSettings() {
  const { currentPreference, themeOptions, setTheme } = useTheme()
  const { activeTheme, setLayoutTheme } = useLayoutTheme()

  /** 查询当前主题是否支持指定的设置面板定制项 */
  function isCapabilitySupported(cap: ThemeCustomizerCapability): boolean {
    return activeTheme.value.capabilities.customizer?.includes(cap) ?? false
  }

  const isDrawerOpen = useState('appearance-drawer-open', () => false)
  const contentTransitionPreset = useState<ContentTransitionPreset>(
    'appearance-content-transition-preset',
    () => DEFAULT_CONTENT_TRANSITION_PRESET,
  )
  const sidebarAnimationPreset = useState<SidebarAnimationPreset>(
    'appearance-sidebar-animation-preset',
    () => DEFAULT_SIDEBAR_ANIMATION_PRESET,
  )
  const initialized = useState('appearance-settings-initialized', () => false)
  const persistenceBound = useState('appearance-settings-persistence-bound', () => false)

  const themeLabel = computed(() => COLOR_MODE_LABELS[currentPreference.value])
  const contentTransitionLabel = computed(() =>
    CONTENT_TRANSITION_OPTIONS.find(option => option.value === contentTransitionPreset.value)?.label
      ?? '纵向滑动',
  )
  const sidebarAnimationLabel = computed(() =>
    SIDEBAR_ANIMATION_OPTIONS.find(option => option.value === sidebarAnimationPreset.value)?.label
      ?? '右侧退出和进入',
  )

  const contentTransitionName = computed(() => {
    switch (contentTransitionPreset.value) {
      case 'soft-slide':
        return 'content-soft'
      case 'fade':
        return 'content-fade'
      case 'none':
        return 'content-none'
      case 'vertical-slide':
      default:
        return 'content-vertical'
    }
  })

  const contentTransitionDuration = computed(() => {
    switch (contentTransitionPreset.value) {
      case 'none':
        return 0
      case 'soft-slide':
        return 160
      case 'fade':
        return 140
      case 'vertical-slide':
      default:
        return 180
    }
  })

  /**
   * SSR 期间无法读 localStorage，若直接输出动画类会按默认值播放，
   * 等客户端还原设置后再切换类已来不及（动画已播完）。
   * 因此 SSR 阶段和 hydration 期间均返回空字符串，
   * 水合完成后（onNuxtReady）再输出正确的动画类，避免类名不匹配警告。
   */
  const hydrated = useState('appearance-hydrated', () => false)

  if (import.meta.client && !hydrated.value) {
    onNuxtReady(() => {
      hydrated.value = true
    })
  }

  const sidebarTransitionName = computed(() => {
    switch (sidebarAnimationPreset.value) {
      case 'scale':
        return 'sidebar-scale'
      case 'fade':
        return 'sidebar-fade'
      case 'none':
        return 'sidebar-none'
      case 'fade-in-up':
      default:
        return 'sidebar-slide'
    }
  })

  const sidebarAnimationClass = computed(() => {
    if (!hydrated.value) return ''

    switch (sidebarAnimationPreset.value) {
      case 'scale':
        return 'anim-sidebar-scale'
      case 'fade':
        return 'anim-sidebar-fade'
      case 'none':
        return 'anim-sidebar-none'
      case 'fade-in-up':
      default:
        return 'anim-sidebar-up'
    }
  })

  function openDrawer() {
    isDrawerOpen.value = true
  }

  function closeDrawer() {
    isDrawerOpen.value = false
    blurAppearanceTrigger()
  }

  function toggleDrawer() {
    const next = !isDrawerOpen.value
    isDrawerOpen.value = next

    if (!next) {
      blurAppearanceTrigger()
    }
  }

  function setContentTransitionPreset(preset: ContentTransitionPreset) {
    contentTransitionPreset.value = preset
  }

  function setSidebarAnimationPreset(preset: SidebarAnimationPreset) {
    sidebarAnimationPreset.value = preset
  }

  function resetAppearanceSettings() {
    setTheme('system')
    contentTransitionPreset.value = DEFAULT_CONTENT_TRANSITION_PRESET
    sidebarAnimationPreset.value = DEFAULT_SIDEBAR_ANIMATION_PRESET
    setLayoutTheme(DEFAULT_LAYOUT_THEME_ID)
  }

  if (import.meta.client && !initialized.value) {
    initialized.value = true

    try {
      const stored = localStorage.getItem(STORAGE_KEY)

      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppearanceStorage>

        if (parsed.contentTransitionPreset) {
          contentTransitionPreset.value = parsed.contentTransitionPreset
        }

        if (parsed.sidebarAnimationPreset) {
          sidebarAnimationPreset.value = parsed.sidebarAnimationPreset
        }
      }
    }
    catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  if (import.meta.client && !persistenceBound.value) {
    persistenceBound.value = true

    watch(
      [contentTransitionPreset, sidebarAnimationPreset],
      () => {
        const payload: AppearanceStorage = {
          contentTransitionPreset: contentTransitionPreset.value,
          sidebarAnimationPreset: sidebarAnimationPreset.value,
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      },
      { deep: false },
    )
  }

  return {
    isDrawerOpen,
    isCapabilitySupported,
    themeOptions,
    currentPreference,
    setTheme,
    themeLabel,
    contentTransitionPreset,
    contentTransitionOptions: CONTENT_TRANSITION_OPTIONS,
    contentTransitionLabel,
    contentTransitionName,
    contentTransitionDuration,
    setContentTransitionPreset,
    sidebarAnimationPreset,
    sidebarAnimationOptions: SIDEBAR_ANIMATION_OPTIONS,
    sidebarAnimationLabel,
    sidebarAnimationClass,
    sidebarTransitionName,
    setSidebarAnimationPreset,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    resetAppearanceSettings,
  }
}
