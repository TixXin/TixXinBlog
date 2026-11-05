/**
 * @file useRelativeDate.ts
 * @description 日期相对时间格式化工具，7 天内显示相对时间，否则显示完整日期；文案取自 common 字典。
 *   传入站点时区时，“今天”与日期都按站点时区计算（与归档、日历一致，SSR 与浏览器结果相同）；不传时按本机时区。
 * @author TixXin
 * @since 2026-03-21
 */
import { currentTranslate, type Translate } from '~/utils/format'
import { dayKeyDiff, siteDayKey } from '~/features/site/timeZone'

function parseCalendarDate(dateStr: string): Date | null {
  // 纯日期串（YYYY-MM-DD）按本地时区解析：new Date('2026-04-03') 会被解析为 UTC 午夜，
  // 在 UTC 负偏移时区会回退到前一天，导致"今天"被算成"昨天"
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  const target = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(dateStr)
  if (!Number.isFinite(target.getTime())) return null
  if (
    dateOnly &&
    (target.getFullYear() !== Number(dateOnly[1]) ||
      target.getMonth() + 1 !== Number(dateOnly[2]) ||
      target.getDate() !== Number(dateOnly[3]))
  )
    return null
  return target
}

function calendarLabel(target: Date) {
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
}

/** 站点时区下的日期键；纯日期须是真实存在的公历日，非法输入返回空串 */
function siteCalendarKey(dateStr: string, timeZone: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (dateOnly) {
    const date = new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateStr ? dateStr : ''
  }
  return siteDayKey(dateStr, timeZone)
}

/** 带时区的时间按站点时区（未传时按本地）日历显示；纯日期保留日历含义，非法输入不显示原始技术字符串。 */
export function formatCalendarDate(dateStr: string, t: Translate = currentTranslate(), timeZone?: string): string {
  if (timeZone) return siteCalendarKey(dateStr, timeZone) || t('common.date.unknown')
  const target = parseCalendarDate(dateStr)
  return target ? calendarLabel(target) : t('common.date.unknown')
}

/**
 * 将日期字符串格式化为相对时间或完整日期（以中文为例，英文见 common 字典）
 * - 今天 -> "发布于今天"
 * - 昨天 -> "发布于昨天"
 * - 2~7 天内 -> "发布于x天前"
 * - 其他 -> "发布于 xxxx-xx-xx"
 */
export function formatRelativeDate(dateStr: string, t: Translate = currentTranslate(), timeZone?: string): string {
  if (timeZone) return relativeSiteDate(dateStr, t, timeZone)
  const target = parseCalendarDate(dateStr)
  if (!target) return t('common.date.publishedUnknown')
  const now = new Date()

  // 归一化到当天 00:00:00，避免时分秒影响天数计算
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const diffMs = today.getTime() - targetDay.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return t('common.date.publishedToday')
  if (diffDays === 1) return t('common.date.publishedYesterday')
  // 负数为未来日期，不适用"x天前"，与超过 7 天一样回退到完整日期
  if (diffDays >= 2 && diffDays <= 7) return t('common.date.publishedDaysAgo', { days: diffDays })
  return t('common.date.publishedOn', { date: calendarLabel(target) })
}

/** 按站点时区计算相对天数，文案规则与本地版本相同 */
function relativeSiteDate(dateStr: string, t: Translate, timeZone: string): string {
  const day = siteCalendarKey(dateStr, timeZone)
  if (!day) return t('common.date.publishedUnknown')
  const diffDays = dayKeyDiff(siteDayKey(Date.now(), timeZone), day)
  if (diffDays === 0) return t('common.date.publishedToday')
  if (diffDays === 1) return t('common.date.publishedYesterday')
  if (diffDays >= 2 && diffDays <= 7) return t('common.date.publishedDaysAgo', { days: diffDays })
  return t('common.date.publishedOn', { date: day })
}
