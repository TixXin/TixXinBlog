/**
 * @file shareCard.ts
 * @description 分享卡片地址：/api/v1/og/<主题>/<语言>/site.png 与 /api/v1/og/<主题>/<语言>/<类型>/<编号>.png，
 * 取值范围与后端 modules/og/og.controller.ts 一致；地址带 ?v= 版本号（卡片内容的稳定哈希），内容一改地址就变，
 * 社交平台会重新抓取。静态发布按不含查询串的路径导出同名文件。
 * @author TixXin
 * @since 2026-11-03
 */
import { stableHash } from '~/features/static/frozenApi'

export const SHARE_CARD_THEMES = ['nexus', 'aurora', 'dock'] as const
export const SHARE_CARD_LOCALES = ['zh-CN', 'en'] as const
export type ShareCardKind = 'post' | 'flash' | 'moment'

const POST_ID = /^[1-9][0-9]{0,9}$/
const NOTE_ID = /^[A-Za-z0-9_-]{1,64}$/

export interface ShareCardInput {
  /** 公开站点地址，无结尾斜杠 */
  site: string
  theme: string
  locale: string
  /** 缺省为站点卡 */
  kind?: ShareCardKind
  id?: string | number
  /** 影响卡片画面的内容（标题、正文、日期、站点名、头像等），只用于计算版本号 */
  version: readonly unknown[]
}

/** 编号能否作为卡片地址：文章为正整数，闪念与朋友圈只含字母、数字、下划线与连字符 */
export function isShareCardId(kind: ShareCardKind, id: string | number | undefined) {
  const value = String(id ?? '')
  return kind === 'post' ? POST_ID.test(value) && Number(value) <= 2147483647 : NOTE_ID.test(value)
}

/** 分享卡片的绝对地址；编号不合规时返回 undefined，页面改用全站兜底 */
export function shareCardUrl(input: ShareCardInput): string | undefined {
  const theme = (SHARE_CARD_THEMES as readonly string[]).includes(input.theme) ? input.theme : 'nexus'
  const locale = (SHARE_CARD_LOCALES as readonly string[]).includes(input.locale) ? input.locale : 'zh-CN'
  if (input.kind && !isShareCardId(input.kind, input.id)) return undefined
  const file = input.kind ? `${input.kind}/${input.id}.png` : 'site.png'
  const version = stableHash(JSON.stringify([theme, locale, input.kind ?? 'site', input.id ?? '', ...input.version]))
  return `${input.site}/api/v1/og/${theme}/${locale}/${file}?v=${version}`
}
