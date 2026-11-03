/**
 * @file og-theme.ts
 * @description 分享卡片的地址取值范围与配色：主题、语言、内容类型白名单，以及按布局主题取色的卡片色板。
 * 色值只取自前端 app/assets/styles/_variables.scss 的站点设计令牌：Nexus 与 Dock 用浅色（:root），
 * Aurora 用博客默认的深色（.dark），与 Aurora 主题的深色表面一致；不使用主题里兜底的紫色渐变。
 * @author TixXin
 * @since 2026-11-03
 */

export const OG_THEMES = ['nexus', 'aurora', 'dock'] as const
export const OG_LOCALES = ['zh-CN', 'en'] as const
export const OG_KINDS = ['post', 'flash', 'moment'] as const

export type OgTheme = (typeof OG_THEMES)[number]
export type OgLocale = (typeof OG_LOCALES)[number]
export type OgKind = (typeof OG_KINDS)[number]

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

export interface OgPalette {
  /** 背景 SVG 片段（铺满画布），由渲染模块放进 <svg> 中 */
  background: string
  /** 内容面板的填充与描边，对应 --surface-1 与边框令牌 */
  panelFill: string
  panelStroke: string
  text: string
  muted: string
  /** 辅助文字透明度（Pango alpha 百分比） */
  mutedAlpha: number
  pillFill: string
  pillText: string
  avatarFill: string
  avatarText: string
  divider: string
  /** 面板投影的不透明度（黑色系投影） */
  shadowOpacity: number
}

/** 点阵底纹：对应 --bg、--bg-dot 与 --bg-dot-size */
function dottedBackground(background: string, dot: string, size: number) {
  return [
    `<defs><pattern id="dots" width="${size}" height="${size}" patternUnits="userSpaceOnUse">`,
    `<circle cx="${size / 2}" cy="${size / 2}" r="1.6" fill="${dot}"/></pattern></defs>`,
    `<rect width="100%" height="100%" fill="${background}"/><rect width="100%" height="100%" fill="url(#dots)"/>`,
  ].join('')
}

/** 站点浅色令牌（:root）：Nexus 与 Dock */
const sitePalette: OgPalette = {
  background: dottedBackground('#ebeff4', '#bcc6d3', 24),
  panelFill: '#ffffff',
  panelStroke: 'rgba(203, 213, 225, 0.9)',
  text: '#1e293b',
  muted: '#475569',
  mutedAlpha: 100,
  pillFill: '#f1f5f9',
  pillText: '#334155',
  avatarFill: '#334155',
  avatarText: '#ffffff',
  divider: '#e2e8f0',
  shadowOpacity: 0.1,
}

/** 站点深色令牌（.dark）：博客默认颜色模式，Aurora 使用 */
const siteDarkPalette: OgPalette = {
  // 深色点阵在 #23272f 上的合成色，等同 rgba(126, 138, 156, 0.16)
  background: dottedBackground('#23272f', '#323740', 28),
  panelFill: '#2a2f37',
  panelStroke: 'rgba(100, 116, 139, 0.4)',
  text: '#e2e8f0',
  muted: '#a0aec0',
  mutedAlpha: 100,
  pillFill: '#313741',
  pillText: '#cbd5e1',
  avatarFill: '#383f4a',
  avatarText: '#e2e8f0',
  divider: 'rgba(100, 116, 139, 0.32)',
  shadowOpacity: 0.3,
}

export const OG_PALETTES: Readonly<Record<OgTheme, OgPalette>> = {
  nexus: sitePalette,
  dock: sitePalette,
  aurora: siteDarkPalette,
}

export function isOgTheme(value: string): value is OgTheme {
  return (OG_THEMES as readonly string[]).includes(value)
}

export function isOgLocale(value: string): value is OgLocale {
  return (OG_LOCALES as readonly string[]).includes(value)
}

export function isOgKind(value: string): value is OgKind {
  return (OG_KINDS as readonly string[]).includes(value)
}
