/**
 * @file types.ts
 * @description Dev 调试面板相关类型定义
 * @author TixXin
 * @since 2026-10-21
 */

import type { DevDebugTab, DevDebugDockPosition } from '~/composables/useDevDebugPanel'

export interface ViewportPreset {
  label: string
  w: number
  h: number
  icon: string
}

export interface PreviewEntry {
  label: string
  icon: string
  path: string
  query: Record<string, string>
}

export interface PreviewGroup {
  label: string
  items: readonly PreviewEntry[]
}

export interface ColorModeOption {
  value: 'light' | 'dark' | 'system'
  label: string
  icon: string
}

export interface DockOption {
  value: DevDebugDockPosition
  label: string
  icon: string
}

export interface DevTabItem {
  id: DevDebugTab
  label: string
  icon: string
}
