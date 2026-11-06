/** @file pauses.cjs @description 订阅暂停区间：[from, to) 内不扣费；to 为空表示仍在暂停。校验顺序、重叠与开始日边界 */
'use strict'
const { isDate } = require('./dates.cjs')

const MAX_PAUSED_PERIODS = 50
/** 校验并返回规范化副本：按开始日递增、互不重叠，只有最后一段可以未结束，不能早于订阅开始日 */
function validatePausedPeriods(periods, startDate = null) {
  if (periods == null) return []
  if (!Array.isArray(periods) || periods.length > MAX_PAUSED_PERIODS) throw new RangeError('暂停区间无效')
  let previous = null
  return periods.map((period, index) => {
    if (!period || typeof period !== 'object' || Array.isArray(period)) throw new RangeError('暂停区间无效')
    if (Object.keys(period).some((key) => key !== 'from' && key !== 'to')) throw new RangeError('暂停区间无效')
    const { from, to = null } = period
    if (!isDate(from) || (to !== null && (!isDate(to) || to <= from))) throw new RangeError('暂停区间无效')
    if (startDate && from < startDate) throw new RangeError('暂停不能早于订阅开始日期')
    if (previous && (previous.to === null || previous.to > from)) throw new RangeError('暂停区间顺序或重叠无效')
    if (to === null && index !== periods.length - 1) throw new RangeError('暂停区间顺序或重叠无效')
    previous = { from, to }
    return previous
  })
}
/** 该日是否处于暂停中 */
function isPausedOn(item, date) {
  const periods = Array.isArray(item.pausedPeriods) ? item.pausedPeriods : []
  return periods.some((period) => period.from <= date && (period.to == null || date < period.to))
}
/** 是否有尚未结束的暂停 */
function hasOpenPause(item) {
  const periods = Array.isArray(item.pausedPeriods) ? item.pausedPeriods : []
  return periods.length > 0 && periods.at(-1).to == null
}

module.exports = { MAX_PAUSED_PERIODS, validatePausedPeriods, isPausedOn, hasOpenPause }
