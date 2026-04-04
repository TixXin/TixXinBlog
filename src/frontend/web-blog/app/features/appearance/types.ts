/**
 * @file types.ts
 * @description 外观设置相关类型、默认值与选项常量（纯 UI 偏好配置，不含主题元信息）
 * @author TixXin
 * @since 2026-03-20
 */

export const COLOR_MODE_OPTIONS = ['light', 'system', 'dark'] as const
export type ThemeOption = (typeof COLOR_MODE_OPTIONS)[number]

export const CONTENT_TRANSITION_PRESETS = ['vertical-slide', 'soft-slide', 'fade', 'none'] as const
export type ContentTransitionPreset = (typeof CONTENT_TRANSITION_PRESETS)[number]

export const SIDEBAR_ANIMATION_PRESETS = ['fade-in-up', 'scale', 'fade', 'none'] as const
export type SidebarAnimationPreset = (typeof SIDEBAR_ANIMATION_PRESETS)[number]

export interface AppearanceOption<T extends string> {
  value: T
  label: string
  description: string
  icon?: string
}

export const DEFAULT_CONTENT_TRANSITION_PRESET: ContentTransitionPreset = 'vertical-slide'
export const DEFAULT_SIDEBAR_ANIMATION_PRESET: SidebarAnimationPreset = 'fade-in-up'

export const COLOR_MODE_LABELS: Record<ThemeOption, string> = {
  light: '浅色',
  system: '跟随系统',
  dark: '深色',
}

export const CONTENT_TRANSITION_OPTIONS: AppearanceOption<ContentTransitionPreset>[] = [
  {
    value: 'vertical-slide',
    label: '纵向滑动',
    description: '旧内容向下离场，新内容从上方进入',
    icon: 'lucide:arrow-up-down',
  },
  {
    value: 'soft-slide',
    label: '轻柔滑动',
    description: '位移更小，过渡更柔和',
    icon: 'lucide:move-vertical',
  },
  {
    value: 'fade',
    label: '淡入淡出',
    description: '只切换透明度，不做位移',
    icon: 'lucide:sparkles',
  },
  {
    value: 'none',
    label: '关闭动画',
    description: '内容瞬间切换',
    icon: 'lucide:slash',
  },
]

export const SIDEBAR_ANIMATION_OPTIONS: AppearanceOption<SidebarAnimationPreset>[] = [
  {
    value: 'fade-in-up',
    label: '右侧退出和进入',
    description: '右侧栏从右侧滑出、从右侧滑入',
    icon: 'lucide:panel-right-open',
  },
  {
    value: 'scale',
    label: '缩放淡入',
    description: '右侧栏从微缩状态放大显现',
    icon: 'lucide:maximize-2',
  },
  {
    value: 'fade',
    label: '柔和淡入',
    description: '仅做透明度过渡',
    icon: 'lucide:blend',
  },
  {
    value: 'none',
    label: '关闭动画',
    description: '右侧栏静态显示',
    icon: 'lucide:pause',
  },
]
