/** @file domain.test.cjs @description 订阅金额、锚点预测与不可改写历史的真实领域验收 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const {
  parseAmount,
  amountInput,
  formatAmount,
  addMonths,
  isDate,
  statistics,
  appendPriceHistory,
  validatePriceHistory,
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
  ...overrides,
})
const options = (time) => ({ id: randomUUID(), recordedAt: time })

test('最小单位严格解析，不通过浮点数计算金额', () => {
  assert.equal(parseAmount('20.01', 'USD'), 2001)
  assert.equal(parseAmount('0.29', 'USD'), 29)
  assert.equal(parseAmount('1000', 'JPY'), 1000)
  assert.equal(parseAmount('0', 'CNY'), 0)
  assert.equal(parseAmount('21474836.47', 'USD'), 2147483647)
  for (const raw of ['', '.1', '1.', '-1', '+1', 'NaN', 'Infinity', '1e2', '0.001', '1,000', '21474836.48'])
    assert.throws(() => parseAmount(raw, 'USD'), RangeError, raw)
  assert.throws(() => parseAmount('1000.0', 'JPY'))
  assert.throws(() => parseAmount('1', '__proto__'))
  assert.equal(amountInput(29, 'USD'), '0.29')
  assert.equal(formatAmount(1000, 'JPY'), 'JPY 1,000')
  assert.equal(formatAmount(2001, 'USD'), 'USD 20.01')
})
test('金额按币种分组，年化精确累加后才计算月均', () => {
  const stats = statistics(
    [
      item(),
      item({ id: 'annual', amount: 28900, billingCycle: 'yearly' }),
      item({ id: 'cny', currency: 'CNY', amount: 10000, billingCycle: 'quarterly' }),
      item({ id: 'jpy', currency: 'JPY', amount: 1000 }),
    ],
    '2026-10-13',
  )
  assert.equal(stats.currencies.find((v) => v.currency === 'USD').annualAmount, 52900)
  assert.equal(stats.currencies.find((v) => v.currency === 'CNY').annualAmount, 40000)
  assert.equal(stats.currencies.find((v) => v.currency === 'CNY').monthlyAmount, 3333)
  assert.equal(stats.currencies.find((v) => v.currency === 'JPY').annualAmount, 12000)
  assert.equal(stats.total, 4)
  assert.equal('annualAmount' in stats, false, '不能生成跨币种总额')
  const tiny = statistics(
    Array.from({ length: 12 }, (_, id) => item({ id, amount: 1, billingCycle: 'yearly' })),
    '2026-10-13',
  )
  assert.equal(tiny.currencies[0].monthlyAmount, 1, '12 条年付 0.01 的月均合计是 0.01')
})
test('双状态、未来开始和一次性金额不伪造当前持续费用', () => {
  const records = ['paused', 'cancelled', 'trial', 'expired'].map((subscriptionStatus) =>
    item({ subscriptionStatus, nextBillingDate: '2026-10-20' }),
  )
  records.push(
    item({ startDate: '2026-11-01' }),
    item({ billingCycle: 'lifetime' }),
    item({ billingCycle: 'one-time' }),
  )
  const stats = statistics(records, '2026-10-13'),
    usd = stats.currencies[0]
  assert.equal(stats.activeCount, 2)
  assert.equal(stats.recurringCount, 0)
  assert.equal(usd.annualAmount, 0)
  assert.equal(usd.oneTimeAmount, 4000)
  assert.equal(usd.forecast[0].amount, 0)
  assert.equal(usd.forecast[1].amount, 2000, '未来开始的活跃记录仅进入未来预测')
  assert.equal(usd.upcoming.length, 1)
})
test('日期拒绝不存在的日历日，固定锚点经过短月和闰年仍保留', () => {
  assert.equal(isDate('2026-02-29'), false)
  assert.equal(isDate('2024-02-29'), true)
  assert.equal(isDate('2026-04-31'), false)
  assert.equal(isDate('2026-1-01'), false)
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2026-01-31', 2), '2026-03-31')
  assert.equal(addMonths('2024-02-29', 12), '2025-02-28')
  assert.equal(addMonths('2024-02-29', 48), '2028-02-29')
  const row = item({ startDate: '2026-01-31', nextBillingDate: '2026-02-28' })
  const stats = statistics([row], '2026-02-01').currencies[0]
  assert.equal(stats.upcoming[0].date, '2026-02-28')
  assert.equal(statistics([row], '2026-03-01').currencies[0].upcoming[0].overdue, true)
  assert.equal(row.nextBillingDate, '2026-02-28', '预测不回写到原记录')
  assert.equal(statistics([row], '2026-03-30').currencies[0].forecast[0].amount, 2000, '3 月 31 日仍在未来')
})
test('缺少日期不猜测付款，周期与状态边界明确', () => {
  const stats = statistics(
    [item(), item({ billingCycle: 'yearly', startDate: '2024-02-29', nextBillingDate: '2025-02-28' })],
    '2027-03-01',
  ).currencies[0]
  assert.equal(stats.upcoming.length, 1)
  assert.equal(stats.forecast.at(-1).month, '2028-02')
  assert.equal(stats.forecast.at(-1).amount, 2000)
  assert.throws(() => statistics([item({ startDate: '2026-10-20', nextBillingDate: '2026-10-19' })], '2026-10-13'))
  assert.deepEqual(statistics([], '2026-10-13').currencies, [])
})
test('价格历史保存新快照，同一天可多次变价，非价格编辑不追加', () => {
  const current = item()
  const initial = appendPriceHistory([], current, options('2026-10-13T10:00:00.000Z'))
  assert.equal(initial.length, 1)
  assert.equal(initial[0].effectiveAt, '2026-10-13T10:00:00.000Z')
  const unchanged = appendPriceHistory(initial, { ...current, name: '新名称' }, options('2026-10-13T11:00:00.000Z'))
  assert.deepEqual(unchanged, initial)
  const next = { ...current, amount: 2500 }
  const changed = appendPriceHistory(initial, next, { ...options('2026-10-13T11:00:00.000Z'), reason: ' 调整方案 ' })
  assert.equal(changed[1].amount, 2500)
  assert.equal(changed[1].reason, '调整方案')
  assert.equal(initial.length, 1, '不会修改传入历史')
  assert.deepEqual(appendPriceHistory(changed, next, options('2026-10-13T12:00:00.000Z')), changed)
  const currencyChange = appendPriceHistory(changed, { ...next, currency: 'CNY' }, options('2026-10-13T12:00:00.000Z'))
  assert.equal(currencyChange.length, 3)
  assert.equal(currencyChange[2].currency, 'CNY')
})
test('导入拒绝倒序、重复ID、未知字段与末条价格不一致', () => {
  const initial = appendPriceHistory([], item(), options('2026-10-13T10:00:00.000Z'))
  assert.throws(() => validatePriceHistory(initial, item({ amount: 2100 })))
  assert.throws(() => validatePriceHistory([{ ...initial[0], hidden: true }]))
  assert.throws(() => validatePriceHistory([{ ...initial[0], effectiveAt: '2026-10-14T10:00:00.000Z' }]))
  assert.throws(() => validatePriceHistory([...initial, { ...initial[0], amount: 2100 }]))
  assert.throws(() => appendPriceHistory(initial, item({ amount: 2100 }), options('2026-10-12T10:00:00.000Z')))
  assert.throws(() => validatePriceHistory([]))
  assert.equal(validatePriceHistory([{ ...initial[0], effectiveAt: '2026-10-12T10:00:00.000Z' }]).length, 1)
})

test('未来历史不能进入导入或本地记录，时间回拨不会追加倒序快照', () => {
  const future = {
    id: randomUUID(),
    amount: 2000,
    currency: 'USD',
    billingCycle: 'monthly',
    effectiveAt: '9999-01-01T00:00:00.000Z',
    recordedAt: '9999-01-01T00:00:00.000Z',
  }
  assert.throws(() => validatePriceHistory([future], item()), /时间无效/)
  const initial = appendPriceHistory([], item(), options('2026-10-12T10:00:00.000Z'))
  assert.throws(() => validatePriceHistory(initial, item(), '2026-10-12T09:59:00.000Z'), /时间无效/)
  assert.throws(() => appendPriceHistory(initial, item({ amount: 2500 }), options('2026-10-12T09:59:00.000Z')), /顺序/)
  assert.equal(initial.length, 1)
})
