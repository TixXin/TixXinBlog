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

export const DEFAULT_LAYOUT_THEME_ID = 'classic'

export const LAYOUT_THEME_PRESETS = [
  'classic',
  'docs',
  'minimal',
] as const

export type LayoutThemePreset = typeof LAYOUT_THEME_PRESETS[number]

export const layoutThemeMetas: LayoutThemeMeta[] = [
  {
    id: 'classic',
    name: '经典三栏',
    version: '1.0.0',
    description: '左侧导航 + 中间内容 + 右侧信息栏',
    icon: 'lucide:layout-dashboard',
    capabilities: {
      leftSidebar: true,
      rightSidebar: true,
      customizer: ['colorMode', 'contentTransition', 'sidebarAnimation'],
    },
  },
  {
    id: 'docs',
    name: '双栏文档',
    version: '1.0.0',
    description: '顶部导航 + 宽内容区 + 可选右栏',
    icon: 'lucide:book-open',
    capabilities: {
      leftSidebar: false,
      rightSidebar: true,
      customizer: ['colorMode', 'contentTransition', 'sidebarAnimation'],
    },
  },
  {
    id: 'minimal',
    name: '单栏极简',
    version: '1.0.0',
    description: '顶部导航 + 居中单列内容',
    icon: 'lucide:minimize-2',
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
