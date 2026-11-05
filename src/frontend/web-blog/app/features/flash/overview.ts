/**
 * @file overview.ts
 * @description 闪念概览的本地计算：私有视图与本地演示仓库已持有完整集合，按与后端 /flashes/overview 相同的口径聚合
 * @author TixXin
 * @since 2026-10-18
 */

import type { FlashNote, FlashOverview, FlashRecollection } from './types'
import { DEFAULT_SITE_TIME_ZONE, siteDayKey } from '~/features/site/timeZone'

/** 摘录长度与后端一致 */
const EXCERPT_LENGTH = 300

function recollection(note: FlashNote): FlashRecollection {
  return { id: note.id, content: note.content.slice(0, EXCERPT_LENGTH), createdAt: note.createdAt }
}

/**
 * 由完整集合计算概览：日期、本月数与往年今日均按站点时区，与后端概览口径一致；标签按次数倒序、同次数按名称。
 * 随机回顾候选取全部条目，由卡片在挂载后随机挑选。
 */
export function summarizeFlashNotes(
  notes: FlashNote[],
  now = new Date(),
  timeZone = DEFAULT_SITE_TIME_ZONE,
): FlashOverview {
  const dates = new Map<string, number>()
  const tags = new Map<string, number>()
  const today = siteDayKey(now, timeZone)
  const month = today.slice(0, 7)
  const monthDay = today.slice(5, 10)
  const year = Number(today.slice(0, 4))
  let monthCount = 0
  let onThisDay: FlashNote | null = null
  for (const note of notes) {
    const day = siteDayKey(note.createdAt, timeZone)
    dates.set(day, (dates.get(day) ?? 0) + 1)
    note.tags.forEach((tag) => tags.set(tag, (tags.get(tag) ?? 0) + 1))
    if (day.startsWith(month)) monthCount += 1
    if (day.slice(5) === monthDay && Number(day.slice(0, 4)) < year) {
      if (!onThisDay || new Date(note.createdAt).getTime() > new Date(onThisDay.createdAt).getTime()) onThisDay = note
    }
  }
  return {
    total: notes.length,
    monthCount,
    dates: [...dates.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => b.date.localeCompare(a.date)),
    tags: [...tags.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    onThisDay: onThisDay ? recollection(onThisDay) : null,
    recollections: notes.map(recollection),
    likedIds: notes.filter((note) => note.liked).map((note) => note.id),
  }
}
