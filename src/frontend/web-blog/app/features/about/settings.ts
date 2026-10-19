/** @file settings.ts @description 关于页空白缺省与栏目名称，不预填未经确认的个人事实 */
import type { AboutSection, AboutSettings } from './types'
import type { Translate } from '~/utils/format'

export const aboutSectionLabelKeys: Record<AboutSection['kind'], string> = {
  experience: 'misc.about.section.experience',
  skill: 'misc.about.section.skill',
  interest: 'misc.about.section.interest',
  reading: 'misc.about.section.reading',
}
/** 关于页栏目的界面名称，随当前语言 */
export function aboutSectionLabel(kind: AboutSection['kind'], t: Translate): string {
  return t(aboutSectionLabelKeys[kind])
}
export function emptyAbout(): AboutSettings {
  return { visible: false, introduction: '', sections: [] }
}
export function publicAbout(value: AboutSettings | undefined): AboutSettings {
  if (!value?.visible) return emptyAbout()
  return {
    ...value,
    sections: value.sections
      .filter((section) => section.visible)
      .map((section) => ({ ...section, items: section.items.filter((item) => item.visible && item.title.trim()) }))
      .filter((section) => section.items.length),
  }
}
