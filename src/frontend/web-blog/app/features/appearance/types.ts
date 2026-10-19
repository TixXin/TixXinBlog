/**
 * @file types.ts
 * @description 外观设置相关类型、默认值与选项常量（纯 UI 偏好配置，不含主题元信息）
 * @author TixXin
 * @since 2026-03-20
 */
import { currentTranslate } from '~/utils/format'

export const COLOR_MODE_OPTIONS = ['light', 'system', 'dark'] as const
export type ThemeOption = (typeof COLOR_MODE_OPTIONS)[number]

export const CONTENT_TRANSITION_PRESETS = ['vertical-slide', 'soft-slide', 'fade', 'none'] as const
export type ContentTransitionPreset = (typeof CONTENT_TRANSITION_PRESETS)[number]

export const SIDEBAR_ANIMATION_PRESETS = ['fade-in-up', 'scale', 'fade', 'none'] as const
export type SidebarAnimationPreset = (typeof SIDEBAR_ANIMATION_PRESETS)[number]

export const COLOR_MODE_TRANSITION_PRESETS = ['fade', 'circle', 'blur', 'none'] as const
export type ColorModeTransitionPreset = (typeof COLOR_MODE_TRANSITION_PRESETS)[number]

export interface AppearanceOption<T extends string> {
  value: T
  label: string
  description: string
  icon?: string
}

// 默认用最短的淡入：切页时内容尽快稳定，位移类过渡留给用户在界面设置里自选
export const DEFAULT_CONTENT_TRANSITION_PRESET: ContentTransitionPreset = 'fade'
export const DEFAULT_SIDEBAR_ANIMATION_PRESET: SidebarAnimationPreset = 'fade'
export const DEFAULT_COLOR_MODE_TRANSITION_PRESET: ColorModeTransitionPreset = 'circle'

/** 选项名称与说明取值时按当前界面语言翻译，key 为 layout.appearance.<分组>.<值> */
function appearanceOption<T extends string>(group: string, value: T, icon: string): AppearanceOption<T> {
  const key = `layout.appearance.${group}.${value}`
  return {
    value,
    icon,
    get label() {
      return currentTranslate()(`${key}.label`)
    },
    get description() {
      return currentTranslate()(`${key}.description`)
    },
  }
}

/** 颜色模式名称；取值时按当前界面语言翻译 */
export const COLOR_MODE_LABELS: Record<ThemeOption, string> = {
  get light() {
    return currentTranslate()('layout.appearance.colorMode.light')
  },
  get system() {
    return currentTranslate()('layout.appearance.colorMode.system')
  },
  get dark() {
    return currentTranslate()('layout.appearance.colorMode.dark')
  },
}

export const CONTENT_TRANSITION_OPTIONS: AppearanceOption<ContentTransitionPreset>[] = [
  appearanceOption('contentTransition', 'vertical-slide', 'lucide:arrow-up-down'),
  appearanceOption('contentTransition', 'soft-slide', 'lucide:move-vertical'),
  appearanceOption('contentTransition', 'fade', 'lucide:sparkles'),
  appearanceOption('contentTransition', 'none', 'lucide:slash'),
]

export const COLOR_MODE_TRANSITION_OPTIONS: AppearanceOption<ColorModeTransitionPreset>[] = [
  appearanceOption('colorModeTransition', 'fade', 'lucide:sparkles'),
  appearanceOption('colorModeTransition', 'circle', 'lucide:circle'),
  appearanceOption('colorModeTransition', 'blur', 'lucide:aperture'),
  appearanceOption('colorModeTransition', 'none', 'lucide:slash'),
]

export const SIDEBAR_ANIMATION_OPTIONS: AppearanceOption<SidebarAnimationPreset>[] = [
  appearanceOption('sidebarAnimation', 'fade-in-up', 'lucide:panel-right-open'),
  appearanceOption('sidebarAnimation', 'scale', 'lucide:maximize-2'),
  appearanceOption('sidebarAnimation', 'fade', 'lucide:blend'),
  appearanceOption('sidebarAnimation', 'none', 'lucide:pause'),
]
