/** @file editor.ts @description 站点配置按字段及栏目三方合并；恢复副本严格校验，不凭条目索引猜测身份 */
import { emptyAbout, aboutSectionLabels } from '../about/settings'
import type { AboutSection } from '../about/types'
import { defaultSiteSettings } from './settings'
import type { SiteSettingsData } from './settings'

const comparable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, comparable(item)]),
    )
  return value
}
const equal = (left: unknown, right: unknown) => JSON.stringify(comparable(left)) === JSON.stringify(comparable(right))
export const normalizeSiteSettings = (value: SiteSettingsData): SiteSettingsData => ({
  // 设置只含 JSON 数据；Vue 响应式代理不能直接 structuredClone。
  ...JSON.parse(JSON.stringify(value)),
  about: JSON.parse(JSON.stringify(value.about ?? emptyAbout())),
})
export function sameSiteValues(left: SiteSettingsData, right: SiteSettingsData) {
  const values = ({
    revision: _revision,
    updatedAt: _updatedAt,
    announcementUpdatedAt: _announcementUpdatedAt,
    ...value
  }: SiteSettingsData) => value
  return equal(values(normalizeSiteSettings(left)), values(normalizeSiteSettings(right)))
}
export function mergeSiteSettings(base: SiteSettingsData, local: SiteSettingsData, server: SiteSettingsData) {
  const merged = normalizeSiteSettings(server)
  const conflicts: string[] = []
  const choose = <T>(before: T, input: T, latest: T, path: string): T => {
    if (equal(input, before)) return structuredClone(latest)
    if (!equal(latest, before) && !equal(latest, input)) conflicts.push(path)
    return structuredClone(input)
  }
  for (const key of Object.keys(defaultSiteSettings) as (keyof SiteSettingsData)[]) {
    if (['revision', 'updatedAt', 'announcementUpdatedAt', 'about'].includes(key)) continue
    Object.assign(merged, { [key]: choose(base[key], local[key], server[key], key) })
  }
  const before = base.about ?? emptyAbout(),
    input = local.about ?? emptyAbout(),
    latest = server.about ?? emptyAbout()
  const sections = new Map<AboutSection['kind'], AboutSection>()
  for (const kind of Object.keys(aboutSectionLabels) as AboutSection['kind'][]) {
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
  merged.about = {
    visible: choose(before.visible, input.visible, latest.visible, 'about.visible'),
    introduction: choose(before.introduction, input.introduction, latest.introduction, 'about.introduction'),
    sections: [...new Set(ordered.map((section) => section.kind))].flatMap((kind) =>
      sections.has(kind) ? [sections.get(kind)!] : [],
    ),
  }
  return { merged, conflicts }
}

export interface SiteSettingsCopy {
  draft: SiteSettingsData
  base: SiteSettingsData
}
export interface SiteSettingsRecovery {
  version: 1
  draft: SiteSettingsData
  baseline: SiteSettingsData
  preserved: SiteSettingsCopy | null
  submission: SiteSettingsCopy | null
}
function isSettings(value: unknown): value is SiteSettingsData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as SiteSettingsData
  if (Object.keys(item).some((key) => !Object.hasOwn(defaultSiteSettings, key) && key !== 'about')) return false
  for (const key of Object.keys(defaultSiteSettings) as (keyof SiteSettingsData)[]) {
    if (['socials', 'revision'].includes(key)) continue
    if (typeof item[key] !== 'string' || (item[key] as string).length > 10000) return false
  }
  if (
    !Number.isSafeInteger(item.revision) ||
    item.revision < 0 ||
    !Array.isArray(item.socials) ||
    item.socials.length > 8
  )
    return false
  if (
    !item.socials.every(
      (social) =>
        social &&
        ['label', 'href', 'icon'].every(
          (key) =>
            typeof social[key as keyof typeof social] === 'string' && social[key as keyof typeof social].length <= 2000,
        ),
    )
  )
    return false
  if (item.about === undefined) return true
  const about = item.about
  return (
    !!about &&
    typeof about.visible === 'boolean' &&
    typeof about.introduction === 'string' &&
    about.introduction.length <= 5000 &&
    Array.isArray(about.sections) &&
    about.sections.length <= 4 &&
    new Set(about.sections.map((section) => section?.kind)).size === about.sections.length &&
    about.sections.every(
      (section) =>
        section &&
        Object.hasOwn(aboutSectionLabels, section.kind) &&
        typeof section.visible === 'boolean' &&
        Array.isArray(section.items) &&
        section.items.length <= 30 &&
        section.items.every(
          (entry) =>
            entry &&
            typeof entry.visible === 'boolean' &&
            typeof entry.title === 'string' &&
            entry.title.length <= 120 &&
            typeof entry.period === 'string' &&
            entry.period.length <= 80 &&
            typeof entry.detail === 'string' &&
            entry.detail.length <= 1000,
        ),
    )
  )
}
export function parseSiteSettingsRecovery(raw: string): SiteSettingsRecovery | null {
  if (raw.length > 2_000_000) return null
  try {
    const value = JSON.parse(raw)
    const baseline = typeof value.baseline === 'string' ? JSON.parse(value.baseline) : value.baseline
    if ((value.version !== undefined && value.version !== 1) || !isSettings(value.draft) || !isSettings(baseline))
      return null
    const copy = (entry: unknown): SiteSettingsCopy | null => {
      if (!entry) return null
      const candidate = entry as SiteSettingsCopy
      if (!isSettings(candidate.draft) || !isSettings(candidate.base)) throw new Error('恢复内容不完整')
      return { draft: normalizeSiteSettings(candidate.draft), base: normalizeSiteSettings(candidate.base) }
    }
    return {
      version: 1,
      draft: normalizeSiteSettings(value.draft),
      baseline: normalizeSiteSettings(baseline),
      preserved: copy(value.preserved),
      submission: copy(value.submission),
    }
  } catch {
    return null
  }
}
