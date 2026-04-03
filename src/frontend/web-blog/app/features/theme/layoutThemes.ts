/**
 * @file layoutThemes.ts
 * @description 布局主题元信息与能力声明，作为宿主博客对主题引擎的适配层数据源
 * @author TixXin
 * @since 2026-04-03
 */

export type ThemeCustomizerCapability =
  | 'colorMode'
  | 'contentTransition'
  | 'sidebarAnimation'
  | 'layoutDensity'

export interface ThemeCapabilities {
  leftSidebar: boolean
  rightSidebar: boolean
  customizer?: ThemeCustomizerCapability[]
}

export interface LayoutThemeMeta {
  id: string
  name: string
  version: string
  description: string
  icon: string
  capabilities: ThemeCapabilities
}

export const DEFAULT_LAYOUT_THEME_ID = 'nexus'

export const LAYOUT_THEME_PRESETS = [
  'nexus',
  'aurora',
  'dock',
] as const

export type LayoutThemePreset = typeof LAYOUT_THEME_PRESETS[number]

export const layoutThemeMetas: LayoutThemeMeta[] = [
  {
    id: 'nexus',
    name: 'Nexus 三栏',
    version: '2.0.0',
    description: '经典三栏 App-Shell：左侧导航 + 中间内容 + 右侧侧边栏',
    icon: 'lucide:layout-dashboard',
    capabilities: {
      leftSidebar: true,
      rightSidebar: true,
      customizer: ['colorMode', 'contentTransition'],
    },
  },
  {
    id: 'aurora',
    name: 'Aurora 双栏',
    version: '2.0.0',
    description: '大型 Hero 视觉区域 + 动态毛玻璃顶栏 + 双栏内容',
    icon: 'lucide:sunrise',
    capabilities: {
      leftSidebar: false,
      rightSidebar: true,
      customizer: ['colorMode', 'contentTransition', 'sidebarAnimation'],
    },
  },
  {
    id: 'dock',
    name: 'Dock 浮岛',
    version: '2.0.0',
    description: '底部浮岛式导航 + 居中单栏内容',
    icon: 'lucide:panel-bottom',
    capabilities: {
      leftSidebar: false,
      rightSidebar: false,
      customizer: ['colorMode', 'contentTransition'],
    },
  },
]

const layoutThemeMetaMap = new Map(
  layoutThemeMetas.map(meta => [meta.id, meta]),
)

export function getLayoutThemeMeta(id: string): LayoutThemeMeta {
  return layoutThemeMetaMap.get(id) ?? layoutThemeMetaMap.get(DEFAULT_LAYOUT_THEME_ID)!
}

export function isKnownLayoutThemeId(id: string): id is LayoutThemePreset {
  return layoutThemeMetaMap.has(id)
}
