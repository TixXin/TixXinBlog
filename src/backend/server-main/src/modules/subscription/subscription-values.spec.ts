/** @file subscription-values.spec.ts @description 金额、日期、管理白名单和官网输入边界 */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { SaveSubscriptionDto, SubscriptionQuery, SubscriptionSortDto } from './subscription.dto'
import { faviconDomain, subscriptionUrl, subscriptionValues, validateSubscriptionDates } from './subscription-values'
const valid = (value: object) =>
  validateSync(plainToInstance(SaveSubscriptionDto, value), { whitelist: true, forbidNonWhitelisted: true })
describe('订阅数据边界', () => {
  it.each([
    'name',
    'description',
    'category',
    'currency',
    'amount',
    'billingCycle',
    'subscriptionStatus',
    'notes',
    'status',
    'sortOrder',
    'revision',
    'requestId',
  ])('%s不能用null跳过校验', (field) => {
    expect(valid({ [field]: null })).not.toHaveLength(0)
  })
  it.each([
    { amount: -1 },
    { amount: 1.1 },
    { amount: 2147483648 },
    { amount: Infinity },
    { currency: 'BTC' },
    { billingCycle: 'weekly' },
    { subscriptionStatus: 'published' },
    { status: 'active' },
    { priceHistory: [] },
    { publishedAt: new Date().toISOString() },
    { requestHash: 'x' },
  ])('拒绝非法金额和系统字段 %p', (value) => {
    expect(valid(value)).not.toHaveLength(0)
  })
  it('允许0和可清空媒体/日期，但不隐式填入PATCH字段', () => {
    expect(valid({ amount: 0, iconMediaId: null, startDate: null, nextBillingDate: null, url: null })).toHaveLength(0)
    expect(subscriptionValues({ name: '已改名' })).toEqual({ name: '已改名' })
  })
  it.each(['2026-02-29', '2026-02-30', '2026-13-01', '26-01-01', '2026-1-01', '2026-01-01T00:00:00Z'])(
    '拒绝不存在或非日期字符串 %s',
    (date) => {
      expect(() => validateSubscriptionDates({ startDate: date })).toThrow()
    },
  )
  it('合并后的日期必须有合理先后关系', () => {
    expect(() => validateSubscriptionDates({ startDate: '2028-02-29', nextBillingDate: '2028-03-31' })).not.toThrow()
    expect(() => validateSubscriptionDates({ startDate: '2026-12-01', nextBillingDate: '2026-11-30' })).toThrow()
  })
  it.each([
    'javascript:alert(1)',
    'file:///tmp/a',
    '//github.com',
    'https://user:secret@github.com',
    'https://github.com:8443',
    'https://github.com/a b',
    'https://github.com/a\\b',
    'https://github.com\n',
  ])('拒绝危险官网 %s', (url) => {
    expect(() => subscriptionUrl(url)).toThrow()
  })
  it('favicon只提取域名，绝不向供应商发送路径查询或片段', () => {
    expect(faviconDomain('https://GitHub.com/private?secret=1#part')).toBe('github.com')
    expect(subscriptionUrl('https://github.com/a?b=1')).toBe('https://github.com/a?b=1')
  })
  it.each([
    'http://localhost',
    'https://127.0.0.1',
    'http://2130706433',
    'http://[::1]',
    'https://service.local',
    'https://example.com.',
  ])('自动图标拒绝非公网域名 %s', (url) => {
    expect(() => faviconDomain(url)).toThrow()
  })
  it('分页有界且排序条目只接受白名单', () => {
    expect(validateSync(plainToInstance(SubscriptionQuery, { page: 0, pageSize: 49 }))).toHaveLength(2)
    expect(
      validateSync(plainToInstance(SubscriptionSortDto, { items: [{ id: 1, revision: -1, sortOrder: 0 }] })),
    ).not.toHaveLength(0)
  })
})
