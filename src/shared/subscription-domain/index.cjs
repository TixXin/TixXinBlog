/** @file index.cjs @description 订阅费用的纯领域规则；浏览器与服务端共用，不进行网络或存储操作 */
'use strict'
const { isDate, todayDate, addMonths, addDays, monthIndex } = require('./dates.cjs')
const schedule = require('./schedule.cjs')
const { charges, priceChanges, spendingSummary } = require('./spending.cjs')
const rates = require('./rates.cjs')

const CURRENCY_DIGITS = Object.freeze({ CNY: 2, USD: 2, EUR: 2, GBP: 2, JPY: 0, HKD: 2, TWD: 2 })
const CURRENCIES = Object.freeze(Object.keys(CURRENCY_DIGITS))
const SUBSCRIPTION_CATEGORIES = Object.freeze([
  'development',
  'cloud',
  'entertainment',
  'productivity',
  'ai',
  'communication',
  'education',
  'design',
  'other',
])
const BILLING_CYCLES = Object.freeze([
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
  'biennial',
  'triennial',
  'lifetime',
  'one-time',
])
const SUBSCRIPTION_STATUSES = Object.freeze(['active', 'paused', 'cancelled', 'trial', 'expired'])
const PUBLICATION_STATUSES = Object.freeze(['draft', 'published', 'withdrawn'])
const MAX_AMOUNT = 2147483647

