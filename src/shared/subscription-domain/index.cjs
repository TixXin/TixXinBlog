/** @file index.cjs @description 订阅费用的纯领域规则；浏览器与服务端共用，不进行网络或存储操作 */
'use strict'

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
const BILLING_CYCLES = Object.freeze(['monthly', 'quarterly', 'yearly', 'lifetime', 'one-time'])
const SUBSCRIPTION_STATUSES = Object.freeze(['active', 'paused', 'cancelled', 'trial', 'expired'])
const PUBLICATION_STATUSES = Object.freeze(['draft', 'published', 'withdrawn'])
const MAX_AMOUNT = 2147483647
const cycleMonths = { monthly: 1, quarterly: 3, yearly: 12 }
const annualFactors = { monthly: 12, quarterly: 4, yearly: 1 }

function isDate(value) {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value + 'T00:00:00.000Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
function todayDate() {
  return new Date().toISOString().slice(0, 10)
}
function daysInMonth(year, month) {
  return [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1]
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
function monthIndex(date) {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
}
function occurrences(item, today, end) {
  const months = cycleMonths[item.billingCycle]
  const anchor = item.nextBillingDate || item.startDate
  if (!months || !anchor || item.subscriptionStatus !== 'active') return []
  let day = Number(anchor.slice(8, 10))
  // 下一次日期因短月被截断时，沿用可验证的原始开始日，避免月底永久漂移。
  if (item.startDate) {
    const distance = monthIndex(anchor) - monthIndex(item.startDate)
    if (distance >= 0 && distance % months === 0 && addMonths(item.startDate, distance) === anchor)
      day = Number(item.startDate.slice(8, 10))
  }
  const start = item.startDate && item.startDate > today ? item.startDate : today
  const first = Math.max(0, Math.floor((monthIndex(start) - monthIndex(anchor)) / months) - 1)
  const result = []
  for (let index = first; index < first + 16; index++) {
    const date = addMonths(anchor, index * months, day)
    if (date >= end) break
    if (date >= start) result.push(date)
  }
  return result
}
function statistics(records, today = todayDate()) {
  if (!isDate(today)) throw new RangeError('统计日期无效')
  const firstMonth = today.slice(0, 7) + '-01',
    end = addMonths(firstMonth, 12)
  const result = {
    asOf: today,
    total: records.length,
    activeCount: 0,
    recurringCount: 0,
    categoryCount: 0,
    currencies: [],
  }
  const categories = new Set(),
    buckets = new Map()
  for (const item of records) {
    validatePricing(item)
    if (!SUBSCRIPTION_CATEGORIES.includes(item.category) || !SUBSCRIPTION_STATUSES.includes(item.subscriptionStatus))
      throw new RangeError('订阅分类或状态无效')
    if (
      (item.startDate != null && !isDate(item.startDate)) ||
      (item.nextBillingDate != null && !isDate(item.nextBillingDate))
    )
      throw new RangeError('订阅日期无效')
    if (item.startDate && item.nextBillingDate && item.nextBillingDate < item.startDate)
      throw new RangeError('下次扣费不能早于订阅开始日期')
    categories.add(item.category)
    if (!buckets.has(item.currency))
      buckets.set(item.currency, {
        currency: item.currency,
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
      })
    const bucket = buckets.get(item.currency)
    bucket.count++
    if (!bucket.categories.has(item.category))
      bucket.categories.set(item.category, { category: item.category, count: 0, annual: 0n })
    const category = bucket.categories.get(item.category)
    category.count++
    const active = item.subscriptionStatus === 'active' && (!item.startDate || item.startDate <= today)
    if (active) {
      result.activeCount++
      bucket.activeCount++
    }
    if (active && Object.hasOwn(annualFactors, item.billingCycle)) {
      result.recurringCount++
      bucket.recurringCount++
      const annual = BigInt(item.amount) * BigInt(annualFactors[item.billingCycle])
      bucket.annual += annual
      category.annual += annual
    }
    if (item.billingCycle === 'lifetime' || item.billingCycle === 'one-time') bucket.oneTime += BigInt(item.amount)
    const dates = occurrences(item, today, end)
    for (const date of dates) bucket.forecast[monthIndex(date) - monthIndex(firstMonth)].amount += BigInt(item.amount)
    const overdue =
      item.subscriptionStatus === 'active' &&
      !!cycleMonths[item.billingCycle] &&
      item.nextBillingDate &&
      item.nextBillingDate < today
    const date = overdue ? item.nextBillingDate : dates[0]
    if (date)
      bucket.upcoming.push({
        id: item.id,
        name: item.name,
        date,
        amount: item.amount,
        currency: item.currency,
        overdue: !!overdue,
      })
  }
  result.categoryCount = categories.size
  result.currencies = CURRENCIES.filter((currency) => buckets.has(currency)).map((currency) => {
    const bucket = buckets.get(currency)
    return {
      currency,
      count: bucket.count,
      activeCount: bucket.activeCount,
      recurringCount: bucket.recurringCount,
      annualAmount: safeNumber(bucket.annual),
      monthlyAmount: safeNumber((bucket.annual + 6n) / 12n),
      oneTimeAmount: safeNumber(bucket.oneTime),
      categories: [...bucket.categories.values()].map((category) => ({
        category: category.category,
        count: category.count,
        annualAmount: safeNumber(category.annual),
      })),
      forecast: bucket.forecast.map((point) => ({ month: point.month, amount: safeNumber(point.amount) })),
      upcoming: bucket.upcoming.sort(
        (a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)),
      ),
    }
  })
  return result
}

exports.CURRENCIES = CURRENCIES
exports.CURRENCY_DIGITS = CURRENCY_DIGITS
exports.SUBSCRIPTION_CATEGORIES = SUBSCRIPTION_CATEGORIES
exports.BILLING_CYCLES = BILLING_CYCLES
exports.SUBSCRIPTION_STATUSES = SUBSCRIPTION_STATUSES
exports.PUBLICATION_STATUSES = PUBLICATION_STATUSES
exports.MAX_AMOUNT = MAX_AMOUNT
exports.isDate = isDate
exports.todayDate = todayDate
exports.addMonths = addMonths
exports.parseAmount = parseAmount
exports.amountInput = amountInput
exports.formatAmount = formatAmount
exports.validatePricing = validatePricing
exports.validatePriceHistory = validatePriceHistory
exports.appendPriceHistory = appendPriceHistory
exports.statistics = statistics
