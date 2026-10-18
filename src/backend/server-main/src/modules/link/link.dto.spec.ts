/** @file link.dto.spec.ts @description 友链写入、申请规则与删除版本的严格 DTO 边界回归。 */
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { LINK_STATUSES } from '../../entities/friend-link.entity'
import { LinkRevisionDto, SaveLinkDto, SaveLinkSettingsDto } from './link.dto'
import { linkLogoUrl, linkUrl } from './link-values'

const uuid = '12345678-1234-4123-a123-123456789abc'

describe('友链写入 DTO', () => {
  it('接受局部更新、合法字段和可清空的头像来源', () => {
    expectDtoValid(SaveLinkDto, {})
    expectDtoValid(SaveLinkDto, { name: '字' })
    expectDtoValid(SaveLinkDto, { logoMediaId: null, logoUrl: null })
    expectDtoValid(SaveLinkDto, {
      requestId: uuid,
      revision: 0,
      name: ' 朋友的博客 ',
      description: '',
      url: 'https://example.com/',
      logoMediaId: uuid,
      status: 'published',
      isFeatured: true,
      sortOrder: 0,
    })
  })

  it.each([
    ['name', 80],
    ['description', 300],
  ] as const)('%s 检查 UTF-16 上限与错误类型', (field, max) => {
    expectDtoValid(SaveLinkDto, { [field]: '字'.repeat(max) })
    expectDtoValid(SaveLinkDto, { [field]: '📷'.repeat(max / 2) })
    expectDtoInvalid(SaveLinkDto, { [field]: '字'.repeat(max + 1) }, field, 'maxUtf16Length')
    expectDtoInvalid(SaveLinkDto, { [field]: '📷'.repeat(max / 2) + '字' }, field, 'maxUtf16Length')
    expectDtoInvalid(SaveLinkDto, { [field]: 123 }, field, 'isString')
    expectDtoInvalid(SaveLinkDto, { [field]: null }, field, 'isString')
  })

  it.each(['url', 'logoUrl'])('%s 检查一至 2048 字符边界及字符串类型', (field) => {
    expectDtoValid(SaveLinkDto, { [field]: 'a' })
    expectDtoValid(SaveLinkDto, { [field]: 'a'.repeat(2048) })
    expectDtoInvalid(SaveLinkDto, { [field]: 'a'.repeat(2049) }, field, 'maxLength')
    expectDtoInvalid(SaveLinkDto, { [field]: ' ' }, field, 'minLength')
    expectDtoInvalid(SaveLinkDto, { [field]: 1 }, field, 'isString')
  })

  it.each(LINK_STATUSES)('接受发布状态 %s', (status) => expectDtoValid(SaveLinkDto, { status }))

  it.each([
    ['name', '', 'minLength'],
    ['name', ' ', 'minLength'],
    ['url', null, 'isString'],
    ['requestId', 'not-a-uuid', 'isUuid'],
    ['requestId', '12345678-1234-1123-a123-123456789abc', 'isUuid'],
    ['requestId', 1, 'isUuid'],
    ['requestId', null, 'isUuid'],
    ['logoMediaId', '', 'isUuid'],
    ['logoMediaId', 1, 'isUuid'],
    ['revision', -1, 'min'],
    ['revision', 0.5, 'isInt'],
    ['revision', '0', 'isInt'],
    ['revision', null, 'isInt'],
    ['status', 'all', 'isIn'],
    ['status', 1, 'isIn'],
    ['isFeatured', 'true', 'isBoolean'],
    ['isFeatured', 1, 'isBoolean'],
    ['isFeatured', null, 'isBoolean'],
    ['sortOrder', -1000001, 'min'],
    ['sortOrder', 1000001, 'max'],
    ['sortOrder', 0.5, 'isInt'],
    ['sortOrder', '1', 'isInt'],
  ] as const)('拒绝 %s 的非法值 %j', (field, value, constraint) => {
    expectDtoInvalid(SaveLinkDto, { [field]: value }, field, constraint)
  })

  it('接受排序上下限和布尔 false，拒绝服务器派生字段', () => {
    for (const sortOrder of [-1000000, 1000000]) expectDtoValid(SaveLinkDto, { sortOrder, isFeatured: false })
    for (const field of ['domain', 'publishedAt', 'unknown'])
      expectDtoInvalid(SaveLinkDto, { [field]: 1 }, field, 'whitelistValidation')
  })
})

