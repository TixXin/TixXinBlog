/** @file display.ts @description 留言显示时间与日期分组，统一UTC以保持SSR和跨主题顺序一致 */
import type { DateGroup, GuestbookRecord, GuestMessage } from './types'
export function guestbookDisplay(note: GuestbookRecord): GuestMessage {
  const date = new Date(note.createdAt)
  const time = Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'UTC',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
    : ''
  return { ...note, avatar: note.avatar || '/avatar.svg', time, replyTo: note.replyTo ?? undefined }
}
export function guestbookGroups(notes: GuestbookRecord[], ascending: boolean): DateGroup[] {
  const ordered = [...notes].sort(
    (a, b) => (a.createdAt.localeCompare(b.createdAt) || a.id - b.id) * (ascending ? 1 : -1),
  )
  const groups = new Map<string, GuestMessage[]>()
  for (const note of ordered) {
    const date = note.createdAt.slice(0, 10)
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date)!.push(guestbookDisplay(note))
  }
  return [...groups].map(([date, messages]) => ({ date, messages }))
}
