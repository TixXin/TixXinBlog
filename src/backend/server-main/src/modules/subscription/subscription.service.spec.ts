/** @file subscription.service.spec.ts @description 公开边界、部分编辑、价格历史及版本冲突的服务回归 */
import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { appendPriceHistory } from '@tixxin/subscription-domain'
import { Subscription } from '../../entities/subscription.entity'
import { SubscriptionService } from './subscription.service'
import { SubscriptionQuery } from './subscription.dto'
function fixture() {
  const item = Object.assign(new Subscription(), {
    id: 1,
    name: '云空间',
    amount: 2000,
    currency: 'USD',
    billingCycle: 'monthly',
    notes: '私密备注',
    status: 'published',
    startDate: '2026-01-01',
    nextBillingDate: '2026-11-01',
    revision: 2,
  })
  item.priceHistory = appendPriceHistory([], item, { id: randomUUID(), recordedAt: '2026-10-01T00:00:00.000Z' })
  const em = {
    findOne: jest.fn().mockResolvedValue(item),
    find: jest.fn().mockResolvedValue([item]),
    findAndCount: jest.fn().mockResolvedValue([[item], 1]),
    execute: jest.fn(),
    flush: jest.fn(),
    nativeDelete: jest.fn(),
    transactional: jest.fn(),
  }
  em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
  const service = new SubscriptionService(em as unknown as EntityManager)
  return { item, em, service }
}
describe('订阅服务契约', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-18T12:00:00.000Z'))
  })
  afterEach(() => {
    jest.useRealTimers()
  })
  it('公开响应明确排除管理备注、创建凭据和版本', () => {
    const { item, service } = fixture()
    item.requestId = randomUUID()
    item.requestHash = 'private-hash'
    const result = service.serialize(item)
    expect(result).not.toHaveProperty('notes')
    expect(result).not.toHaveProperty('requestId')
    expect(result).not.toHaveProperty('requestHash')
    expect(result).not.toHaveProperty('revision')
    expect(service.serialize(item, true)).toHaveProperty('notes', '私密备注')
  })
  it('公开列表详情和统计都限定公开未删除，统计不传limit', async () => {
    const { em, service } = fixture()
    await service.list(Object.assign(new SubscriptionQuery(), { category: 'cloud', pageSize: 1 }))
    expect(em.findAndCount.mock.calls[0]?.[1]).toEqual({ status: 'published', deletedAt: null, category: 'cloud' })
    await service.detail(1)
    expect(em.findOne.mock.calls[0]?.[1]).toEqual({ id: 1, status: 'published', deletedAt: null })
    await service.stats(Object.assign(new SubscriptionQuery(), { currency: 'USD', pageSize: 1 }))
    expect(em.find).toHaveBeenCalledWith(Subscription, { status: 'published', deletedAt: null, currency: 'USD' })
  })
  it('PATCH只编辑名称时保留其余字段，不新增价格快照', async () => {
    const { item, service } = fixture()
    const original = structuredClone(item.priceHistory)
    await service.save(1, { revision: 2, name: '云空间升级说明' })
    expect(item.amount).toBe(2000)
    expect(item.notes).toBe('私密备注')
    expect(item.priceHistory).toEqual(original)
    expect(item.revision).toBe(3)
  })
  it('变价追加新价格而不重写初始记录', async () => {
    const { item, service } = fixture()
    const original = structuredClone(item.priceHistory[0])
    await service.save(1, { revision: 2, amount: 2500, priceChangeReason: '套餐升级' })
    expect(item.priceHistory).toHaveLength(2)
    expect(item.priceHistory[0]).toEqual(original)
    expect(item.priceHistory[1]).toEqual(
      expect.objectContaining({ amount: 2500, currency: 'USD', billingCycle: 'monthly', reason: '套餐升级' }),
    )
  })
  it.each(['CNY', 'EUR', 'GBP', 'JPY', 'HKD', 'TWD'] as const)(
    '只把币种改成 %s 也追加价格事件，保留原整数金额与旧历史',
    async (currency) => {
      const { item, service } = fixture()
      const previous = structuredClone(item.priceHistory[0])
      const result = await service.save(1, { revision: 2, currency, priceChangeReason: '  更换结算币种  ' })

      expect(result).toMatchObject({ amount: 2000, currency, billingCycle: 'monthly', revision: 3 })
      expect(item.priceHistory).toHaveLength(2)
      expect(item.priceHistory[0]).toEqual(previous)
      expect(item.priceHistory[1]).toEqual({
        id: expect.any(String),
        amount: 2000,
        currency,
        billingCycle: 'monthly',
        effectiveAt: '2026-10-18T12:00:00.000Z',
        recordedAt: '2026-10-18T12:00:00.000Z',
        reason: '更换结算币种',
      })
      expect(item.priceHistory[1]!.id).not.toBe(previous!.id)
    },
  )
  it.each(['quarterly', 'yearly', 'lifetime', 'one-time'] as const)(
    '只把周期改成 %s 也追加历史，金额保持最小单位',
    async (billingCycle) => {
      const { item, service } = fixture()
      const previous = structuredClone(item.priceHistory[0])
      await service.save(1, { revision: 2, billingCycle })
      expect(item.priceHistory).toHaveLength(2)
      expect(item.priceHistory[0]).toEqual(previous)
      expect(item.priceHistory[1]).toMatchObject({ amount: 2000, currency: 'USD', billingCycle })
      expect(item.priceHistory[1]).not.toHaveProperty('reason')
    },
  )
  it('金额、币种和周期同时变更只追加一个完整事件，允许零金额', async () => {
    const { item, service } = fixture()
    const previous = structuredClone(item.priceHistory[0])
    await service.save(1, { revision: 2, amount: 0, currency: 'JPY', billingCycle: 'yearly' })
    expect(item.priceHistory).toHaveLength(2)
    expect(item.priceHistory[0]).toEqual(previous)
    expect(item.priceHistory[1]).toMatchObject({ amount: 0, currency: 'JPY', billingCycle: 'yearly' })
    expect(item).toMatchObject({ amount: 0, currency: 'JPY', billingCycle: 'yearly', revision: 3 })
  })
  it('显式提交相同价格与币种周期不会因变价说明重复追加历史', async () => {
    const { item, service } = fixture()
    const previous = structuredClone(item.priceHistory)
    await service.save(1, {
      revision: 2,
      amount: 2000,
      currency: 'USD',
      billingCycle: 'monthly',
      priceChangeReason: '仅补充说明',
    })
    expect(item.priceHistory).toEqual(previous)
    expect(item.revision).toBe(3)
  })
  it('过期版本在修改记录与历史前拒绝', async () => {
    const { item, em, service } = fixture()
    await expect(service.save(1, { revision: 1, amount: 9999 })).rejects.toThrow('已被修改')
    expect(item.amount).toBe(2000)
    expect(item.priceHistory).toHaveLength(1)
    expect(em.flush).not.toHaveBeenCalled()
  })
  it('时钟回拨返回明确冲突，价格、历史、字段和版本都不产生部分修改', async () => {
    const { item, em, service } = fixture()
    const previous = structuredClone(item.priceHistory)
    jest.useFakeTimers().setSystemTime(new Date('2026-09-30T00:00:00.000Z'))
    try {
      await expect(service.save(1, { revision: 2, amount: 2500, name: '不应留下的改名' })).rejects.toMatchObject({
        status: 409,
      })
      expect(item.amount).toBe(2000)
      expect(item.name).toBe('云空间')
      expect(item.revision).toBe(2)
      expect(item.priceHistory).toEqual(previous)
      expect(em.flush).not.toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })
  it('部分修改合并旧日期校验，不允许产生倒置日期', async () => {
    const { item, service } = fixture()
    await expect(service.save(1, { revision: 2, startDate: '2026-12-01' })).rejects.toThrow('不能早于')
    expect(item.startDate).toBe('2026-01-01')
  })
  it('批量排序先检查每个版本，拒绝重复ID且不更改未提交条目', async () => {
    const { item, em, service } = fixture()
    await expect(
      service.sort({
        items: [
          { id: 1, revision: 2, sortOrder: 1 },
          { id: 1, revision: 2, sortOrder: 2 },
        ],
      }),
    ).rejects.toThrow('不能重复')
    await expect(service.sort({ items: [{ id: 1, revision: 1, sortOrder: 5 }] })).rejects.toThrow('已被修改')
    expect(item.sortOrder).toBe(0)
    expect(em.flush).not.toHaveBeenCalled()
  })
})
