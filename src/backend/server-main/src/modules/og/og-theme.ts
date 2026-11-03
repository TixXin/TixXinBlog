/**
 * @file og-theme.ts
 * @description 分享卡片的地址取值范围与配色：主题、语言、内容类型白名单，以及按布局主题取色的浅色卡片色板。
 * 色值取自前端 app/assets/styles/_variables.scss 的浅色站点色板与 themes/aurora 的渐变；Dock 没有独立配色，与 Nexus 共用站点色板。
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
  /** 内容面板的填充与描边；渐变底色上用半透明玻璃面板 */
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
}

const siteDots = [
  '<defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">',
  '<circle cx="12" cy="12" r="1.6" fill="#bcc6d3"/></pattern></defs>',
  '<rect width="100%" height="100%" fill="#ebeff4"/><rect width="100%" height="100%" fill="url(#dots)"/>',
].join('')

/** Nexus 与 Dock 共用的站点浅色色板 */
const sitePalette: OgPalette = {
  background: siteDots,
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
}

const auroraPalette: OgPalette = {
  background: [
    '<defs><linearGradient id="aurora" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="#667eea"/><stop offset="1" stop-color="#764ba2"/></linearGradient></defs>',
    '<rect width="100%" height="100%" fill="url(#aurora)"/>',
  ].join(''),
  panelFill: 'rgba(255, 255, 255, 0.12)',
  panelStroke: 'rgba(255, 255, 255, 0.28)',
  text: '#ffffff',
  muted: '#ffffff',
  mutedAlpha: 80,
  pillFill: 'rgba(255, 255, 255, 0.2)',
  pillText: '#ffffff',
  avatarFill: 'rgba(255, 255, 255, 0.24)',
  avatarText: '#ffffff',
  divider: 'rgba(255, 255, 255, 0.24)',
}

export const OG_PALETTES: Readonly<Record<OgTheme, OgPalette>> = {
  nexus: sitePalette,
  dock: sitePalette,
  aurora: auroraPalette,
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
