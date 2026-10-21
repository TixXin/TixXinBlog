/**
 * @file viewMode.ts
 * @description 标签页视图模式相关的显示文案与图标映射
 * @author TixXin
 * @since 2026-04-11
 */

import type { TabViewMode } from '~/composables/useTabSettings'

/**
 * 获取视图模式展示文本
 */
export function getTabViewModeLabel(mode: TabViewMode, t: (key: string) => string): string {
  return t(`misc.tab.viewMode.${mode}`)
}

/**
 * 获取视图模式对应图标
 */
export function getTabViewModeIcon(mode: TabViewMode): string {
  switch (mode) {
    case 'grid':
      return 'lucide:layout-grid'
    case 'compact':
      return 'lucide:grid-2x2'
    case 'list':
      return 'lucide:list'
    case 'cards':
      return 'lucide:square-stack'
  }
}
