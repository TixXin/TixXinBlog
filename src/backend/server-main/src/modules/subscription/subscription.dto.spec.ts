/** @file subscription.dto.spec.ts @description 平台订阅保存、删除、排序和图标抓取 DTO 的完整输入边界。 */
import { plainToInstance } from 'class-transformer'
import {
  BILLING_CYCLES,
  CURRENCIES,
  PUBLICATION_STATUSES,
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_STATUSES,
} from '@tixxin/subscription-domain'
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import {
  FetchFaviconDto,
  SaveSubscriptionDto,
  SubscriptionRevisionDto,
  SubscriptionSortDto,
  SubscriptionSortItemDto,
} from './subscription.dto'
import { faviconDomain, subscriptionUrl } from './subscription-values'

const uuid = 'ce97b10b-cf16-48a5-b613-44b70417bfc7'
const sortItem = { id: 1, revision: 0, sortOrder: 0 }

describe('订阅保存 DTO', () => {
  it('接受完整创建资料以及不填字段的局部更新', () => {
    expectDtoValid(SaveSubscriptionDto, {})
    expectDtoValid(SaveSubscriptionDto, {
      requestId: uuid,
      revision: 0,
      name: '开发工具',
      description: '日常使用',
      url: 'https://github.com',
      platform: 'GitHub',
      category: 'development',
      currency: 'CNY',
      amount: 0,
      billingCycle: 'monthly',
      startDate: '2026-10-01',
      nextBillingDate: '2026-11-01',
      subscriptionStatus: 'active',
      notes: '',
      iconMediaId: uuid,
      status: 'draft',
      sortOrder: 0,
      priceChangeReason: '',
    })
    expect(plainToInstance(SaveSubscriptionDto, {})).toEqual({})
  })

  it.each([
    ['name', 160],
    ['description', 5000],
    ['platform', 160],
    ['notes', 5000],
    ['priceChangeReason', 500],
  ] as const)('%s 按 UTF-16 限制长度且拒绝错误类型', (field, maximum) => {
    expectDtoValid(SaveSubscriptionDto, { [field]: '字'.repeat(maximum) })
    expectDtoValid(SaveSubscriptionDto, { [field]: '😀'.repeat(maximum / 2) })
    expectDtoInvalid(SaveSubscriptionDto, { [field]: '字'.repeat(maximum + 1) }, field, 'maxUtf16Length')
    expectDtoInvalid(SaveSubscriptionDto, { [field]: `${'😀'.repeat(maximum / 2)}字` }, field, 'maxUtf16Length')
    for (const value of [1, false, [], {}]) expectDtoInvalid(SaveSubscriptionDto, { [field]: value }, field, 'isString')
  })

  it('名称至少一个非空白字符，其他可清空文本允许空串', () => {
    expectDtoValid(SaveSubscriptionDto, { name: '字', description: '', platform: '', notes: '', priceChangeReason: '' })
    for (const name of ['', ' \t\n ']) expectDtoInvalid(SaveSubscriptionDto, { name }, 'name', 'minLength')
    expect(
      plainToInstance(SaveSubscriptionDto, {
        name: ' 名称 ',
        description: ' 描述 ',
        platform: ' 平台 ',
        priceChangeReason: ' 调整 ',
      }),
    ).toMatchObject({ name: '名称', description: '描述', platform: '平台', priceChangeReason: '调整' })
  })

  it.each([
    ['url', 2048],
    ['startDate', 10],
    ['nextBillingDate', 10],
  ] as const)('%s 的 DTO 字符串长度边界', (field, maximum) => {
    expectDtoValid(SaveSubscriptionDto, { [field]: 'a'.repeat(maximum) })
    expectDtoInvalid(SaveSubscriptionDto, { [field]: 'a'.repeat(maximum + 1) }, field, 'maxLength')
    for (const value of [1, false, [], {}]) expectDtoInvalid(SaveSubscriptionDto, { [field]: value }, field, 'isString')
  })

  it.each(['url', 'platform', 'startDate', 'nextBillingDate', 'iconMediaId'])('%s 可用 null 清空', (field) => {
    expectDtoValid(SaveSubscriptionDto, { [field]: null })
  })

  it.each([
    ['name', 'isString'],
    ['description', 'isString'],
    ['notes', 'isString'],
    ['priceChangeReason', 'isString'],
    ['requestId', 'isUuid'],
    ['revision', 'isInt'],
    ['amount', 'isInt'],
    ['sortOrder', 'isInt'],
    ['category', 'isIn'],
    ['currency', 'isIn'],
    ['billingCycle', 'isIn'],
    ['subscriptionStatus', 'isIn'],
    ['status', 'isIn'],
  ])('%s 不允许用 null 绕过校验', (field, constraint) => {
    expectDtoInvalid(SaveSubscriptionDto, { [field]: null }, field, constraint)
  })

  it.each(['requestId', 'iconMediaId'])('%s 仅接受 UUID v4', (field) => {
    expectDtoValid(SaveSubscriptionDto, { [field]: uuid })
    for (const value of ['', 'not-a-uuid', 'ce97b10b-cf16-18a5-b613-44b70417bfc7', 1, false, [], {}]) {
      expectDtoInvalid(SaveSubscriptionDto, { [field]: value }, field, 'isUuid')
    }
  })

  it.each([
    ['category', SUBSCRIPTION_CATEGORIES],
    ['currency', CURRENCIES],
    ['billingCycle', BILLING_CYCLES],
    ['subscriptionStatus', SUBSCRIPTION_STATUSES],
    ['status', PUBLICATION_STATUSES],
  ] as const)('%s 允许所有定义值并拒绝未知值或类型', (field, values) => {
    for (const value of values) expectDtoValid(SaveSubscriptionDto, { [field]: value })
    for (const value of ['', 'unknown', 1, false, [], {}])
      expectDtoInvalid(SaveSubscriptionDto, { [field]: value }, field, 'isIn')
  })

  it.each([
    ['revision', 0, 2147483647],
    ['amount', 0, 2147483647],
    ['sortOrder', -1000000, 1000000],
  ] as const)('%s 接受整数两端并拒绝越界和隐式类型转换', (field, minimum, maximum) => {
    expectDtoValid(SaveSubscriptionDto, { [field]: minimum })
    expectDtoValid(SaveSubscriptionDto, { [field]: maximum })
    expectDtoInvalid(SaveSubscriptionDto, { [field]: minimum - 1 }, field, 'min')
    expectDtoInvalid(SaveSubscriptionDto, { [field]: maximum + 1 }, field, 'max')
    for (const value of ['1', 0.5, true, [], {}, Infinity, NaN])
      expectDtoInvalid(SaveSubscriptionDto, { [field]: value }, field, 'isInt')
  })

  it.each(['priceHistory', 'createdAt', 'updatedAt', 'publishedAt', 'deletedAt', 'requestHash', 'id', 'unexpected'])(
    '禁止写入系统或额外字段 %s',
    (field) => {
      expectDtoInvalid(SaveSubscriptionDto, { name: '开发工具', [field]: '覆盖' }, field, 'whitelistValidation')
    },
  )
})

