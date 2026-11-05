/** @file dates.cjs @description 订阅业务日期的纯函数：真实日历日校验、时区当天、月份推进与按日偏移 */
'use strict'

function isDate(value) {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value + 'T00:00:00.000Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
/** 指定时区（IANA 名）的当天日期；不传时区按 UTC */
function todayDate(timeZone = 'UTC', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
function daysInMonth(year, month) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}
function addMonths(date, months, anchorDay = Number(date.slice(8, 10))) {
  if (!isDate(date) || !Number.isInteger(months) || !Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31)
    throw new RangeError('计费日期或锚点无效')
  const index = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1 + months
  const year = Math.floor(index / 12),
    month = (index % 12) + 1
  if (year < 1 || year > 9999) throw new RangeError('计费日期超出范围')
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(anchorDay, daysInMonth(year, month))).padStart(2, '0')}`
}
/** 按日偏移；只用于区间端点（如“今天之后的一天”），不参与周期锚点 */
function addDays(date, days) {
  if (!isDate(date) || !Number.isInteger(days)) throw new RangeError('日期无效')
  const value = new Date(date + 'T00:00:00.000Z')
  value.setUTCDate(value.getUTCDate() + days)
  const result = value.toISOString().slice(0, 10)
  if (!isDate(result)) throw new RangeError('日期超出范围')
  return result
}
function monthIndex(date) {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
}

module.exports = { isDate, todayDate, daysInMonth, addMonths, addDays, monthIndex }
