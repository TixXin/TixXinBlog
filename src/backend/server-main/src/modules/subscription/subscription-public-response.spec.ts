/** @file subscription-public-response.spec.ts @description 订阅列表、详情和统计的公开 JSON 白名单与可见性 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import { MediaAsset } from '../../entities/media-asset.entity'
import { Subscription } from '../../entities/subscription.entity'
import { SubscriptionService } from './subscription.service'
import { AdminSubscriptionQuery, SubscriptionQuery } from './subscription.dto'
import { faviconUrl } from './subscription-favicon.service'

const history = [
  {
    id: 'c87f843f-d4be-4ee1-b51d-febee6d50353',
    effectiveAt: '2026-01-01T00:00:00.000Z',
    recordedAt: '2026-01-01T00:00:00.000Z',
    amount: 2000,
    currency: 'USD' as const,
    billingCycle: 'monthly' as const,
    reason: '套餐公开调价说明',
  },
]
const expected = {
  id: 48,
  name: '云空间',
  description: '文档同步',
  url: 'https://cloud.example.test',
  platform: '云服务',
  category: 'cloud',
  currency: 'USD',
  amount: 2000,
  billingCycle: 'monthly',
  startDate: '2026-01-01',
  nextBillingDate: '2026-11-01',
  subscriptionStatus: 'active',
  iconUrl: '/api/v1/media/0e172e75-38de-4f32-b0de-c016e6e7de50.webp',
  faviconUrl: faviconUrl('cloud.example.test'),
  priceHistory: history,
  publishedAt: '2026-10-01T00:00:00.000Z',
}

function fixture() {
  const item: Subscription = Object.assign(new Subscription(), {
    ...expected,
    priceHistory: structuredClone(history),
    publishedAt: new Date(expected.publishedAt),
    faviconDomain: 'cloud.example.test',
    iconMedia: Object.assign(new MediaAsset(), {
      id: '0e172e75-38de-4f32-b0de-c016e6e7de50',
      storageKey: 'private/storage/key.webp',
      originalName: 'private-file-name.png',
      sha256: 'private-media-digest',
      description: '仅供管理的媒体说明',
    }),
    notes: '管理备注 private@example.test',
    status: 'published',
    revision: 27,
    sortOrder: 80,
    requestId: 'aee4a184-b664-4881-84cf-9e7af533d134',
    requestHash: 'private-request-hash',
    deletedAt: null,
    visitorHash: 'private-visitor-hash',
    ip: '192.0.2.48',
    email: 'private@example.test',
  })
  const em = {
    findAndCount: jest.fn().mockResolvedValue([[item], 1]),
    findOne: jest.fn().mockResolvedValue(item),
    find: jest.fn().mockResolvedValue([item]),
  }
  return { item, em, service: new SubscriptionService(em as unknown as EntityManager) }
}

describe('订阅公开 GET 响应白名单', () => {
  it('列表与详情仅输出公开字段、价格历史和图标 URL，不返回实体或管理凭据', async () => {
    const { item, em, service } = fixture()
    const before = JSON.stringify(item)
    // 即使调用者传入管理筛选，公开入口仍固定 published。
    const query = Object.assign(new AdminSubscriptionQuery(), { status: 'draft', page: 2, pageSize: 3 })
    expect(JSON.parse(JSON.stringify(await service.list(query)))).toStrictEqual({
      items: [expected],
      total: 1,
      page: 2,
      pageSize: 3,
    })
    expect(JSON.parse(JSON.stringify(await service.detail(48)))).toStrictEqual(expected)
    expect(em.findAndCount).toHaveBeenCalledWith(
      Subscription,
      { status: 'published', deletedAt: null },
      { populate: ['iconMedia'], orderBy: { sortOrder: 'DESC', id: 'DESC' }, limit: 3, offset: 3 },
    )
    expect(em.findOne).toHaveBeenCalledWith(
      Subscription,
      { id: 48, status: 'published', deletedAt: null },
      { populate: ['iconMedia'] },
    )
    expect(JSON.stringify(item)).toBe(before)
  })

  it('无图标及可选资料时仍使用相同白名单，不回退暴露存储字段', () => {
    const { item, service } = fixture()
    item.iconMedia = null
    item.faviconDomain = null
    item.url = null
    item.platform = null
    item.startDate = null
    item.nextBillingDate = null
    item.publishedAt = null
    item.priceHistory = []
    expect(JSON.parse(JSON.stringify(service.serialize(item)))).toStrictEqual({
      ...expected,
      url: null,
      platform: null,
      startDate: null,
      nextBillingDate: null,
      iconUrl: null,
      faviconUrl: null,
      publishedAt: null,
      priceHistory: [],
    })
  })

  it('统计与续费条目只输出聚合字段，筛选排除草稿、撤回和删除记录', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-18T00:00:00.000Z'))
    try {
      const { em, service } = fixture()
      const query = Object.assign(new SubscriptionQuery(), { currency: 'USD', category: 'cloud', pageSize: 1 })
      expect(JSON.parse(JSON.stringify(await service.stats(query)))).toStrictEqual({
        asOf: '2026-10-18',
        total: 1,
        activeCount: 1,
        recurringCount: 1,
        categoryCount: 1,
        currencies: [
          {
            currency: 'USD',
            count: 1,
            activeCount: 1,
            recurringCount: 1,
            annualAmount: 24000,
            monthlyAmount: 2000,
            oneTimeAmount: 0,
            categories: [{ category: 'cloud', count: 1, annualAmount: 24000 }],
            forecast: [
              { month: '2026-10', amount: 0 },
              ...[
                '2026-11',
                '2026-12',
                '2027-01',
                '2027-02',
                '2027-03',
                '2027-04',
                '2027-05',
                '2027-06',
                '2027-07',
                '2027-08',
                '2027-09',
              ].map((month) => ({ month, amount: 2000 })),
            ],
            upcoming: [{ id: 48, name: '云空间', date: '2026-11-01', amount: 2000, currency: 'USD', overdue: false }],
          },
        ],
      })
      expect(em.find).toHaveBeenCalledWith(Subscription, {
        status: 'published',
        deletedAt: null,
        currency: 'USD',
        category: 'cloud',
      })
    } finally {
      jest.useRealTimers()
    }
  })

  it('不可见详情只报告不存在，不返回隐藏记录或管理状态', async () => {
    const { em, service } = fixture()
    em.findOne.mockResolvedValue(null)
    await expect(service.detail(48)).rejects.toMatchObject({ status: 404, message: '订阅不存在或尚未公开' })
    expect(em.findOne).toHaveBeenCalledWith(
      Subscription,
      { id: 48, status: 'published', deletedAt: null },
      { populate: ['iconMedia'] },
    )
  })
})
