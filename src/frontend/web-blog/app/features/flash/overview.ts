/**
 * @file overview.ts
 * @description 闪念概览的本地计算：私有视图与本地演示仓库已持有完整集合，按与后端 /flashes/overview 相同的口径聚合
 * @author TixXin
 * @since 2026-10-18
 */

import type { FlashNote, FlashOverview, FlashRecollection } from './types'

/** 摘录长度与后端一致 */
const EXCERPT_LENGTH = 300

function recollection(note: FlashNote): FlashRecollection {
  return { id: note.id, content: note.content.slice(0, EXCERPT_LENGTH), createdAt: note.createdAt }
}

/** UTC 日期键（YYYY-MM-DD），与发布日历分组口径一致 */
export function flashUtcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

/**
 * 由完整集合计算概览：日期、本月数与往年今日均按 UTC；标签按次数倒序、同次数按名称。
 * 随机回顾候选取全部条目，由卡片在挂载后随机挑选。
 */
export function summarizeFlashNotes(notes: FlashNote[], now = new Date()): FlashOverview {
  const dates = new Map<string, number>()
  const tags = new Map<string, number>()
  const month = now.toISOString().slice(0, 7)
  const monthDay = now.toISOString().slice(5, 10)
  const year = now.getUTCFullYear()
  let monthCount = 0
  let onThisDay: FlashNote | null = null
  for (const note of notes) {
    const day = flashUtcDay(note.createdAt)
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
