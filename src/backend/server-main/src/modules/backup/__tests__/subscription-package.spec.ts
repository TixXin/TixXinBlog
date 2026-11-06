/** @file subscription-package.spec.ts @description v11 格式升版、历史事实、单位及管理身份的严格迁入边界；v18 起的试用到期日与结束日。 */
import 'reflect-metadata'
import { parseContentPackage } from '../content-package'
import { subscriptionContentHash } from '../content-import-plan'
import {
  parsePackageSubscriptions,
  SUBSCRIPTION_PLAN_VERSION,
  SUBSCRIPTION_SCHEDULE_VERSION,
} from '../content-package-subscriptions'

/** v20 才有的字段的缺省值 */
const LATER = { pausedPeriods: [], planName: null, paymentMethod: null }
/** 不含试用到期日与结束日的旧格式版本 */
const LEGACY = SUBSCRIPTION_SCHEDULE_VERSION - 1

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
    expect(parsed.version).toBe(20)
    expect(parsed.subscriptions).toEqual([
      {
        ...subscription(),
        values: {
          ...subscription().values,
          trialEndDate: null,
          endDate: null,
          pausedPeriods: [],
          planName: null,
          paymentMethod: null,
        },
      },
    ])
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
        parsePackageSubscriptions(
          [{ ...subscription(), values: { ...subscription().values, [key]: 'private' } }],
          LEGACY,
        ),
      ).toThrow()
    for (const key of Object.keys(subscription().values)) {
      const values: Record<string, unknown> = { ...subscription().values }
      delete values[key]
      expect(() => parsePackageSubscriptions([{ ...subscription(), values }], LEGACY)).toThrow()
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
      parsePackageSubscriptions([{ ...subscription(), values: { ...subscription().values, ...patch } }], LEGACY),
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
    expect(parsePackageSubscriptions([{ ...subscription(), values }], LEGACY)[0]?.values.amount).toBe(1000)
    values.amount = 0
    values.priceHistory = [event({ amount: 0, currency: 'JPY' })]
    expect(parsePackageSubscriptions([{ ...subscription(), values }], LEGACY)[0]?.values.amount).toBe(0)
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
        parsePackageSubscriptions([{ ...subscription(), values: { ...subscription().values, priceHistory } }], LEGACY),
      ).toThrow()
  })
  it('拒绝尚未发生的价格记录，不让未来历史锁死后续变价', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const values = { ...subscription().values, priceHistory: [event({ effectiveAt: future, recordedAt: future })] }
    expect(() => parsePackageSubscriptions([{ ...subscription(), values }], LEGACY)).toThrow()
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
    expect(parsePackageSubscriptions([{ ...subscription(), values }], LEGACY)[0]?.values.priceHistory).toEqual(
      priceHistory,
    )
  })
  it('去重包含历史和业务状态；发布状态与可再生缓存不造成重复迁入', () => {
    const values = { ...subscription().values, trialEndDate: null, endDate: null, ...LATER }
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
  it('去重区分试用到期日与结束日', () => {
    const values = { ...subscription().values, trialEndDate: null, endDate: null, ...LATER }
    expect(subscriptionContentHash(values)).not.toBe(subscriptionContentHash({ ...values, endDate: '2026-12-31' }))
  })
})

