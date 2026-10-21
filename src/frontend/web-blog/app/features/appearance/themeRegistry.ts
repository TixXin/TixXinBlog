/**
 * @file themeRegistry.ts
 * @description 主题注册表：合并引擎发现的主题元信息与各主题的宿主能力声明，提供统一的主题查询 API
 * @author TixXin
 * @since 2026-04-04
 */

import { themeHostConfigs as generatedHostConfigs } from '#build/theme-host.config.mjs'
import {
  themeEngineThemeNames as generatedThemeNames,
  themeEngineThemes as generatedThemeDefinitions,
} from '#build/theme-engine.options.mjs'

/** 外观抽屉里可由主题自行声明的定制项；只声明实际支持的项 */
export type ThemeCustomizerCapability = 'colorMode' | 'contentTransition' | 'sidebarAnimation'

/**
 * 宿主能力契约：主题通过 theme.config.ts 声明，宿主据此决定页面行为。
 * 不再要求宿主按主题 id 写分支，新增主题只需补齐这张表。
 */
export interface ThemeCapabilities {
  rightSidebar: boolean
  /** 右侧栏出现的视口宽度；未声明时按右栏存在即显示 */
  rightSidebarBreakpoint?: number
  /** 宿主移动导航是否渲染（主题自带移动导航时声明 false） */
  mobileNav?: boolean
  /** 留言板宽屏聊天态（依赖左侧栏的主题） */
  guestbookChat?: boolean
  /** 朋友圈资料固定侧栏归属；未声明表示放紧凑抽屉 */
  momentInfoPlacement?: 'left' | 'right'
  customizer?: readonly ThemeCustomizerCapability[]
}

/** theme.config.ts 的唯一内容：宿主能力；version/icon 等元信息只来自 theme.json */
export interface ThemeHostConfig {
  capabilities: ThemeCapabilities
}

/** 引擎扫描 theme.json 得到的定义（构建期序列化，客户端只接收纯数据） */
export interface EngineThemeDefinition {
  name: string
  label?: string | null
  description?: string | null
  extends?: string | null
  meta?: Record<string, unknown>
  inheritanceChain?: readonly string[]
}

export interface LayoutThemeMeta {
  id: string
  name: string
  version: string
  description: string
  icon: string
  capabilities: ThemeCapabilities
}

/** 未登记主题的兜底能力：宁可少渲染，不按错误假设渲染 */
export const FALLBACK_THEME_CAPABILITIES: ThemeCapabilities = {
  rightSidebar: false,
}

export const DEFAULT_LAYOUT_THEME_ID = 'nexus'

/**
 * 各主题的宿主侧能力，按展示顺序排列。
 * 由Nuxt构建期读取主题配置，客户端只接收纯元数据。
 */
export const themeHostConfigs: Record<string, ThemeHostConfig> = generatedHostConfigs

/** 引擎实际扫描到的主题名（含未在宿主登记的主题，用于构建期校验与诊断） */
export const engineThemeIds: readonly string[] = [...(generatedThemeNames as string[])]

export const engineThemeDefinitions: readonly EngineThemeDefinition[] =
  generatedThemeDefinitions as EngineThemeDefinition[]

/** 宿主登记顺序即外观抽屉展示顺序 */
export const layoutThemeIds: readonly string[] = Object.keys(themeHostConfigs)

/** 可被激活的主题：引擎发现且宿主已登记能力 */
export const registeredThemeIds: readonly string[] = layoutThemeIds.filter((id) => engineThemeIds.includes(id))

export function isKnownLayoutThemeId(id: string): boolean {
  return Object.hasOwn(themeHostConfigs, id)
}

export function isRegisteredLayoutThemeId(id: string): boolean {
  return registeredThemeIds.includes(id)
}

/** 非法或未登记的主题统一回退默认主题，避免“引擎能激活、宿主不认识”的脑裂 */
export function ensureKnownThemeId(id: string): string {
  return isRegisteredLayoutThemeId(id) ? id : DEFAULT_LAYOUT_THEME_ID
}

export function getThemeCapabilities(id: string): ThemeCapabilities {
  return themeHostConfigs[id]?.capabilities ?? FALLBACK_THEME_CAPABILITIES
}

export function findEngineThemeDefinition(id: string): EngineThemeDefinition | undefined {
  return engineThemeDefinitions.find((definition) => definition.name === id)
}
