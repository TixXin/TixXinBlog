/**
 * @file themeRegistry.ts
 * @description 主题注册表：合并引擎发现的主题元信息与各主题的宿主侧配置，提供统一的主题查询 API
 * @author TixXin
 * @since 2026-04-04
 */

import { themeHostConfigs as generatedHostConfigs } from '#build/theme-host.config.mjs'

export type ThemeCustomizerCapability = 'colorMode' | 'contentTransition' | 'sidebarAnimation' | 'layoutDensity'

export interface ThemeCapabilities {
  leftSidebar: boolean
  rightSidebar: boolean
  customizer?: readonly ThemeCustomizerCapability[]
}

export interface ThemeHostConfig {
  version: string
  icon: string
  capabilities: ThemeCapabilities
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

/**
 * 各主题的宿主侧配置，按展示顺序排列。
 * 由Nuxt构建期读取主题配置，客户端只接收纯元数据。
 */
export const themeHostConfigs: Record<string, ThemeHostConfig> = generatedHostConfigs

export function isKnownLayoutThemeId(id: string): boolean {
  return id in themeHostConfigs
}

export function ensureKnownThemeId(id: string): string {
  return isKnownLayoutThemeId(id) ? id : DEFAULT_LAYOUT_THEME_ID
}