describe('平台订阅内容包 v18 日程字段', () => {
  const scheduled = (patch: Record<string, unknown> = {}) => [
    { ...subscription(), values: { ...subscription().values, trialEndDate: null, endDate: '2026-12-31', ...patch } },
  ]
  it('v18 起必须携带试用到期日与结束日，并原样保留', () => {
    const [parsed] = parsePackageSubscriptions(scheduled({ trialEndDate: '2020-02-14' }), SUBSCRIPTION_SCHEDULE_VERSION)
    expect(parsed?.values).toMatchObject({ trialEndDate: '2020-02-14', endDate: '2026-12-31' })
    expect(() => parsePackageSubscriptions([subscription()], SUBSCRIPTION_SCHEDULE_VERSION)).toThrow()
  })
  it('旧版本夹带新字段按未知字段拒绝，缺省时规范为 null', () => {
    expect(() => parsePackageSubscriptions(scheduled(), LEGACY)).toThrow()
    expect(parsePackageSubscriptions([subscription()], LEGACY)[0]?.values).toMatchObject({
      trialEndDate: null,
      endDate: null,
    })
  })
  it.each([
    { trialEndDate: '2019-12-31' },
    { endDate: '2019-12-31' },
    { endDate: '2026-02-30' },
    { billingCycle: 'weekly' },
  ])('拒绝早于开始日或不存在的日程日期 %j', (patch) => {
    expect(() => parsePackageSubscriptions(scheduled(patch), SUBSCRIPTION_SCHEDULE_VERSION)).toThrow()
  })
  it('接受新的多年与半年周期', () => {
    for (const billingCycle of ['semiannual', 'biennial', 'triennial']) {
      const values = { billingCycle, priceHistory: [event({ billingCycle })] }
      expect(parsePackageSubscriptions(scheduled(values), SUBSCRIPTION_SCHEDULE_VERSION)[0]?.values.billingCycle).toBe(
        billingCycle,
      )
    }
  })
})

describe('平台订阅内容包 v20 暂停区间、套餐名与付款方式', () => {
  const planned = (patch: Record<string, unknown> = {}) => [
    {
      ...subscription(),
      values: {
        ...subscription().values,
        trialEndDate: null,
        endDate: null,
        pausedPeriods: [{ from: '2026-03-01', to: '2026-04-01' }],
        planName: '家庭版',
        paymentMethod: '信用卡',
        ...patch,
      },
    },
  ]
  it('v20 必须携带三个字段并原样保留，缺省 to 规范为 null', () => {
    const [parsed] = parsePackageSubscriptions(
      planned({ pausedPeriods: [{ from: '2026-03-01' }] }),
      SUBSCRIPTION_PLAN_VERSION,
    )
    expect(parsed?.values).toMatchObject({
      pausedPeriods: [{ from: '2026-03-01', to: null }],
      planName: '家庭版',
      paymentMethod: '信用卡',
    })
    expect(() => parsePackageSubscriptions(scheduledOnly(), SUBSCRIPTION_PLAN_VERSION)).toThrow()
  })
  it('更早版本夹带新字段拒绝，缺省时补为空', () => {
    expect(() => parsePackageSubscriptions(planned(), SUBSCRIPTION_SCHEDULE_VERSION)).toThrow()
    expect(parsePackageSubscriptions(scheduledOnly(), SUBSCRIPTION_SCHEDULE_VERSION)[0]?.values).toMatchObject({
      pausedPeriods: [],
      planName: null,
      paymentMethod: null,
    })
  })
  it.each([
    { pausedPeriods: [{ from: '2019-12-01' }] },
    { pausedPeriods: [{ from: '2026-03-01' }, { from: '2026-05-01' }] },
    { pausedPeriods: 'x' },
    { planName: 'x'.repeat(81) },
  ])('拒绝非法值 %j', (patch) => {
    expect(() => parsePackageSubscriptions(planned(patch), SUBSCRIPTION_PLAN_VERSION)).toThrow()
  })
  it('去重区分暂停区间与套餐名', () => {
    const [parsed] = parsePackageSubscriptions(planned(), SUBSCRIPTION_PLAN_VERSION)
    const values = parsed!.values
    expect(subscriptionContentHash(values)).not.toBe(subscriptionContentHash({ ...values, pausedPeriods: [] }))
    expect(subscriptionContentHash(values)).not.toBe(subscriptionContentHash({ ...values, planName: null }))
  })
  function scheduledOnly() {
    return [{ ...subscription(), values: { ...subscription().values, trialEndDate: null, endDate: null } }]
  }
})
