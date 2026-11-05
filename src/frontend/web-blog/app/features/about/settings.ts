/** @file settings.ts @description 关于页空白缺省、栏目名称、公开过滤与按界面语言取资料，不预填未经确认的个人事实 */
import type { AboutItem, AboutSection, AboutSettings, AboutSupport } from './types'
import type { Translate } from '~/utils/format'

/** 栏目名称；键的顺序即后台“添加栏目”按钮的顺序 */
export const aboutSectionLabelKeys: Record<AboutSection['kind'], string> = {
  now: 'misc.about.section.now',
  experience: 'misc.about.section.experience',
  skill: 'misc.about.section.skill',
  uses: 'misc.about.section.uses',
  interest: 'misc.about.section.interest',
  reading: 'misc.about.section.reading',
}
export const ABOUT_SECTION_KINDS = Object.keys(aboutSectionLabelKeys) as AboutSection['kind'][]
/** 关于页栏目的界面名称，随当前语言 */
export function aboutSectionLabel(kind: AboutSection['kind'], t: Translate): string {
  return t(aboutSectionLabelKeys[kind])
}
export function emptyAbout(): AboutSettings {
  return { visible: false, introduction: '', sections: [] }
}
export function emptySupport(): AboutSupport {
  return { visible: false, message: '', methods: [] }
}
/** 支持方式独立于关于页是否公开：它也出现在文章页侧栏；至少要有标签，以及链接或图片之一 */
export function publicSupport(support: AboutSupport | undefined): AboutSupport | undefined {
  if (!support?.visible) return undefined
  const methods = support.methods.filter((method) => method.label.trim() && (method.url || method.image))
  return methods.length ? { ...support, methods } : undefined
}
export function publicAbout(value: AboutSettings | undefined): AboutSettings {
  const support = publicSupport(value?.support)
  if (!value?.visible) return { ...emptyAbout(), ...(support ? { support } : {}) }
  return {
    ...value,
    sections: value.sections
      .filter((section) => section.visible)
      .map((section) => ({ ...section, items: section.items.filter((item) => item.visible && item.title.trim()) }))
      .filter((section) => section.items.length),
    ...(support ? { support } : { support: undefined }),
  }
}
const pick = (english: string | undefined, fallback: string) => english?.trim() || fallback
function localizeItem(item: AboutItem): AboutItem {
  if (!item.en) return item
  return {
    ...item,
    title: pick(item.en.title, item.title),
    detail: pick(item.en.detail, item.detail),
    period: pick(item.en.period, item.period),
  }
}
/** 英文界面优先取英文资料，逐字段回退到中文；其他语言原样返回 */
export function localizeAbout(value: AboutSettings, locale: string): AboutSettings {
  if (!locale.startsWith('en')) return value
  return {
    ...value,
    introduction: pick(value.en?.introduction, value.introduction),
    sections: value.sections.map((section) => ({ ...section, items: section.items.map(localizeItem) })),
    ...(value.support
      ? { support: { ...value.support, message: pick(value.support.messageEn, value.support.message) } }
      : {}),
  }
}
/** 简介的第一句（或前 160 字），用作结构化数据与分享描述；中文句号直接断句，英文句点后须有空白，避免截断网址与小数 */
export function introductionSummary(introduction: string): string {
  const plain = introduction
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const sentence = plain.match(/^.+?(?:[。！？]|[.!?](?=\s|$))/)?.[0] ?? plain
  return sentence.length > 160 ? `${sentence.slice(0, 159)}…` : sentence
}
/** 只有 http(s) 链接可作为 rel="me" 身份声明；mailto 等不适用 */
export function isWebProfile(href: string): boolean {
  return /^https?:\/\//i.test(href)
}