describe('友链设置 DTO', () => {
  it('接受空列表及十二项，每项一至三百 UTF-16 单元', () => {
    expectDtoValid(SaveLinkSettingsDto, { revision: 0, rules: [] })
    expectDtoValid(SaveLinkSettingsDto, { revision: 1, rules: Array(12).fill('字') })
    expectDtoValid(SaveLinkSettingsDto, { revision: 1, rules: ['📷'.repeat(150)] })
    expectDtoInvalid(SaveLinkSettingsDto, { revision: 1, rules: Array(13).fill('字') }, 'rules', 'arrayMaxSize')
    expectDtoInvalid(SaveLinkSettingsDto, { revision: 1, rules: ['📷'.repeat(150) + '字'] }, 'rules', 'maxUtf16Length')
    expectDtoInvalid(SaveLinkSettingsDto, { revision: 1, rules: [' '] }, 'rules', 'minLength')
  })

  it.each([{}, null, 1, '规则'])('拒绝非数组规则 %j', (rules) => {
    expectDtoInvalid(SaveLinkSettingsDto, { revision: 0, rules }, 'rules', 'isArray')
  })

  it.each([1, null, {}, []].map((rule) => ({ rule })))('拒绝非字符串规则项 %j', ({ rule }) => {
    expectDtoInvalid(SaveLinkSettingsDto, { revision: 0, rules: [rule] }, 'rules', 'isString')
  })

  it('设置版本和规则必填，禁止附加字段', () => {
    expectDtoInvalid(SaveLinkSettingsDto, {}, 'revision', 'isInt')
    expectDtoInvalid(SaveLinkSettingsDto, {}, 'rules', 'isArray')
    expectDtoInvalid(SaveLinkSettingsDto, { revision: 0, rules: [], unknown: true }, 'unknown', 'whitelistValidation')
  })

  it.each([-1, 0.5, '0', null])('设置不接受版本 %j', (revision) => {
    expectDtoInvalid(SaveLinkSettingsDto, { revision, rules: [] }, 'revision', revision === -1 ? 'min' : 'isInt')
  })
})

describe('友链删除版本 DTO', () => {
  it('查询参数允许数字字符串，缺失与未知字段被拒绝', () => {
    expectDtoValid(LinkRevisionDto, { revision: '0' })
    expectDtoValid(LinkRevisionDto, { revision: 1 })
    expectDtoInvalid(LinkRevisionDto, {}, 'revision', 'isInt')
    expectDtoInvalid(LinkRevisionDto, { revision: 0, unknown: true }, 'unknown', 'whitelistValidation')
  })

  it.each([-1, 0.5, 'invalid', null, '', ' ', true, false])('拒绝非法版本 %j', (revision) => {
    expectDtoInvalid(LinkRevisionDto, { revision }, 'revision', revision === -1 ? 'min' : 'isInt')
  })
})

describe('友链 URL 协议边界', () => {
  // 地址协议由现有业务纯函数检查，外部头像仅允许 HTTPS。
  it.each(['http://example.com/', 'https://example.com/'])('主页接受 %s', (url) => {
    expectDtoValid(SaveLinkDto, { url })
    expect(linkUrl(url)).toBe(url)
  })

  it('头像接受 HTTPS，拒绝 HTTP', () => {
    expectDtoValid(SaveLinkDto, { logoUrl: 'https://example.com/logo.png' })
    expect(linkLogoUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png')
    expect(() => linkLogoUrl('http://example.com/logo.png')).toThrow()
  })

  it.each([
    'javascript:alert(1)',
    'ftp://example.com/a',
    'file:///tmp/a',
    'data:image/png;base64,a',
    '//example.com/a',
    'https://user:password@example.com/a',
    'https://example.com/a b',
    'https://example.com/a\\b',
    'https://example.com/a\nb',
  ])('主页和头像拒绝危险地址 %j', (url) => {
    expect(() => linkUrl(url)).toThrow()
    expect(() => linkLogoUrl(url)).toThrow()
  })
})
