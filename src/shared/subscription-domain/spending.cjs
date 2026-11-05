/** @file spending.cjs @description 已发生花费的估算：按价格历史分段枚举扣费、按币种与年份汇总，以及同周期涨跌价记录 */
'use strict'
const { cycleMonths, datesBetween, chargeUntil } = require('./schedule.cjs')

const CHARGE_LIMIT = 2400
/** 价格历史按生效日切成区段；首段向前延伸到首次扣费，没有历史时以当前价格为唯一区段 */
function segments(item) {
  const history = Array.isArray(item.priceHistory) && item.priceHistory.length ? item.priceHistory : [item]
  return history.map((entry, index) => ({
    from: index === 0 ? null : entry.effectiveAt.slice(0, 10),
    to: index + 1 < history.length ? history[index + 1].effectiveAt.slice(0, 10) : null,
    amount: entry.amount,
    currency: entry.currency,
    billingCycle: entry.billingCycle,
  }))
}
/**
 * 估算记录到今天为止的每笔扣费 { date, amount, currency }。首次扣费为试用到期日或开始日；
 * 一次性与买断没有日期时记一笔 date 为 null 的花费；返回 null 表示缺少日期、无法估算。
 */
function charges(item, today) {
  const first = item.trialEndDate || item.startDate || null
  if (item.subscriptionStatus === 'trial' && (!first || first > today)) return []
  if (!first) {
    if (cycleMonths(item.billingCycle) || item.subscriptionStatus === 'trial') return null
    return [{ date: null, amount: item.amount, currency: item.currency }]
  }
  const until = chargeUntil(item, today)
  if (!until) return null
  const result = []
  let previousRecurring = false
  for (const segment of segments(item)) {
    const from = segment.from && segment.from > first ? segment.from : first
    const to = segment.to && segment.to < until ? segment.to : until
    const months = cycleMonths(segment.billingCycle)
    if (from < to) {
      // 一次性/买断只在首次扣费或由周期付费改为买断时记一笔，单纯改价不算再次购买。
      const dates = months
        ? datesBetween(first, months, Number(first.slice(8, 10)), from, to, { limit: CHARGE_LIMIT })
        : from === first || previousRecurring
          ? [from]
          : []
      for (const date of dates) result.push({ date, amount: segment.amount, currency: segment.currency })
    }
    previousRecurring = !!months
  }
  return result
}
/** 同币种同周期相邻快照之间的金额变化，按生效日倒序 */
function priceChanges(item) {
  const history = Array.isArray(item.priceHistory) ? item.priceHistory : []
  const result = []
  for (let index = 1; index < history.length; index++) {
    const before = history[index - 1],
      after = history[index]
    if (before.currency !== after.currency || before.billingCycle !== after.billingCycle) continue
    if (before.amount === after.amount) continue
    result.push({
      id: item.id,
      name: item.name,
      date: after.effectiveAt.slice(0, 10),
      currency: after.currency,
      billingCycle: after.billingCycle,
      fromAmount: before.amount,
      toAmount: after.amount,
      ...(after.reason ? { reason: after.reason } : {}),
    })
  }
  return result
}
/** 汇总多条记录的累计花费：按币种给出总额、无法估算的记录数与逐年金额 */
function spendingSummary(records, today) {
  const buckets = new Map()
  const bucket = (currency) => {
    if (!buckets.has(currency)) buckets.set(currency, { currency, amount: 0n, unknownCount: 0, years: new Map() })
    return buckets.get(currency)
  }
  for (const item of records) {
    const list = charges(item, today)
    if (list === null) {
      bucket(item.currency).unknownCount++
      continue
    }
    for (const charge of list) {
      const target = bucket(charge.currency)
      target.amount += BigInt(charge.amount)
      if (!charge.date) continue
      const year = Number(charge.date.slice(0, 4))
      target.years.set(year, (target.years.get(year) ?? 0n) + BigInt(charge.amount))
    }
  }
  return buckets
}

module.exports = { charges, priceChanges, spendingSummary }
