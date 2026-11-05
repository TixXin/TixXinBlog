/** @file schedule.test.cjs @description 多年周期、试用转正、结束日、公开推算、累计花费、涨价记录与参考汇率的领域验收 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  statistics,
  nextChargeDate,
  advanceBilling,
  isOverdue,
  charges,
  priceChanges,
  parseRate,
  validateRates,
  convertAmount,
  validateRecord,
} = require('../index.cjs')
const item = (overrides = {}) => ({
  id: 'one',
  name: '写作工具',
  category: 'productivity',
  currency: 'USD',
  amount: 2000,
  billingCycle: 'monthly',
  subscriptionStatus: 'active',
  startDate: null,
  nextBillingDate: null,
  trialEndDate: null,
  endDate: null,
  ...overrides,
})
const entry = (effectiveAt, amount, extra = {}) => ({
  id: crypto.randomUUID(),
  effectiveAt: `${effectiveAt}T00:00:00.000Z`,
  recordedAt: `${effectiveAt}T00:00:00.000Z`,
  amount,
  currency: 'USD',
  billingCycle: 'monthly',
  ...extra,
})

test('半年、两年、三年周期按 ×72 精确年化，月均在汇总后取整', () => {
  const stats = statistics(
    [
      item({ id: 'half', amount: 6000, billingCycle: 'semiannual' }),
      item({ id: 'two', amount: 2401, billingCycle: 'biennial' }),
      item({ id: 'three', amount: 3600, billingCycle: 'triennial' }),
    ],
    '2026-11-06',
  ).currencies[0]
  assert.equal(stats.recurringCount, 3)
  // 12000 + 1200.5 + 1200 = 14400.5 → 14401
  assert.equal(stats.annualAmount, 14401)
  assert.equal(stats.monthlyAmount, 1200)
})

test('两年付按锚点推算，预测窗口内只出现一次', () => {
  const row = item({ billingCycle: 'biennial', startDate: '2025-03-10', nextBillingDate: '2027-03-10' })
  const usd = statistics([row], '2026-11-06').currencies[0]
  assert.equal(usd.forecast.find((point) => point.month === '2027-03').amount, 2000)
  assert.equal(
    usd.forecast.reduce((sum, point) => sum + point.amount, 0),
    2000,
  )
  assert.equal(advanceBilling(row), '2029-03-10')
})

test('试用只在填写到期日时从到期日转正计费，不进入当前预算', () => {
  const trial = item({ subscriptionStatus: 'trial', startDate: '2026-11-01', trialEndDate: '2026-11-15' })
  const usd = statistics([trial, item({ id: 'unknown', subscriptionStatus: 'trial' })], '2026-11-06').currencies[0]
  assert.equal(usd.annualAmount, 0)
  assert.equal(usd.upcoming.length, 1)
  assert.deepEqual([usd.upcoming[0].date, usd.upcoming[0].trial, usd.upcoming[0].overdue], ['2026-11-15', true, false])
  assert.equal(usd.forecast[0].amount, 2000)
  assert.equal(usd.forecast[1].amount, 2000)
  assert.throws(() => validateRecord(item({ startDate: '2026-11-02', trialEndDate: '2026-11-01' })), /试用/)
})

test('结束日当天及之后不再扣费，已结束的活跃记录不计入预算', () => {
  const ending = item({ startDate: '2026-01-05', nextBillingDate: '2026-12-05', endDate: '2027-02-05' })
  const usd = statistics([ending], '2026-11-06').currencies[0]
  assert.deepEqual(
    usd.forecast.filter((point) => point.amount).map((point) => point.month),
    ['2026-12', '2027-01'],
  )
  assert.equal(statistics([ending], '2027-02-05').currencies[0].annualAmount, 0)
  assert.throws(() => validateRecord(item({ startDate: '2026-02-01', endDate: '2026-01-31' })), /结束日期/)
})

test('公开展示推算下一次扣费，不把未更新的日期当成逾期', () => {
  const stale = item({ startDate: '2026-01-31', nextBillingDate: '2026-08-31' })
  assert.equal(isOverdue(stale, '2026-11-06'), true)
  const owner = statistics([stale], '2026-11-06').currencies[0].upcoming[0]
  assert.deepEqual([owner.date, owner.overdue], ['2026-08-31', true])
  const visitor = statistics([stale], '2026-11-06', { rollForward: true }).currencies[0].upcoming[0]
  assert.deepEqual([visitor.date, visitor.overdue], ['2026-11-30', false])
  assert.equal(nextChargeDate(stale, '2026-11-06'), '2026-11-30')
  assert.equal(advanceBilling(stale), '2026-09-30', '推进保留月底锚点')
  assert.equal(isOverdue({ ...stale, endDate: '2026-08-31' }, '2026-11-06'), false, '服务已在那之前结束')
})

test('累计花费按价格历史分段取当期价格，截至今天', () => {
  const row = item({
    startDate: '2026-01-10',
    amount: 2500,
    priceHistory: [entry('2026-01-01', 2000), entry('2026-04-01', 2500, { reason: '涨价' })],
  })
  const list = charges(row, '2026-06-10')
  assert.deepEqual(
    list.map((charge) => [charge.date, charge.amount]),
    [
      ['2026-01-10', 2000],
      ['2026-02-10', 2000],
      ['2026-03-10', 2000],
      ['2026-04-10', 2500],
      ['2026-05-10', 2500],
      ['2026-06-10', 2500],
    ],
  )
  const spending = statistics([row], '2026-06-10').spending[0]
  assert.deepEqual([spending.amount, spending.unknownCount], [13500, 0])
  assert.deepEqual(spending.years, [{ year: 2026, amount: 13500 }])
  assert.deepEqual(
    priceChanges(row).map((change) => [change.fromAmount, change.toAmount, change.reason]),
    [[2000, 2500, '涨价']],
  )
})

test('取消记录截至结束日，缺日期的周期记录计为无法估算，一次性只算一次', () => {
  const cancelled = item({ subscriptionStatus: 'cancelled', startDate: '2025-11-20', endDate: '2026-02-20' })
  assert.equal(charges(cancelled, '2026-11-06').length, 3)
  assert.equal(charges(item({ subscriptionStatus: 'paused', startDate: '2026-01-01' }), '2026-11-06'), null)
  const once = item({
    billingCycle: 'lifetime',
    startDate: '2025-05-01',
    amount: 9900,
    priceHistory: [
      entry('2025-05-01', 9900, { billingCycle: 'lifetime' }),
      entry('2026-01-01', 12900, { billingCycle: 'lifetime' }),
    ],
  })
  assert.deepEqual(
    charges(once, '2026-11-06').map((charge) => charge.amount),
    [9900],
    '改价不是再次购买',
  )
  const stats = statistics([cancelled, item({ id: 'nodate' }), once], '2026-11-06')
  assert.equal(stats.spending[0].unknownCount, 1)
  assert.deepEqual(stats.spending[0].years, [
    { year: 2025, amount: 9900 + 4000 },
    { year: 2026, amount: 2000 },
  ])
  const trial = item({ subscriptionStatus: 'trial', startDate: '2026-11-01', trialEndDate: '2026-11-15' })
  assert.deepEqual(charges(trial, '2026-11-06'), [], '试用期内没有花费')
})

test('参考汇率严格校验并四舍五入换算到基准币种最小单位', () => {
  assert.equal(parseRate('7.1'), 710000000n)
  for (const raw of ['0', '-1', '1e2', '7.123456789', '', ' 7', '07']) assert.throws(() => parseRate(raw), raw)
  const config = validateRates({ base: 'CNY', rates: { USD: '7.1', JPY: '0.0465' } })
  assert.equal(convertAmount(2000, 'USD', config), 14200)
  assert.equal(convertAmount(1000, 'JPY', config), 4650)
  assert.equal(convertAmount(1234, 'CNY', config), 1234)
  assert.equal(convertAmount(100, 'EUR', config), null)
  assert.equal(convertAmount(100, 'USD', null), null)
  assert.throws(() => validateRates({ base: 'CNY', rates: { CNY: '1' } }))
  assert.throws(() => validateRates({ base: 'XXX', rates: {} }))
})