describe('订阅删除和排序 DTO', () => {
  it('删除版本允许数字查询字符串，排序也保留相同转换契约', () => {
    expectDtoValid(SubscriptionRevisionDto, { revision: '0' })
    expectDtoValid(SubscriptionSortItemDto, { ...sortItem, revision: '0' })
    expect(plainToInstance(SubscriptionRevisionDto, { revision: '12' }).revision).toBe(12)
  })

  it.each([true, false, '', ' '])('排序请求不能把布尔或空白版本 %p 转成整数', (revision) => {
    expectDtoInvalid(SubscriptionSortDto, { items: [{ ...sortItem, revision }] }, 'items.0.revision', 'isInt')
    expectDtoInvalid(SubscriptionSortItemDto, { ...sortItem, revision }, 'revision', 'isInt')
    expectDtoInvalid(SubscriptionRevisionDto, { revision }, 'revision', 'isInt')
  })

  it.each([0, 2147483647])('版本接受闭区间边界 %i', (revision) => {
    expectDtoValid(SubscriptionRevisionDto, { revision })
    expectDtoValid(SubscriptionSortItemDto, { ...sortItem, revision })
  })

  it('版本拒绝越界、缺失和不可转为整数的值', () => {
    for (const [revision, constraint] of [
      [-1, 'min'],
      [2147483648, 'max'],
    ] as const) {
      expectDtoInvalid(SubscriptionRevisionDto, { revision }, 'revision', constraint)
      expectDtoInvalid(SubscriptionSortDto, { items: [{ ...sortItem, revision }] }, 'items.0.revision', constraint)
    }
    for (const revision of [undefined, null, 'wrong', 0.5, [], {}, Infinity, NaN]) {
      expectDtoInvalid(SubscriptionRevisionDto, { revision }, 'revision', 'isInt')
      expectDtoInvalid(SubscriptionSortItemDto, { ...sortItem, revision }, 'revision', 'isInt')
    }
  })

  it.each([
    ['id', 1, 2147483647],
    ['sortOrder', -1000000, 1000000],
  ] as const)('排序项 %s 的数值和类型边界', (field, minimum, maximum) => {
    expectDtoValid(SubscriptionSortItemDto, { ...sortItem, [field]: minimum })
    expectDtoValid(SubscriptionSortItemDto, { ...sortItem, [field]: maximum })
    expectDtoInvalid(SubscriptionSortItemDto, { ...sortItem, [field]: minimum - 1 }, field, 'min')
    expectDtoInvalid(SubscriptionSortItemDto, { ...sortItem, [field]: maximum + 1 }, field, 'max')
    for (const value of [undefined, null, '1', true, 0.5, [], {}, Infinity, NaN])
      expectDtoInvalid(SubscriptionSortItemDto, { ...sortItem, [field]: value }, field, 'isInt')
  })

  it('排序数组必须有一至四十八项', () => {
    expectDtoValid(SubscriptionSortDto, { items: [sortItem] })
    expectDtoValid(SubscriptionSortDto, {
      items: Array.from({ length: 48 }, (_, index) => ({ ...sortItem, id: index + 1 })),
    })
    expectDtoInvalid(SubscriptionSortDto, { items: [] }, 'items', 'arrayMinSize')
    expectDtoInvalid(
      SubscriptionSortDto,
      { items: Array.from({ length: 49 }, (_, index) => ({ ...sortItem, id: index + 1 })) },
      'items',
      'arrayMaxSize',
    )
  })

  it.each([undefined, null, {}, 1, '排序'])('拒绝非数组排序 %p', (items) => {
    expectDtoInvalid(SubscriptionSortDto, { items }, 'items', 'isArray')
  })

  it.each([[], null, 1, '条目'])('排序项必须为对象 %p', (value) => {
    expectDtoInvalid(SubscriptionSortDto, { items: [value] }, 'items', 'isObject')
  })

  it('逐层拒绝未知字段且验证嵌套必填属性', () => {
    expectDtoInvalid(SubscriptionRevisionDto, { revision: 0, force: true }, 'force', 'whitelistValidation')
    expectDtoInvalid(SubscriptionSortItemDto, { ...sortItem, name: '覆盖' }, 'name', 'whitelistValidation')
    expectDtoInvalid(SubscriptionSortDto, { items: [sortItem], force: true }, 'force', 'whitelistValidation')
    expectDtoInvalid(
      SubscriptionSortDto,
      { items: [{ ...sortItem, name: '覆盖' }] },
      'items.0.name',
      'whitelistValidation',
    )
    for (const field of ['id', 'revision', 'sortOrder'])
      expectDtoInvalid(SubscriptionSortDto, { items: [{}] }, `items.0.${field}`, 'isInt')
  })
})

