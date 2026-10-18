/** @file link-values.spec.ts @description 友链查询、管理输入与外部地址的边界回归 */
import 'reflect-metadata'
import { BadRequestException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { AdminLinkQuery, LinkQuery, LinkRevisionDto, SaveLinkDto, SaveLinkSettingsDto } from './link.dto'
import { linkId, linkLogoUrl, linkUrl, linkValues } from './link-values'

const mediaId = '12345678-1234-4123-a123-123456789abc'
const validation = { whitelist: true, forbidNonWhitelisted: true }
const validateLink = (body: object) => validateSync(plainToInstance(SaveLinkDto, body), validation)

describe('友链查询与管理输入', () => {
  it('使用默认分页，将查询数字转换为整数并修剪搜索词', () => {
    expect(plainToInstance(LinkQuery, {})).toEqual({ page: 1, pageSize: 12 })
    const query = plainToInstance(LinkQuery, { page: '2', pageSize: '48', q: '  手记  ', featured: 'false' })
    expect(validateSync(query, validation)).toEqual([])
    expect(query).toEqual({ page: 2, pageSize: 48, q: '手记', featured: 'false' })
  })

  it.each([
    { page: 0 },
    { page: 10001 },
    { page: 1.5 },
    { pageSize: 0 },
    { pageSize: 49 },
    { pageSize: 'abc' },
    { q: '字'.repeat(201) },
    { q: null },
    { featured: true },
    { featured: 'TRUE' },
    { featured: ['true', 'false'] },
    { status: 'draft' },
  ])('公开查询拒绝越界或管理参数 %j', (query) => {
    expect(validateSync(plainToInstance(LinkQuery, query), validation)).not.toHaveLength(0)
  })

  it.each(['all', 'draft', 'published', 'withdrawn'])('管理查询允许状态 %s', (status) => {
    expect(validateSync(plainToInstance(AdminLinkQuery, { status }), validation)).toEqual([])
  })

  it.each(['deleted', '', null])('管理查询拒绝未知状态 %s', (status) => {
    expect(validateSync(plainToInstance(AdminLinkQuery, { status }), validation)).not.toHaveLength(0)
  })

  it.each(['name', 'description', 'url', 'status', 'isFeatured', 'sortOrder', 'requestId', 'revision'])(
    '%s 不能用 null 绕过校验',
    (field) => expect(validateLink({ [field]: null })).not.toHaveLength(0),
  )

  it.each([
    { name: ' ' },
    { name: '字'.repeat(81) },
    { description: '字'.repeat(301) },
    { url: '' },
    { url: 'a'.repeat(2049) },
    { logoUrl: ' ' },
    { logoUrl: 'a'.repeat(2049) },
    { logoMediaId: 'not-a-uuid' },
    { requestId: '12345678-1234-1123-a123-123456789abc' },
    { revision: -1 },
    { revision: 0.5 },
    { status: 'deleted' },
    { isFeatured: 'true' },
    { sortOrder: -1000001 },
    { sortOrder: 1000001 },
    { sortOrder: 0.5 },
  ])('拒绝非法管理字段 %j', (body) => expect(validateLink(body)).not.toHaveLength(0))

  it.each(['id', 'domain', 'publishedAt', 'createdAt', 'deletedAt', 'requestHash', 'logoMedia'])(
    '拒绝写入服务端字段 %s',
    (field) => expect(validateLink({ [field]: '不允许覆盖' })).not.toHaveLength(0),
  )

  it('名称和描述按 UTF-16 单位限制，支持边界值及零排序', () => {
    expect(validateLink({ name: '𠮷'.repeat(40), description: '𠮷'.repeat(150), sortOrder: 0 })).toEqual([])
    expect(validateLink({ name: '𠮷'.repeat(40) + '字' })).not.toHaveLength(0)
    expect(validateLink({ description: '𠮷'.repeat(150) + '字' })).not.toHaveLength(0)
    for (const sortOrder of [-1000000, 1000000]) expect(validateLink({ sortOrder })).toEqual([])
  })

  it('局部更新保留省略、显式清空和 false，不把创建标识或版本写入实体字段', () => {
    const body = plainToInstance(SaveLinkDto, {
      revision: 0,
      name: '  林间手记  ',
      description: '  ',
      logoMediaId: null,
      logoUrl: null,
      isFeatured: false,
      sortOrder: 0,
    })
    expect(validateLink(body)).toEqual([])
    expect(linkValues(body)).toEqual({
      name: '林间手记',
      description: '',
      logoMediaId: null,
      logoUrl: null,
      isFeatured: false,
      sortOrder: 0,
    })
    expect(linkValues({ revision: 0, requestId: mediaId, name: undefined })).toEqual({})
  })

  it('只在两种 Logo 来源同时有效时拒绝，允许不设置 Logo 或显式切换来源', () => {
    expect(() => linkValues({ logoMediaId: mediaId, logoUrl: 'https://example.com/logo.png' })).toThrow(
      BadRequestException,
    )
    expect(linkValues({ logoMediaId: mediaId, logoUrl: null })).toEqual({ logoMediaId: mediaId, logoUrl: null })
    expect(linkValues({ logoMediaId: null, logoUrl: 'HTTPS://EXAMPLE.COM:443/logo.png' })).toEqual({
      logoMediaId: null,
      logoUrl: 'https://example.com/logo.png',
    })
    expect(linkValues({})).toEqual({})
  })

  it('删除查询允许字符串版本零，拒绝缺失、负数与非整数版本', () => {
    const query = plainToInstance(LinkRevisionDto, { revision: '0' })
    expect(validateSync(query, validation)).toEqual([])
    expect(query.revision).toBe(0)
    for (const body of [{}, { revision: -1 }, { revision: 0.5 }, { revision: 'abc' }])
      expect(validateSync(plainToInstance(LinkRevisionDto, body), validation)).not.toHaveLength(0)
  })

  it('规则支持清空及最多十二项，并修剪空白、按 UTF-16 验证每项长度', () => {
    const body = plainToInstance(SaveLinkSettingsDto, { revision: 0, rules: Array(12).fill(` ${'𠮷'.repeat(150)} `) })
    expect(validateSync(body, validation)).toEqual([])
    expect(body.rules).toEqual(Array(12).fill('𠮷'.repeat(150)))
    expect(validateSync(plainToInstance(SaveLinkSettingsDto, { revision: 0, rules: [] }), validation)).toEqual([])
  })

  it.each([
    {},
    { revision: -1, rules: [] },
    { revision: 0.5, rules: [] },
    { revision: 0, rules: null },
    { revision: 0, rules: '一条规则' },
    { revision: 0, rules: [' '] },
    { revision: 0, rules: [1] },
    { revision: 0, rules: ['𠮷'.repeat(150) + '字'] },
    { revision: 0, rules: Array(13).fill('友好交流') },
  ])('拒绝非法友链规则 %j', (body) => {
    expect(validateSync(plainToInstance(SaveLinkSettingsDto, body), validation)).not.toHaveLength(0)
  })
})

describe('友链 URL 安全与规范化', () => {
  it.each([
    '',
    'example.com',
    '//example.com',
    'https:/example.com',
    'https:///example.com/image.png',
    'https:////example.com/image.png',
    'https://',
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///tmp/image.png',
    'ftp://example.com',
    'https://user@example.com',
    'https://user:password@example.com',
    'https://:password@example.com',
    'https://example.com/a b',
    'https://example.com/a\tb',
    'https://example.com/a\nb',
    'https://example.com/a\u0000b',
    'https://example.com/a\u007fb',
    'https://example.com/a\\b',
    'https://[broken]/',
    'https://example.com:65536/',
  ])('站点与 Logo 均拒绝危险或不完整地址 %j', (url) => {
    expect(() => linkUrl(url)).toThrow(BadRequestException)
    expect(() => linkLogoUrl(url)).toThrow(BadRequestException)
  })

  it('统一协议、主机与默认端口，保留路径大小写、尾斜杠、参数顺序、重复值和片段', () => {
    expect(linkUrl(' HTTPS://EXAMPLE.COM:443/Notes/?b=2&a=1&a=3#Part ')).toBe(
      'https://example.com/Notes/?b=2&a=1&a=3#Part',
    )
    expect(linkUrl('HTTP://EXAMPLE.COM:80')).toBe('http://example.com/')
    expect(linkUrl('https://example.com:8443/Notes%2FOne')).toBe('https://example.com:8443/Notes%2FOne')
    expect(linkUrl('https://example.com/Notes')).not.toBe(linkUrl('https://example.com/notes'))
    expect(linkUrl('https://example.com/Notes')).not.toBe(linkUrl('https://example.com/Notes/'))
  })

  it('规范化后长度上限为 2048，包含非 ASCII 字符编码扩张', () => {
    const prefix = 'https://example.com/'
    expect(linkUrl(prefix + 'a'.repeat(2048 - prefix.length))).toHaveLength(2048)
    expect(() => linkUrl(prefix + 'a'.repeat(2049 - prefix.length))).toThrow(BadRequestException)
    expect(() => linkUrl(prefix + '图'.repeat(226))).toThrow(BadRequestException)
  })

  it('站点允许 HTTP，外部 Logo 要求 HTTPS', () => {
    expect(linkUrl('http://example.com/')).toBe('http://example.com/')
    expect(() => linkLogoUrl('http://example.com/logo.png')).toThrow(BadRequestException)
    expect(linkLogoUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png')
  })

  it.each([
    `api/v1/media/${mediaId}.webp`,
    `api/v1/media/${mediaId.toUpperCase()}.webp`,
    `%2Fapi%2Fv1%2Fmedia%2F${mediaId}.webp`,
    `%252Fapi%252Fv1%252Fmedia%252F${mediaId}.webp`,
  ])('受管媒体路径不能伪装成外部 Logo：%s', (path) => {
    expect(() => linkLogoUrl(`https://example.com/${path}`)).toThrow(BadRequestException)
  })

  it.each([0, -1, 1.5, 2147483648, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Infinity])('拒绝非法友链编号 %s', (id) =>
    expect(() => linkId(id)).toThrow(BadRequestException),
  )

  it.each([1, 2147483647])('接受合法友链编号边界 %s', (id) => expect(() => linkId(id)).not.toThrow())
})
