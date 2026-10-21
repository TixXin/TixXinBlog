/**
 * @file date.ts
 * @description 闪念卡片与时间胶囊相对时间及日历日期格式化：保证 SSR 首帧与水合时区一致
 * @author TixXin
 * @since 2026-10-21
 */

// 类型元信息：idea/todo 显示，memo 默认态隐藏避免冗余
export const FLASH_TYPE_META: Record<string, { icon: string; labelKey: string } | undefined> = {
  idea: { icon: 'lucide:lightbulb', labelKey: 'flash-moment.flashType.idea' },
  todo: { icon: 'lucide:check-square', labelKey: 'flash-moment.flashType.todo' },
}

/** 闪念日历日期（未挂载时使用 UTC 日期防抖，挂载后使用 formatCalendarDate） */
export function formatFlashCalendarDate(iso: string, clockReady: boolean, t: (key: string) => string): string {
  if (clockReady) return formatCalendarDate(iso, t)
  const time = new Date(iso).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : t('common.date.unknown')
}

/** 相对时间展示：首屏水合一致，挂载后换成本机时钟 */
export function formatFlashRelative(
  iso: string,
  now: number,
  clockReady: boolean,
  t: (key: string, values?: Record<string, unknown>, count?: number) => string,
): string {
  const created = new Date(iso).getTime()
  if (!Number.isFinite(created) || created > now) return formatFlashCalendarDate(iso, clockReady, t)
  const diff = now - created
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return t('flash-moment.noteCard.justNow')
  if (diff < hour)
    return t('flash-moment.noteCard.minutesAgo', { count: Math.floor(diff / minute) }, Math.floor(diff / minute))
  if (diff < day)
    return t('flash-moment.noteCard.hoursAgo', { count: Math.floor(diff / hour) }, Math.floor(diff / hour))
  // 与文章列表的“昨天”说法保持一致
  if (diff < 2 * day) return t('flash-moment.noteCard.yesterday')
  if (diff < 7 * day)
    return t('flash-moment.noteCard.daysAgo', { count: Math.floor(diff / day) }, Math.floor(diff / day))
  return formatFlashCalendarDate(iso, clockReady, t)
}
