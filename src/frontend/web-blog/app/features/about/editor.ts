/** @file editor.ts @description 关于页资料的三方合并与恢复副本结构校验；按栏目合并，不凭条目索引猜测身份 */
import { ABOUT_SECTION_KINDS, aboutSectionLabelKeys, emptyAbout } from './settings'
import type { AboutItem, AboutSection, AboutSettings, AboutSupport } from './types'

type Choose = <T>(before: T, input: T, latest: T, path: string) => T

/** 把三份资料按栏目、开关、英文简介与支持方式分别合并；冲突路径写入 conflicts */
export interface AboutMergeTools {
  choose: Choose
  equal: (left: unknown, right: unknown) => boolean
  conflicts: string[]
}
export function mergeAbout(
  versions: { base?: AboutSettings; local?: AboutSettings; server?: AboutSettings },
  { choose, equal, conflicts }: AboutMergeTools,
): AboutSettings {
  const { base, local, server } = versions
  const before = base ?? emptyAbout(),
    input = local ?? emptyAbout(),
    latest = server ?? emptyAbout()
  const sections = new Map<AboutSection['kind'], AboutSection>()
  for (const kind of ABOUT_SECTION_KINDS) {
    const section = choose(
      before.sections.find((item) => item.kind === kind),
      input.sections.find((item) => item.kind === kind),
      latest.sections.find((item) => item.kind === kind),
      `about.${kind}`,
    )
    if (section) sections.set(kind, section)
  }
  // 共同存在的栏目顺序才可比较；新增栏目追加，删除不被误认为重排。
  const common = before.sections
    .map((section) => section.kind)
    .filter(
      (kind) => input.sections.some((item) => item.kind === kind) && latest.sections.some((item) => item.kind === kind),
    )
  const order = (items: AboutSection[]) => items.map((section) => section.kind).filter((kind) => common.includes(kind))
  const localReordered = !equal(order(before.sections), order(input.sections))
  if (
    localReordered &&
    !equal(order(before.sections), order(latest.sections)) &&
    !equal(order(input.sections), order(latest.sections))
  )
    conflicts.push('about.sections.order')
  const ordered = [...(localReordered ? input.sections : latest.sections), ...input.sections, ...latest.sections]
  const en = choose(before.en, input.en, latest.en, 'about.en')
  const showSiteInfo = choose(before.showSiteInfo, input.showSiteInfo, latest.showSiteInfo, 'about.showSiteInfo')
  const support = choose(before.support, input.support, latest.support, 'about.support')
  return {
    visible: choose(before.visible, input.visible, latest.visible, 'about.visible'),
    introduction: choose(before.introduction, input.introduction, latest.introduction, 'about.introduction'),
    sections: [...new Set(ordered.map((section) => section.kind))].flatMap((kind) =>
      sections.has(kind) ? [sections.get(kind)!] : [],
    ),
    ...(en ? { en } : {}),
    ...(showSiteInfo !== undefined ? { showSiteInfo } : {}),
    ...(support ? { support } : {}),
  }
}

const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max
const optional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value)

function isItem(entry: AboutItem | null | undefined) {
  return (
    !!entry &&
    typeof entry.visible === 'boolean' &&
    text(entry.title, 120) &&
    text(entry.period, 80) &&
    text(entry.detail, 1000) &&
    optional(entry.url, (url) => text(url, 500)) &&
    optional(
      entry.en,
      (en) =>
        !!en &&
        text((en as AboutItem).title, 120) &&
        text((en as AboutItem).period, 80) &&
        text((en as AboutItem).detail, 1000),
    )
  )
}
function isSupport(support: AboutSupport) {
  return (
    !!support &&
    typeof support.visible === 'boolean' &&
    text(support.message, 300) &&
    optional(support.messageEn, (message) => text(message, 300)) &&
    Array.isArray(support.methods) &&
    support.methods.length <= 6 &&
    support.methods.every(
      (method) => !!method && text(method.label, 40) && text(method.url, 500) && text(method.image, 1000),
    )
  )
}
/** 恢复副本中的关于页只做结构检查，具体规则由服务端校验 */
export function isAboutSettings(about: AboutSettings | undefined): boolean {
  if (about === undefined) return true
  return (
    !!about &&
    typeof about.visible === 'boolean' &&
    text(about.introduction, 5000) &&
    optional(about.en, (en) => !!en && text((en as { introduction: unknown }).introduction, 5000)) &&
    optional(about.showSiteInfo, (value) => typeof value === 'boolean') &&
    optional(about.support, (support) => isSupport(support as AboutSupport)) &&
    Array.isArray(about.sections) &&
    about.sections.length <= ABOUT_SECTION_KINDS.length &&
    new Set(about.sections.map((section) => section?.kind)).size === about.sections.length &&
    about.sections.every(
      (section) =>
        section &&
        Object.hasOwn(aboutSectionLabelKeys, section.kind) &&
        typeof section.visible === 'boolean' &&
        optional(section.updatedAt, (value) => text(value, 10)) &&
        Array.isArray(section.items) &&
        section.items.length <= 30 &&
        section.items.every(isItem),
    )
  )
}
