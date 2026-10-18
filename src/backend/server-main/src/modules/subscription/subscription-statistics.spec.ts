/** @file subscription-statistics.spec.ts @description 订阅服务的完整筛选、分币种预算与续费预测回归，持久层全部模拟 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { Currency, SubscriptionStatus } from '@tixxin/subscription-domain'
import { Subscription } from '../../entities/subscription.entity'
import { AdminSubscriptionQuery, SubscriptionQuery } from './subscription.dto'
import { SubscriptionService } from './subscription.service'

function record(id: number, values: Partial<Subscription> = {}) {
  return Object.assign(new Subscription(), {
    id,
    name: `云空间 ${id}`,
    amount: 100,
    currency: 'USD',
    billingCycle: 'monthly',
    category: 'cloud',
    status: 'published',
    startDate: null,
    nextBillingDate: null,
    ...values,
  })
}

function fixture(items: Subscription[] = []) {
  const em = {
    find: jest.fn().mockResolvedValue(items),
    findAndCount: jest.fn().mockResolvedValue([items.slice(0, 1), items.length]),
    flush: jest.fn(),
  }
  return { em, service: new SubscriptionService(em as unknown as EntityManager) }
}

describe('订阅统计与分币种查询', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-18T23:30:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('空结果返回明确的零统计，统计日期取 UTC 当日', async () => {
    const { service } = fixture()
    await expect(service.stats(new SubscriptionQuery())).resolves.toEqual({
      asOf: '2026-10-18',
      total: 0,
      activeCount: 0,
      recurringCount: 0,
      categoryCount: 0,
      currencies: [],
    })
  })

  it('列表与统计共用完整过滤及搜索转义，统计读取全部匹配记录且忽略分页排序', async () => {
    const { em, service } = fixture([record(1), record(2), record(3)])
    const query = Object.assign(new SubscriptionQuery(), {
      q: String.raw`云%_\盘`,
      category: 'cloud',
      currency: 'USD',
      subscriptionStatus: 'active',
      page: 2,
      pageSize: 1,
      sort: 'amount-desc',
    })
    const where = {
      status: 'published',
      deletedAt: null,
      category: 'cloud',
      currency: 'USD',
      subscriptionStatus: 'active',
      $or: [
        { name: { $ilike: String.raw`%云\%\_\\盘%` } },
        { description: { $ilike: String.raw`%云\%\_\\盘%` } },
        { platform: { $ilike: String.raw`%云\%\_\\盘%` } },
      ],
    }

    const list = await service.list(query)
    const stats = await service.stats(query)

    expect(em.findAndCount).toHaveBeenCalledWith(Subscription, where, {
      populate: ['iconMedia'],
      orderBy: { currency: 'ASC', amount: 'DESC', id: 'DESC' },
      limit: 1,
      offset: 1,
    })
    expect(em.find).toHaveBeenCalledTimes(1)
    expect(em.find).toHaveBeenCalledWith(Subscription, where)
    expect(list).toMatchObject({ items: [expect.objectContaining({ id: 1 })], total: 3, page: 2, pageSize: 1 })
    expect(stats).toMatchObject({
      total: 3,
      currencies: [{ currency: 'USD', count: 3, annualAmount: 3600, monthlyAmount: 300 }],
    })
  })

  it.each([
    ['amount-asc', { currency: 'ASC', amount: 'ASC', id: 'DESC' }],
    ['amount-desc', { currency: 'ASC', amount: 'DESC', id: 'DESC' }],
    ['name', { name: 'ASC', id: 'DESC' }],
    ['manual', { sortOrder: 'DESC', id: 'DESC' }],
    [undefined, { sortOrder: 'DESC', id: 'DESC' }],
  ] as const)('排序 %s 保留稳定次序，金额排序先按币种分组', async (sort, orderBy) => {
    const { em, service } = fixture()
    await service.list(Object.assign(new SubscriptionQuery(), { sort }))
    expect(em.findAndCount).toHaveBeenCalledWith(
      Subscription,
      { status: 'published', deletedAt: null },
      { populate: ['iconMedia'], orderBy, limit: 12, offset: 0 },
    )
  })

  it.each(['all', 'draft', 'published', 'withdrawn'] as const)(
    '管理列表状态 %s 不改变公开统计的发布与软删除边界',
    async (status) => {
      const { em, service } = fixture()
      const query = Object.assign(new AdminSubscriptionQuery(), { status, currency: 'JPY' })
      await service.list(query, true)
      await service.stats(query)
      expect(em.findAndCount).toHaveBeenCalledWith(
        Subscription,
        { deletedAt: null, currency: 'JPY', ...(status === 'all' ? {} : { status }) },
        expect.any(Object),
      )
      expect(em.find).toHaveBeenCalledWith(Subscription, { status: 'published', deletedAt: null, currency: 'JPY' })
    },
  )

  it('七币种分别保留整数最小单位，JPY 不乘除 100，也不生成跨币种金额总计', async () => {
    const currencies: Currency[] = ['TWD', 'JPY', 'USD', 'HKD', 'GBP', 'EUR', 'CNY']
    const amounts: Record<Currency, number> = { CNY: 101, USD: 202, EUR: 303, GBP: 404, JPY: 505, HKD: 606, TWD: 707 }
    const { service } = fixture(
      currencies.map((currency, index) => record(index + 1, { currency, amount: amounts[currency] })),
    )
    const result = await service.stats(new SubscriptionQuery())

    expect(result).toMatchObject({ total: 7, activeCount: 7, recurringCount: 7, categoryCount: 1 })
    expect(result.currencies.map((bucket) => bucket.currency)).toEqual([
      'CNY',
      'USD',
      'EUR',
      'GBP',
      'JPY',
      'HKD',
      'TWD',
    ])
    for (const bucket of result.currencies) {
      expect(bucket).toMatchObject({
        count: 1,
        activeCount: 1,
        recurringCount: 1,
        annualAmount: amounts[bucket.currency] * 12,
        monthlyAmount: amounts[bucket.currency],
        oneTimeAmount: 0,
        categories: [{ category: 'cloud', count: 1, annualAmount: amounts[bucket.currency] * 12 }],
        upcoming: [],
      })
      expect(bucket.forecast).toHaveLength(12)
      expect(bucket.forecast.every((point) => point.amount === 0)).toBe(true)
    }
    expect(result).not.toHaveProperty('annualAmount')
    expect(result).not.toHaveProperty('monthlyAmount')
    expect(result).not.toHaveProperty('oneTimeAmount')
  })

  it('月付、季付、年付折算到同一币种年预算，并按分类聚合', async () => {
    const { service } = fixture([
      record(1, { amount: 101 }),
      record(2, { amount: 100, billingCycle: 'quarterly' }),
      record(3, { amount: 1001, billingCycle: 'yearly', category: 'development' }),
    ])
    const result = await service.stats(new SubscriptionQuery())
    expect(result).toMatchObject({
      total: 3,
      activeCount: 3,
      recurringCount: 3,
      categoryCount: 2,
      currencies: [
        {
          currency: 'USD',
          count: 3,
          annualAmount: 2613,
          monthlyAmount: 218,
          categories: [
            { category: 'cloud', count: 2, annualAmount: 1612 },
            { category: 'development', count: 1, annualAmount: 1001 },
          ],
        },
      ],
    })
  })

  it('月均金额在汇总后统一四舍五入，避免逐笔舍入丢失小额年付', async () => {
    const { service } = fixture([1, 2, 3].map((id) => record(id, { amount: 2, billingCycle: 'yearly' })))
    const result = await service.stats(new SubscriptionQuery())
    expect(result.currencies[0]).toMatchObject({ annualAmount: 6, monthlyAmount: 1 })
  })

  it('多笔最大合法金额聚合不按数据库单笔上限截断', async () => {
    const { service } = fixture([record(1, { amount: 2147483647 }), record(2, { amount: 2147483647 })])
    const result = await service.stats(new SubscriptionQuery())
    expect(result.currencies[0]).toMatchObject({ annualAmount: 51539607528, monthlyAmount: 4294967294 })
  })

  it.each<SubscriptionStatus>(['paused', 'cancelled', 'trial', 'expired'])(
    '%s 仍计入记录与分类数量，但不计入持续预算、预测或待扣费',
    async (subscriptionStatus) => {
      const { service } = fixture([
        record(1, { subscriptionStatus, startDate: '2026-01-01', nextBillingDate: '2026-10-20' }),
      ])
      const result = await service.stats(new SubscriptionQuery())
      expect(result).toMatchObject({ total: 1, activeCount: 0, recurringCount: 0, categoryCount: 1 })
      expect(result.currencies[0]).toMatchObject({
        count: 1,
        activeCount: 0,
        recurringCount: 0,
        annualAmount: 0,
        monthlyAmount: 0,
        categories: [{ category: 'cloud', count: 1, annualAmount: 0 }],
        upcoming: [],
      })
      expect(result.currencies[0]!.forecast.every((point) => point.amount === 0)).toBe(true)
    },
  )

  it.each(['lifetime', 'one-time'] as const)('%s 只计一次性金额，不重复产生预算或续费', async (billingCycle) => {
    const { service } = fixture([record(1, { billingCycle, nextBillingDate: '2026-10-20' })])
    const result = await service.stats(new SubscriptionQuery())
    expect(result).toMatchObject({ activeCount: 1, recurringCount: 0 })
    expect(result.currencies[0]).toMatchObject({ annualAmount: 0, monthlyAmount: 0, oneTimeAmount: 100, upcoming: [] })
    expect(result.currencies[0]!.forecast.every((point) => point.amount === 0)).toBe(true)
  })

  it('未来开始的活跃订阅只进入未来预测，开始当天才进入当前预算', async () => {
    const { service } = fixture([record(1, { startDate: '2026-10-19', nextBillingDate: '2026-10-19' })])
    const beforeStart = await service.stats(new SubscriptionQuery())
    expect(beforeStart).toMatchObject({ activeCount: 0, recurringCount: 0 })
    expect(beforeStart.currencies[0]).toMatchObject({
      annualAmount: 0,
      monthlyAmount: 0,
      upcoming: [{ id: 1, name: '云空间 1', date: '2026-10-19', amount: 100, currency: 'USD', overdue: false }],
    })
    expect(beforeStart.currencies[0]!.forecast[0]).toEqual({ month: '2026-10', amount: 100 })

    jest.setSystemTime(new Date('2026-10-19T00:00:00.000Z'))
    const atStart = await service.stats(new SubscriptionQuery())
    expect(atStart).toMatchObject({ activeCount: 1, recurringCount: 1 })
    expect(atStart.currencies[0]).toMatchObject({ annualAmount: 1200, monthlyAmount: 100 })
  })

  it('预测保留月底锚点和逾期提示，读取不推进实体扣费日期或写库', async () => {
    const item = record(1, { startDate: '2026-08-31', nextBillingDate: '2026-09-30' })
    const previous = structuredClone(item)
    const { em, service } = fixture([item])
    const result = await service.stats(new SubscriptionQuery())

    expect(result.currencies[0]!.upcoming).toEqual([
      { id: 1, name: '云空间 1', date: '2026-09-30', amount: 100, currency: 'USD', overdue: true },
    ])
    expect(result.currencies[0]!.forecast).toHaveLength(12)
    expect(result.currencies[0]!.forecast[0]).toEqual({ month: '2026-10', amount: 100 })
    expect(result.currencies[0]!.forecast.at(-1)).toEqual({ month: '2027-09', amount: 100 })
    expect(item).toEqual(previous)
    expect(em.flush).not.toHaveBeenCalled()

    jest.setSystemTime(new Date('2026-10-31T00:00:00.000Z'))
    const monthEnd = await service.stats(new SubscriptionQuery())
    expect(monthEnd.currencies[0]!.forecast[0]).toEqual({ month: '2026-10', amount: 100 })
    expect(item.nextBillingDate).toBe('2026-09-30')
  })

  it('未知日期保持未知，仍可汇总价格但不编造预测和下次扣费', async () => {
    const item = record(1, { startDate: undefined, nextBillingDate: undefined })
    const { em, service } = fixture([item])
    const result = await service.stats(new SubscriptionQuery())
    expect(result).toMatchObject({ total: 1, activeCount: 1, recurringCount: 1 })
    expect(result.currencies[0]).toMatchObject({ annualAmount: 1200, monthlyAmount: 100, upcoming: [] })
    expect(result.currencies[0]!.forecast.every((point) => point.amount === 0)).toBe(true)
    expect(item.startDate).toBeUndefined()
    expect(item.nextBillingDate).toBeUndefined()
    expect(em.flush).not.toHaveBeenCalled()
  })

  it('查询失败原样上抛，不伪造空列表或零统计', async () => {
    const { em, service } = fixture()
    const error = new Error('读取订阅失败')
    em.find.mockRejectedValue(error)
    em.findAndCount.mockRejectedValue(error)
    await expect(service.stats(new SubscriptionQuery())).rejects.toBe(error)
    await expect(service.list(new SubscriptionQuery())).rejects.toBe(error)
  })
})
