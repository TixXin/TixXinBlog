/** @file subscription-values.spec.ts @description 金额、日期、管理白名单和官网输入边界 */
import 'reflect-metadata'
import { BadRequestException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { AdminSubscriptionQuery, SaveSubscriptionDto, SubscriptionQuery, SubscriptionSortDto } from './subscription.dto'
import {
  faviconDomain,
  subscriptionId,
  subscriptionUrl,
  subscriptionValues,
  validateSubscriptionDates,
} from './subscription-values'
const validationOptions = { whitelist: true, forbidNonWhitelisted: true }
const valid = (value: object) => validateSync(plainToInstance(SaveSubscriptionDto, value), validationOptions)
describe('订阅数据边界', () => {
  it.each(['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'TWD'])('%s以整数最小单位保存，边界不发生缩放', (currency) => {
    for (const amount of [0, 1, 2147483647]) {
      const dto = plainToInstance(SaveSubscriptionDto, { currency, amount })
      expect(validateSync(dto, validationOptions)).toEqual([])
      expect(subscriptionValues(dto)).toEqual({ currency, amount })
    }
    for (const amount of [-1, 0.01, 2147483648, Number.MAX_SAFE_INTEGER, NaN, -Infinity, '100', true])
      expect(valid({ currency, amount }).map((error) => error.property)).toContain('amount')
  })
  describe.each([SubscriptionQuery, AdminSubscriptionQuery])('%s币种筛选', (Query) => {
    it.each(['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'TWD'])('接受%s并保留默认分页', (currency) => {
      const query = plainToInstance(Query, { currency })
      expect(validateSync(query, validationOptions)).toEqual([])
      expect(query).toMatchObject({ currency, page: 1, pageSize: 12 })
    })
    it.each(['BTC', 'usd', ' USD ', '', null, 123, ['USD'], '__proto__'])('拒绝非法币种%p', (currency) => {
      expect(valid({ currency }).map((error) => error.property)).toContain('currency')
      expect(
        validateSync(plainToInstance(Query, { currency }), validationOptions).map((error) => error.property),
      ).toContain('currency')
    })
    it('省略币种不会偷偷写入筛选条件', () => {
      const query = plainToInstance(Query, {})
      expect(validateSync(query, validationOptions)).toEqual([])
      expect(query.currency).toBeUndefined()
    })
  })
  it.each(['all', 'draft', 'published', 'withdrawn'])('发布状态%s仅允许用于管理查询', (status) => {
    expect(validateSync(plainToInstance(AdminSubscriptionQuery, { status }), validationOptions)).toEqual([])
    expect(
      validateSync(plainToInstance(SubscriptionQuery, { status }), validationOptions).map((error) => error.property),
    ).toEqual(['status'])
  })
  it('查询分页转换数字字符串、保留合法上限并修剪关键词', () => {
    const query = plainToInstance(AdminSubscriptionQuery, {
      page: '10000',
      pageSize: '48',
      q: '  云端工具  ',
      currency: 'JPY',
      subscriptionStatus: 'paused',
      status: 'published',
      sort: 'amount-desc',
    })
    expect(validateSync(query, validationOptions)).toEqual([])
    expect(query).toMatchObject({ page: 10000, pageSize: 48, q: '云端工具', currency: 'JPY' })
  })
  it.each([
    { page: '10001' },
    { page: '1.5' },
    { pageSize: '0' },
    { q: '字'.repeat(201) },
    { status: 'active' },
    { subscriptionStatus: 'published' },
    { currency: 'all' },
    { notes: '私密筛选' },
  ])('管理查询拒绝越界、混淆的双状态或未知字段%p', (input) => {
    expect(validateSync(plainToInstance(AdminSubscriptionQuery, input), validationOptions)).not.toHaveLength(0)
  })
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
  it('编辑值移除提交控制字段、保留显式清空且不改写原输入', () => {
    const input = {
      requestId: '7f42ef84-e693-4bbc-8026-bddfa8337c60',
      revision: 3,
      priceChangeReason: '调整方案',
      name: undefined,
      description: '',
      platform: '  云端服务  ',
      url: 'https://EXAMPLE.COM:443',
      amount: 0,
      startDate: null,
      nextBillingDate: null,
      iconMediaId: null,
    }
    const original = { ...input }
    expect(subscriptionValues(input)).toEqual({
      description: '',
      platform: '云端服务',
      url: 'https://example.com/',
      amount: 0,
      startDate: null,
      nextBillingDate: null,
      iconMediaId: null,
    })
    expect(input).toEqual(original)
    expect(subscriptionValues({ platform: '   ', url: '' })).toEqual({ platform: null, url: null })
    expect(subscriptionValues({ platform: null, url: null })).toEqual({ platform: null, url: null })
  })
  it.each([1, 2147483647])('接受持久化编号边界%d', (id) => {
    expect(() => subscriptionId(id)).not.toThrow()
  })
  it.each([0, -1, 1.1, 2147483648, NaN, Infinity])('拒绝非法编号%p', (id) => {
    expect(() => subscriptionId(id)).toThrow(BadRequestException)
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
  it.each(['startDate', 'nextBillingDate'] as const)('%s统一校验日历真实性且允许未知日期', (field) => {
    for (const date of ['0000-01-01', '1900-02-29', '2026-04-31', '', '2026-00-01', '2026-01-00'])
      expect(() => validateSubscriptionDates({ [field]: date })).toThrow(BadRequestException)
    for (const date of ['0001-01-01', '2000-02-29', '9999-12-31', null, undefined])
      expect(() => validateSubscriptionDates({ [field]: date })).not.toThrow()
  })
  it('同日开始和续费合法，编辑值不能绕过业务日期校验', () => {
    expect(() => validateSubscriptionDates({ startDate: '2026-10-18', nextBillingDate: '2026-10-18' })).not.toThrow()
    expect(() => subscriptionValues({ nextBillingDate: '2026-02-30' })).toThrow(BadRequestException)
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
  it('官网统一主机大小写、默认端口与国际化域名', () => {
    expect(subscriptionUrl('HTTP://Example.COM:80')).toBe('http://example.com/')
    expect(subscriptionUrl('https://Example.COM:443/a?q=1#part')).toBe('https://example.com/a?q=1#part')
    expect(faviconDomain('https://例子.中国/path')).toBe('xn--fsqu00a.xn--fiqs8s')
  })
  it('官网同时限制原始长度和规范化后长度', () => {
    const prefix = 'https://github.com/'
    const boundary = prefix + 'a'.repeat(2048 - prefix.length)
    expect(subscriptionUrl(boundary)).toBe(boundary)
    expect(() => subscriptionUrl(boundary + 'a')).toThrow(BadRequestException)
    expect(() => subscriptionUrl(prefix + '字'.repeat(230))).toThrow(BadRequestException)
  })
  it.each(['https://github.com/\u0000', 'https://github.com/\u007f'])('官网拒绝不可见控制字符%p', (url) => {
    expect(() => subscriptionUrl(url)).toThrow(BadRequestException)
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
  it.each([
    'https://service.internal',
    'https://service.invalid',
    'https://service.test',
    'https://service.example',
    'https://service.onion',
    'https://sub.localhost',
    'https://intranet',
    'https://127.1',
    'https://0x7f000001',
    'https://[::ffff:127.0.0.1]',
    'https://bad_label.com',
    'https://-label.com',
    'https://label-.com',
    'https://two..labels.com',
    `https://${'a'.repeat(64)}.com`,
    `https://${['a'.repeat(63), 'b'.repeat(63), 'c'.repeat(63), 'd'.repeat(62)].join('.')}`,
  ])('自动图标拒绝保留后缀、数字地址和非法域名标签%s', (url) => {
    expect(() => faviconDomain(url)).toThrow(BadRequestException)
  })
  it('自动图标允许合法域名长度边界且不误伤相似后缀', () => {
    const domain = ['a'.repeat(63), 'b'.repeat(63), 'c'.repeat(63), 'd'.repeat(61)].join('.')
    expect(faviconDomain(`https://${domain}`)).toBe(domain)
    expect(faviconDomain('https://localization.com')).toBe('localization.com')
    expect(faviconDomain('https://test.github.com')).toBe('test.github.com')
  })
  it('分页有界且排序条目只接受白名单', () => {
    expect(validateSync(plainToInstance(SubscriptionQuery, { page: 0, pageSize: 49 }))).toHaveLength(2)
    expect(
      validateSync(plainToInstance(SubscriptionSortDto, { items: [{ id: 1, revision: -1, sortOrder: 0 }] })),
    ).not.toHaveLength(0)
  })
})
