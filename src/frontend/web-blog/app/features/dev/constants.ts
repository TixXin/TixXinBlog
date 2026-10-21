/**
 * @file constants.ts
 * @description Dev 调试面板静态常量与配置
 * @author TixXin
 * @since 2026-10-21
 */

import type { DevTabItem, DockOption, ColorModeOption } from './types'

export const DEBUG_TABS: readonly DevTabItem[] = [
  { id: 'viewport', label: '视口', icon: 'lucide:monitor' },
  { id: 'route', label: '路由', icon: 'lucide:route' },
  { id: 'auth', label: '账号', icon: 'lucide:user-round' },
  { id: 'preview', label: '预览', icon: 'lucide:eye' },
  { id: 'env', label: '环境', icon: 'lucide:server' },
] as const

export const DOCK_OPTIONS: readonly DockOption[] = [
  { value: 'left', label: '左侧停靠', icon: 'lucide:panel-left' },
  { value: 'right', label: '右侧停靠', icon: 'lucide:panel-right' },
  { value: 'top', label: '顶部停靠', icon: 'lucide:panel-top' },
  { value: 'bottom', label: '底部停靠', icon: 'lucide:panel-bottom' },
  { value: 'center', label: '居中浮窗', icon: 'lucide:square' },
] as const

export const COLOR_MODE_OPTIONS: readonly ColorModeOption[] = [
  { value: 'light', label: '亮', icon: 'lucide:sun' },
  { value: 'dark', label: '暗', icon: 'lucide:moon' },
  { value: 'system', label: '跟随', icon: 'lucide:monitor-cog' },
] as const