describe('订阅图标请求 DTO 和现有 URL 协议边界', () => {
  it('图标地址长度为一至两千零四十八字符', () => {
    expectDtoValid(FetchFaviconDto, { url: 'a' })
    expectDtoValid(FetchFaviconDto, { url: 'a'.repeat(2048), force: false })
    expectDtoValid(FetchFaviconDto, { url: 'https://github.com', force: true })
    expectDtoInvalid(FetchFaviconDto, { url: '' }, 'url', 'minLength')
    expectDtoInvalid(FetchFaviconDto, { url: 'a'.repeat(2049) }, 'url', 'maxLength')
  })

  it.each([undefined, null, 1, false, [], {}])('图标地址拒绝非字符串 %p', (url) => {
    expectDtoInvalid(FetchFaviconDto, { url }, 'url', 'isString')
  })

  it.each([null, 'true', 1, [], {}])('刷新选项仅允许布尔值 %p', (force) => {
    expectDtoInvalid(FetchFaviconDto, { url: 'https://github.com', force }, 'force', 'isBoolean')
  })

  it('拒绝图标请求的额外字段', () => {
    expectDtoInvalid(
      FetchFaviconDto,
      { url: 'https://github.com', provider: 'custom' },
      'provider',
      'whitelistValidation',
    )
  })

  it.each(['http://github.com', 'https://github.com'])('DTO 与业务校验接受 HTTP(S) 地址 %s', (url) => {
    expectDtoValid(SaveSubscriptionDto, { url })
    expectDtoValid(FetchFaviconDto, { url })
    expect(subscriptionUrl(url)).toBe(`${url}/`)
    expect(faviconDomain(url)).toBe('github.com')
  })

  // 协议校验沿用保存和抓取入口共用的业务函数；DTO 负责字段类型、长度和白名单。
  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,a',
    'file:///tmp/a',
    'ftp://github.com',
    'mailto:a@github.com',
    '//github.com',
  ])('现有业务边界拒绝非 HTTP(S) 协议 %s', (url) => {
    expect(() => subscriptionUrl(url)).toThrow()
    expect(() => faviconDomain(url)).toThrow()
  })
})
