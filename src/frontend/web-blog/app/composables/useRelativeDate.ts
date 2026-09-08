/**
 * @file useRelativeDate.ts
 * @description 日期相对时间格式化工具，7 天内显示相对时间，否则显示完整日期
 * @author TixXin
 * @since 2026-03-21
 */

/**
 * 将日期字符串格式化为相对时间或完整日期
 * - 今天 -> "发布于今天"
 * - 昨天 -> "发布于昨天"
 * - 2~7 天内 -> "发布于x天前"
 * - 其他 -> "发布于 xxxx-xx-xx"
 */
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

/** 带时区的时间按本地日历显示；纯日期保留日历含义，非法输入不显示原始技术字符串。 */
export function formatCalendarDate(dateStr: string): string {
  const target = parseCalendarDate(dateStr)
  return target ? calendarLabel(target) : '日期未知'
}

export function formatRelativeDate(dateStr: string): string {
  const target = parseCalendarDate(dateStr)
  if (!target) return '发布日期未知'
  const now = new Date()

  // 归一化到当天 00:00:00，避免时分秒影响天数计算
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const diffMs = today.getTime() - targetDay.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '发布于今天'
  if (diffDays === 1) return '发布于昨天'
  // 负数为未来日期，不适用"x天前"，与超过 7 天一样回退到完整日期
  if (diffDays >= 2 && diffDays <= 7) return `发布于${diffDays}天前`
  return `发布于 ${calendarLabel(target)}`
}
