/** @file settings.ts @description 关于页空白缺省与栏目名称，不预填未经确认的个人事实 */
import type { AboutSettings } from './types'

export const aboutSectionLabels = { experience: '经历', skill: '技能', interest: '兴趣', reading: '书单' }
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
