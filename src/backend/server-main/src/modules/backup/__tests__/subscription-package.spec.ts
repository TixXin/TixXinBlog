/** @file subscription-package.spec.ts @description v11 格式升版、历史事实、单位及管理身份的严格迁入边界。 */
import 'reflect-metadata'
import { parseContentPackage } from '../content-package'
import { subscriptionContentHash } from '../content-import-plan'
import { parsePackageSubscriptions } from '../content-package-subscriptions'

const event = (overrides = {}) => ({
  id: '6459bac0-801f-44cd-91ae-5729bef9a110',
  effectiveAt: '2026-10-01T10:00:00.000Z',
  recordedAt: '2026-10-01T10:00:00.000Z',
  amount: 2000,
  currency: 'USD' as const,
  billingCycle: 'monthly' as const,
  ...overrides,
})
const subscription = () => ({
  sourceId: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  publishedAt: '2026-10-01T12:00:00.000Z',
  deleted: false,
  values: {
    name: '工作用云盘',
    description: '保存设计文件',
    url: 'https://example.org/',
    platform: null,
    category: 'cloud' as const,
    currency: 'USD' as const,
    amount: 2000,
    billingCycle: 'monthly' as const,
    startDate: '2020-01-31',
    nextBillingDate: '2026-10-31',
    subscriptionStatus: 'active' as const,
    notes: '家庭方案',
    iconMediaId: null,
    faviconDomain: null,
    priceHistory: [event()],
    status: 'published' as const,
    sortOrder: 10,
  },
})
const bundle = () => ({
  format: 'tixxin-content',
  version: 11,
  omittedRelations: 0,
  exportedAt: '2026-10-02T12:00:00.000Z',
  mediaIncluded: false,
  posts: [],
  flashes: [],
  moments: [],
  guestbook: [],
  gallery: [],
  projects: [],
  links: [],
  prompts: [],
  subscriptions: [subscription()],
  linkSettings: { rules: [] },
  gallerySettings: { gear: [] },
  folders: [],
  tags: [],
  media: [],
  requireCommentApproval: false,
  site: {
    name: '山间札记',
    description: '',
    ownerName: 'tixxin',
    ownerTitle: '',
    avatar: '',
    avatarAlt: '',
    seoTitle: '',
    seoDescription: '',
    announcement: '',
    socials: [],
    about: { visible: false, introduction: '', sections: [] },
  },
})
const parse = (input: unknown) => parseContentPackage(Buffer.from(JSON.stringify(input)))

