/** @file schedule.cjs @description 扣费日程：周期月数、锚点日、未来扣费推算、已发生扣费枚举与“已续费”推进 */
'use strict'
const { addDays, addMonths, monthIndex } = require('./dates.cjs')
const { hasOpenPause, isPausedOn } = require('./pauses.cjs')

const CYCLE_MONTHS = Object.freeze({ monthly: 1, quarterly: 3, semiannual: 6, yearly: 12, biennial: 24, triennial: 36 })
function cycleMonths(cycle) {
  return Object.hasOwn(CYCLE_MONTHS, cycle) ? CYCLE_MONTHS[cycle] : null
}
/** 下一次日期因短月被截断时，沿用可验证的原始开始日，避免月底永久漂移 */
function anchorDay(item, anchor, months) {
  if (item.startDate && item.subscriptionStatus !== 'trial') {
    const distance = monthIndex(anchor) - monthIndex(item.startDate)
    if (distance >= 0 && distance % months === 0 && addMonths(item.startDate, distance) === anchor)
      return Number(item.startDate.slice(8, 10))
  }
  return Number(anchor.slice(8, 10))
}
/** [from, to) 内以 anchor 为起点、按周期推算的日期；allowBefore 为假时不早于锚点本身 */
function datesBetween(anchor, months, day, from, to, { allowBefore = false, limit = 16 } = {}) {
  let index = Math.floor((monthIndex(from) - monthIndex(anchor)) / months) - 1
  if (!allowBefore) index = Math.max(0, index)
  const result = []
  for (let guard = 0; guard < limit + 2 && result.length < limit; guard++, index++) {
    const date = addMonths(anchor, index * months, day)
    if (date >= to) break
    if (date >= from) result.push(date)
  }
  return result
}
/** 未来扣费锚点：活跃记录取下次扣费或开始日；试用只在填写了到期日时从到期日起转正计费 */
function futureAnchor(item) {
  if (item.subscriptionStatus === 'trial') return item.trialEndDate || null
  if (item.subscriptionStatus === 'active') return item.nextBillingDate || item.startDate || null
  return null
}
/** 今天（含）到 end（不含）之间的扣费日；结束日当天及之后不再扣费 */
function upcomingDates(item, today, end, limit = 16) {
  const months = cycleMonths(item.billingCycle),
    anchor = futureAnchor(item)
  if (!months || !anchor) return []
  const from = item.startDate && item.startDate > today ? item.startDate : today
  const stop = item.endDate && item.endDate < end ? item.endDate : end
  // 暂停期间的扣费日跳过；多取一些再截断，避免暂停占满窗口时少算
  return datesBetween(anchor, months, anchorDay(item, anchor, months), from, stop, { limit: limit * 4 })
    .filter((date) => !isPausedOn(item, date))
    .slice(0, limit)
}
/** 今天起的下一次扣费日；超过两个周期仍没有则视为无 */
function nextChargeDate(item, today) {
  const months = cycleMonths(item.billingCycle)
  if (!months) return null
  return upcomingDates(item, today, addMonths(today, months * 2), 1)[0] ?? null
}
/** 今天起 months 个月内的扣费日（续费日历用），最多 60 个 */
function scheduleDates(item, today, months = 12) {
  return upcomingDates(item, today, addMonths(today, months), 60)
}
/** 活跃周期记录的下次扣费日早于今天（且服务未在那之前结束）即为逾期 */
function isOverdue(item, today) {
  return (
    item.subscriptionStatus === 'active' &&
    !!cycleMonths(item.billingCycle) &&
    !!item.nextBillingDate &&
    item.nextBillingDate < today &&
    (!item.endDate || item.nextBillingDate < item.endDate)
  )
}
/** “已续费”：把下次扣费日推进一个周期；无周期或无下次扣费日时返回 null */
function advanceBilling(item) {
  const months = cycleMonths(item.billingCycle)
  if (!months || !item.nextBillingDate) return null
  return addMonths(item.nextBillingDate, months, anchorDay(item, item.nextBillingDate, months))
}
/**
 * 已发生扣费的截止日（不含）：结束日；活跃与试用记录到今天为止；暂停、取消、过期且无结束日时
 * 以记录的下次扣费日为界，两者都没有则无法判断。
 */
function chargeUntil(item, today) {
  const tomorrow = addDays(today, 1)
  let until = item.endDate || null
  // 暂停中且记录了未结束的暂停区间：扣费到暂停开始为止，由区间过滤，截止到今天
  if (!until && (['active', 'trial'].includes(item.subscriptionStatus) || hasOpenPause(item))) until = tomorrow
  if (!until) until = item.nextBillingDate || null
  if (!until) return null
  return until < tomorrow ? until : tomorrow
}

module.exports = {
  CYCLE_MONTHS,
  cycleMonths,
  anchorDay,
  datesBetween,
  upcomingDates,
  nextChargeDate,
  scheduleDates,
  isOverdue,
  advanceBilling,
  chargeUntil,
}