function currencyDigits(currency) {
  if (!Object.hasOwn(CURRENCY_DIGITS, currency)) throw new RangeError('不支持的币种')
  return CURRENCY_DIGITS[currency]
}
function validAmount(amount, maximum = MAX_AMOUNT) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > maximum)
    throw new RangeError('金额必须是范围内的非负整数最小单位')
}
function parseAmount(input, currency) {
  const digits = currencyDigits(currency)
  if (typeof input !== 'string' || input.length > 32) throw new RangeError('请输入有效金额')
  const value = input.trim()
  if (!(digits ? /^\d+(?:\.\d+)?$/ : /^\d+$/).test(value)) throw new RangeError('请输入有效金额')
  const [integer, fraction = ''] = value.split('.')
  if (fraction.length > digits) throw new RangeError(`该币种最多支持 ${digits} 位小数`)
  const amount = BigInt(integer) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0') || '0')
  if (amount > BigInt(MAX_AMOUNT)) throw new RangeError('金额超出范围')
  return Number(amount)
}
function amountInput(amount, currency) {
  const digits = currencyDigits(currency)
  validAmount(amount, Number.MAX_SAFE_INTEGER)
  const raw = String(amount).padStart(digits + 1, '0')
  return digits ? `${raw.slice(0, -digits)}.${raw.slice(-digits)}` : raw
}
function formatAmount(amount, currency) {
  const value = amountInput(amount, currency),
    [whole, fraction] = value.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${currency} ${grouped}${fraction === undefined ? '' : '.' + fraction}`
}
function validatePricing(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RangeError('价格信息无效')
  validAmount(value.amount)
  currencyDigits(value.currency)
  if (!BILLING_CYCLES.includes(value.billingCycle)) throw new RangeError('计费周期无效')
}
function samePricing(a, b) {
  return a.amount === b.amount && a.currency === b.currency && a.billingCycle === b.billingCycle
}
function isTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value && isDate(value.slice(0, 10))
}
function validatePriceHistory(history, current, referenceTime = new Date().toISOString()) {
  if (!isTimestamp(referenceTime)) throw new RangeError('价格历史核对时间无效')
  if (!Array.isArray(history) || !history.length || history.length > 10000)
    throw new RangeError('价格历史必须包含初始价格且不能超过 10000 条')
  const ids = new Set(),
    keys = ['id', 'effectiveAt', 'recordedAt', 'amount', 'currency', 'billingCycle', 'reason']
  let previous
  const entries = history.map((entry) => {
    validatePricing(entry)
    if (Object.keys(entry).some((key) => !keys.includes(key))) throw new RangeError('价格历史包含未知字段')
    if (
      typeof entry.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.id) ||
      ids.has(entry.id.toLowerCase())
    )
      throw new RangeError('价格事件标识无效或重复')
    if (
      !isTimestamp(entry.effectiveAt) ||
      !isTimestamp(entry.recordedAt) ||
      entry.effectiveAt > entry.recordedAt ||
      entry.recordedAt > referenceTime
    )
      throw new RangeError('价格事件时间无效')
    if (
      previous &&
      (entry.effectiveAt < previous.effectiveAt ||
        entry.recordedAt < previous.recordedAt ||
        samePricing(previous, entry))
    )
      throw new RangeError('价格历史顺序或价格变化无效')
    if (
      entry.reason !== undefined &&
      (typeof entry.reason !== 'string' || !entry.reason.trim() || entry.reason.length > 500)
    )
      throw new RangeError('价格变更原因无效')
    ids.add(entry.id.toLowerCase())
    previous = entry
    return { ...entry }
  })
  if (current) {
    validatePricing(current)
    if (!samePricing(entries.at(-1), current)) throw new RangeError('当前价格与末次价格历史不一致')
  }
  return entries
}
function appendPriceHistory(history, next, options) {
  validatePricing(next)
  const prior = history.length ? validatePriceHistory(history) : []
  if (prior.length && samePricing(prior.at(-1), next)) return prior
  const reason = options.reason?.trim()
  return validatePriceHistory(
    [
      ...prior,
      {
        id: options.id,
        effectiveAt: options.effectiveAt ?? options.recordedAt,
        recordedAt: options.recordedAt,
        amount: next.amount,
        currency: next.currency,
        billingCycle: next.billingCycle,
        ...(reason ? { reason } : {}),
      },
    ],
    next,
  )
}
function safeNumber(value) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('统计金额超出安全范围')
  return Number(value)
}
/** 年化金额按 ×72 累加（864 能被全部周期月数整除），汇总后才取整，避免多年周期逐条舍入 */
const ANNUAL_SCALE = 72n
function annualScaled(item) {
  return (BigInt(item.amount) * 12n * ANNUAL_SCALE) / BigInt(schedule.cycleMonths(item.billingCycle))
}
const roundScaled = (value, scale) => (value + scale / 2n) / scale
/** 记录的业务日期与状态校验：结束日、试用到期日均不能早于开始日 */
function validateRecord(item) {
  validatePricing(item)
  if (!SUBSCRIPTION_CATEGORIES.includes(item.category) || !SUBSCRIPTION_STATUSES.includes(item.subscriptionStatus))
    throw new RangeError('订阅分类或状态无效')
  for (const key of ['startDate', 'nextBillingDate', 'trialEndDate', 'endDate'])
    if (item[key] != null && !isDate(item[key])) throw new RangeError('订阅日期无效')
  if (item.startDate && item.nextBillingDate && item.nextBillingDate < item.startDate)
    throw new RangeError('下次扣费不能早于订阅开始日期')
  if (item.startDate && item.trialEndDate && item.trialEndDate < item.startDate)
    throw new RangeError('试用到期不能早于订阅开始日期')
  if (item.startDate && item.endDate && item.endDate < item.startDate)
    throw new RangeError('结束日期不能早于订阅开始日期')
}
function createBucket(currency, firstMonth) {
  return {
    currency,
    count: 0,
    activeCount: 0,
    recurringCount: 0,
    annual: 0n,
    oneTime: 0n,
    categories: new Map(),
    forecast: Array.from({ length: 12 }, (_, index) => ({
      month: addMonths(firstMonth, index).slice(0, 7),
      amount: 0n,
    })),
    upcoming: [],
  }
}
/** 计入当前预算：活跃、已开始、尚未结束 */
function isBudgeted(item, today) {
  return (
    item.subscriptionStatus === 'active' &&
    (!item.startDate || item.startDate <= today) &&
    (!item.endDate || item.endDate > today)
  )
}
function addRecord(bucket, item, today, firstMonth, end, rollForward) {
  bucket.count++
  if (!bucket.categories.has(item.category))
    bucket.categories.set(item.category, { category: item.category, count: 0, annual: 0n })
  const category = bucket.categories.get(item.category)
  category.count++
  const active = isBudgeted(item, today)
  if (active) bucket.activeCount++
  if (active && schedule.cycleMonths(item.billingCycle)) {
    bucket.recurringCount++
    const annual = annualScaled(item)
    bucket.annual += annual
    category.annual += annual
  }
  if (!schedule.cycleMonths(item.billingCycle)) bucket.oneTime += BigInt(item.amount)
  const dates = schedule.upcomingDates(item, today, end)
  for (const date of dates) bucket.forecast[monthIndex(date) - monthIndex(firstMonth)].amount += BigInt(item.amount)
  // 公开展示（rollForward）按锚点推算下一次，不把博主未及时更新的日期当成逾期。
  const overdue = !rollForward && schedule.isOverdue(item, today)
  const date = overdue ? item.nextBillingDate : dates[0]
  if (date)
    bucket.upcoming.push({
      id: item.id,
      name: item.name,
      date,
      amount: item.amount,
      currency: item.currency,
      overdue,
      trial: item.subscriptionStatus === 'trial',
    })
  return active
}
function bucketResult(bucket) {
  return {
    currency: bucket.currency,
    count: bucket.count,
    activeCount: bucket.activeCount,
    recurringCount: bucket.recurringCount,
    annualAmount: safeNumber(roundScaled(bucket.annual, ANNUAL_SCALE)),
    monthlyAmount: safeNumber(roundScaled(bucket.annual, ANNUAL_SCALE * 12n)),
    oneTimeAmount: safeNumber(bucket.oneTime),
    categories: [...bucket.categories.values()].map((category) => ({
      category: category.category,
      count: category.count,
      annualAmount: safeNumber(roundScaled(category.annual, ANNUAL_SCALE)),
    })),
    forecast: bucket.forecast.map((point) => ({ month: point.month, amount: safeNumber(point.amount) })),
    upcoming: bucket.upcoming.sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id))),
  }
}
function spendingResult(records, today) {
  const buckets = spendingSummary(records, today)
  return CURRENCIES.filter((currency) => buckets.has(currency)).map((currency) => {
    const bucket = buckets.get(currency)
    return {
      currency,
      amount: safeNumber(bucket.amount),
      unknownCount: bucket.unknownCount,
      years: [...bucket.years.entries()]
        .sort(([a], [b]) => a - b)
        .map(([year, amount]) => ({ year, amount: safeNumber(amount) })),
    }
  })
}
/**
 * 分币种统计：当前预算、12 个月预测、近期扣费、累计花费估算与涨跌价记录。
 * options.rollForward 为真时（公开展示）逾期日期按周期推算到今天之后，不报逾期。
 */
function statistics(records, today = todayDate(), options = {}) {
  if (!isDate(today)) throw new RangeError('统计日期无效')
  const firstMonth = today.slice(0, 7) + '-01',
    end = addMonths(firstMonth, 12)
  const result = { asOf: today, total: records.length, activeCount: 0, recurringCount: 0, categoryCount: 0 }
  const categories = new Set(),
    buckets = new Map()
  for (const item of records) {
    validateRecord(item)
    categories.add(item.category)
    if (!buckets.has(item.currency)) buckets.set(item.currency, createBucket(item.currency, firstMonth))
    const active = addRecord(buckets.get(item.currency), item, today, firstMonth, end, !!options.rollForward)
    if (active) result.activeCount++
    if (active && schedule.cycleMonths(item.billingCycle)) result.recurringCount++
  }
  result.categoryCount = categories.size
  result.currencies = CURRENCIES.filter((currency) => buckets.has(currency)).map((c) => bucketResult(buckets.get(c)))
  result.spending = spendingResult(records, today)
  result.priceChanges = records
    .flatMap((item) => priceChanges(item))
    .sort((a, b) => b.date.localeCompare(a.date) || String(a.id).localeCompare(String(b.id)))
  return result
}
/** 参考汇率换算的便捷封装：使用本包的币种小数位 */
function convertAmount(amount, currency, config) {
  return rates.convertAmount(amount, currency, config, CURRENCY_DIGITS)
}
function validateRates(value) {
  return rates.validateRates(value, CURRENCY_DIGITS)
}

exports.CURRENCIES = CURRENCIES
exports.CURRENCY_DIGITS = CURRENCY_DIGITS
exports.SUBSCRIPTION_CATEGORIES = SUBSCRIPTION_CATEGORIES
exports.BILLING_CYCLES = BILLING_CYCLES
exports.SUBSCRIPTION_STATUSES = SUBSCRIPTION_STATUSES
exports.PUBLICATION_STATUSES = PUBLICATION_STATUSES
exports.MAX_AMOUNT = MAX_AMOUNT
exports.CYCLE_MONTHS = schedule.CYCLE_MONTHS
exports.isDate = isDate
exports.todayDate = todayDate
exports.addMonths = addMonths
exports.addDays = addDays
exports.parseAmount = parseAmount
exports.amountInput = amountInput
exports.formatAmount = formatAmount
exports.validatePricing = validatePricing
exports.validatePriceHistory = validatePriceHistory
exports.appendPriceHistory = appendPriceHistory
exports.validateRecord = validateRecord
exports.statistics = statistics
exports.nextChargeDate = schedule.nextChargeDate
exports.scheduleDates = schedule.scheduleDates
exports.isOverdue = schedule.isOverdue
exports.advanceBilling = schedule.advanceBilling
exports.charges = charges
exports.priceChanges = priceChanges
exports.parseRate = rates.parseRate
exports.validateRates = validateRates
exports.convertAmount = convertAmount