describe('平台订阅内容包 v11', () => {
  it('保存价格事实和管理备注，开始日期不会伪造更早的历史价格', async () => {
    const parsed = await parse(bundle())
    expect(parsed.version).toBe(13)
    expect(parsed.subscriptions).toEqual([subscription()])
    expect(parsed.subscriptions[0]?.values.priceHistory[0]?.effectiveAt).toBe('2026-10-01T10:00:00.000Z')
  })
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('兼容 v%i 的原字段集，不在旧格式偷偷增加订阅', async (version) => {
    const legacy: Record<string, unknown> = { ...bundle(), version }
    delete legacy.subscriptions
    if (version < 10) delete legacy.prompts
    if (version < 9) delete legacy.omittedRelations
    if (version < 8) {
      const { about, ...site } = bundle().site
      void about
      legacy.site = site
    }
    if (version < 6) {
      delete legacy.links
      delete legacy.linkSettings
    }
    if (version < 5) delete legacy.projects
    if (version < 4) {
      delete legacy.gallery
      delete legacy.gallerySettings
    }
    if (version < 3) delete legacy.guestbook
    if (version < 2) delete legacy.moments
    expect((await parse(legacy)).subscriptions).toEqual([])
    await expect(parse({ ...legacy, subscriptions: [] })).rejects.toThrow('v1–v10 不支持平台订阅费')
  })
  it('拒绝缺失字段、重复源编号和管理凭据', async () => {
    const { subscriptions, ...missing } = bundle()
    await expect(parse(missing)).rejects.toThrow()
    await expect(parse({ ...bundle(), subscriptions: [...subscriptions, ...subscriptions] })).rejects.toThrow()
    for (const key of ['requestId', 'requestHash', 'revision', 'updatedAt', 'priceChangeReason'])
      expect(() =>
        parsePackageSubscriptions([{ ...subscription(), values: { ...subscription().values, [key]: 'private' } }]),
      ).toThrow()
    for (const key of Object.keys(subscription().values)) {
      const values: Record<string, unknown> = { ...subscription().values }
      delete values[key]
      expect(() => parsePackageSubscriptions([{ ...subscription(), values }])).toThrow()
    }
  })
  it.each([
    { amount: -1 },
    { amount: 1.1 },
    { amount: 2147483648 },
    { currency: 'BTC' },
    { name: ' ' },
    { billingCycle: 'weekly' },
    { subscriptionStatus: 'published' },
    { status: 'active' },
    { startDate: '2026-02-30' },
    { nextBillingDate: '2019-01-01' },
    { url: 'https://person:password@example.org/' },
    { url: 'javascript:alert(1)' },
    { iconMediaId: 'not-a-uuid' },
    { faviconDomain: 'other.example.org' },
    { faviconDomain: '127.0.0.1', url: 'http://127.0.0.1/' },
  ])('拒绝非法业务值 %j', (patch) => {
    expect(() =>
      parsePackageSubscriptions([{ ...subscription(), values: { ...subscription().values, ...patch } }]),
    ).toThrow()
  })
  it('JPY 金额不做乘除，零金额和公开域名可以原样保留', () => {
    const values = {
      ...subscription().values,
      amount: 1000,
      currency: 'JPY',
      faviconDomain: 'example.org',
      priceHistory: [event({ amount: 1000, currency: 'JPY' })],
    }
    expect(parsePackageSubscriptions([{ ...subscription(), values }])[0]?.values.amount).toBe(1000)
    values.amount = 0
    values.priceHistory = [event({ amount: 0, currency: 'JPY' })]
    expect(parsePackageSubscriptions([{ ...subscription(), values }])[0]?.values.amount).toBe(0)
  })
  it('拒绝空历史、重复事件、未来生效、倒序、未知字段或末条与当前值不符', () => {
    for (const priceHistory of [
      [],
      [event(), event()],
      [event({ amount: 3000 })],
      [event({ effectiveAt: '2026-10-02T10:00:00.000Z' })],
      [event({ recordedAt: '2026-02-30T10:00:00.000Z' })],
      [event({ revision: 1 })],
      [event(), event({ id: '18b60bc1-f79e-44c0-89a1-8101a6f5c782', effectiveAt: '2026-09-01T10:00:00.000Z' })],
    ])
      expect(() =>
        parsePackageSubscriptions([{ ...subscription(), values: { ...subscription().values, priceHistory } }]),
      ).toThrow()
  })
  it('拒绝尚未发生的价格记录，不让未来历史锁死后续变价', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const values = { ...subscription().values, priceHistory: [event({ effectiveAt: future, recordedAt: future })] }
    expect(() => parsePackageSubscriptions([{ ...subscription(), values }])).toThrow()
  })
  it('同日多次变价与跨币种、周期变化按事实保留，不自动追加事件', () => {
    const priceHistory = [
      event(),
      event({
        id: '18b60bc1-f79e-44c0-89a1-8101a6f5c782',
        effectiveAt: '2026-10-01T11:00:00.000Z',
        recordedAt: '2026-10-01T12:00:00.000Z',
        amount: 1000,
        currency: 'JPY',
        billingCycle: 'yearly',
        reason: '改用年度方案',
      }),
    ]
    const values = { ...subscription().values, currency: 'JPY', amount: 1000, billingCycle: 'yearly', priceHistory }
    expect(parsePackageSubscriptions([{ ...subscription(), values }])[0]?.values.priceHistory).toEqual(priceHistory)
  })
  it('去重包含历史和业务状态；发布状态与可再生缓存不造成重复迁入', () => {
    const values = subscription().values
    expect(subscriptionContentHash(values)).toBe(
      subscriptionContentHash({ ...values, status: 'draft', faviconDomain: 'example.org' }),
    )
    expect(subscriptionContentHash(values)).not.toBe(
      subscriptionContentHash({ ...values, subscriptionStatus: 'paused' }),
    )
    expect(subscriptionContentHash(values)).not.toBe(
      subscriptionContentHash({ ...values, priceHistory: [event({ reason: '真实变更说明' })] }),
    )
  })
})
