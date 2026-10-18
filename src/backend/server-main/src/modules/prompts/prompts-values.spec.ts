/** @file prompts-values.spec.ts @description 提示词输入边界、局部更新和地址安全回归 */
import { BadRequestException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { AdminPromptQuery, PromptQuery, SavePromptDto } from './prompts.dto'
import { promptId, promptSourceUrl, promptValues, promptWhere } from './prompts-values'

describe('图片提示词边界', () => {
  it.each([
    'title',
    'description',
    'prompt',
    'negativePrompt',
    'model',
    'tags',
    'imageAlt',
    'sourceUrl',
    'status',
    'requestId',
    'revision',
  ])('%s 不接受 null 绕过校验', (field) =>
    expect(validateSync(plainToInstance(SavePromptDto, { [field]: null }))).not.toHaveLength(0),
  )

  it('保留局部更新省略语义，媒体来源允许显式清空', () => {
    const body = plainToInstance(SavePromptDto, { revision: 0, description: '  补充说明  ', mediaId: null })
    expect(validateSync(body)).toHaveLength(0)
    expect(promptValues(body)).toEqual({ description: '补充说明', mediaId: null })
    expect(promptValues(plainToInstance(SavePromptDto, { revision: 1 }))).toEqual({})
  })

  it('按首个拼写去重标签并保留提示词内部换行', () => {
    const body = plainToInstance(SavePromptDto, {
      tags: [' Editorial ', 'editorial', '夜色'],
      prompt: '  第一行\n  second line  ',
    })
    expect(validateSync(body)).toHaveLength(0)
    expect(promptValues(body)).toEqual({ tags: ['Editorial', '夜色'], prompt: '第一行\n  second line' })
  })

  it.each([
    { title: ' ' },
    { prompt: ' ' },
    { tags: [' '] },
    { tags: [123] },
    { tags: Array(13).fill('标签') },
    { title: '📷'.repeat(81) },
    { tags: ['📷'.repeat(17)] },
    { prompt: '字'.repeat(30001) },
    { externalImageUrl: '' },
    { revision: 0.5 },
    { status: 'withdrawn' },
  ])('拒绝非法字段 %j', (body) => {
    expect(validateSync(plainToInstance(SavePromptDto, body))).not.toHaveLength(0)
  })

  it.each([
    'javascript:alert(1)',
    'file:///tmp/a.png',
    '//example.com/a',
    'https://user:password@example.com/a',
    'https://example.com/a b',
    'https://example.com/a\\b',
    'https://example.com/a\n.png',
  ])('拒绝危险或不完整图片和来源 %s', (url) => {
    expect(() => promptValues({ externalImageUrl: url })).toThrow()
    expect(() => promptSourceUrl(url)).toThrow()
  })

  it('外部图片保留编码语义，来源链接规范化，受管媒体不允许伪装成外链', () => {
    const external = 'https://example.com/image%2F1.png?a=1&a=2#preview'
    expect(promptValues({ externalImageUrl: external, sourceUrl: ' HTTPS://EXAMPLE.COM:443/Work ' })).toEqual({
      externalImageUrl: external,
      sourceUrl: 'https://example.com/Work',
    })
    expect(promptSourceUrl('')).toBe('')
    expect(() =>
      promptValues({ externalImageUrl: 'https://example.com/api/v1/media/12345678-1234-4123-a123-123456789abc.webp' }),
    ).toThrow()
  })

  it('公开查询不能绕过草稿过滤，百分号与下划线按字面搜索', () => {
    const query = plainToInstance(AdminPromptQuery, { q: '100%_完成', model: 'Flux_1', status: 'draft' })
    const where = promptWhere(query)
    expect(where).toMatchObject({
      status: 'published',
      model: { $ilike: 'Flux\\_1' },
      $or: expect.arrayContaining([{ title: { $ilike: '%100\\%\\_完成%' } }]),
    })
    expect(promptWhere(query, true)).toMatchObject({ status: 'draft' })
    expect(validateSync(plainToInstance(PromptQuery, { pageSize: 49, page: 0 }))).toHaveLength(2)
  })

  it.each([0, -1, 1.5, 2147483648, Number.NaN])('拒绝非法编号 %s', (id) => expect(() => promptId(id)).toThrow())
})

describe('提示词管理字段与查询契约', () => {
  const validation = { whitelist: true, forbidNonWhitelisted: true }

  it.each([
    ['title', 160],
    ['description', 2000],
    ['prompt', 30000],
    ['negativePrompt', 10000],
    ['model', 80],
    ['imageAlt', 240],
  ] as const)('%s 按 UTF-16 单位接受长度边界并拒绝超限', (field, limit) => {
    const value = '𠮷'.repeat(limit / 2)
    expect(validateSync(plainToInstance(SavePromptDto, { [field]: value }), validation)).toEqual([])
    expect(validateSync(plainToInstance(SavePromptDto, { [field]: value + '字' }), validation)).not.toHaveLength(0)
  })

  it.each(['id', 'publishedAt', 'createdAt', 'updatedAt', 'requestHash', 'media', 'width', 'height'])(
    '管理写入拒绝服务端字段 %s',
    (field) => {
      expect(validateSync(plainToInstance(SavePromptDto, { [field]: '禁止覆盖' }), validation)).not.toHaveLength(0)
    },
  )

  it.each([
    { requestId: '12345678-1234-1123-a123-123456789abc' },
    { mediaId: 'not-a-uuid' },
    { revision: -1 },
    { revision: 2147483648 },
    { sourceUrl: 'a'.repeat(2049) },
    { externalImageUrl: 'a'.repeat(2049) },
  ])('拒绝非法标识、版本或过长地址 %j', (body) => {
    expect(validateSync(plainToInstance(SavePromptDto, body), validation)).not.toHaveLength(0)
  })

  it('接受十二项边界标签和最大版本，保留清空文本、标签与图片来源的语义', () => {
    expect(
      validateSync(plainToInstance(SavePromptDto, { revision: 2147483647, tags: Array(12).fill('𠮷'.repeat(16)) })),
    ).toEqual([])
    const body = plainToInstance(SavePromptDto, {
      revision: 0,
      description: ' ',
      negativePrompt: ' ',
      model: ' ',
      imageAlt: ' ',
      sourceUrl: ' ',
      tags: [],
      mediaId: null,
      externalImageUrl: null,
    })
    expect(validateSync(body, validation)).toEqual([])
    expect(promptValues(body)).toEqual({
      description: '',
      negativePrompt: '',
      model: '',
      imageAlt: '',
      sourceUrl: '',
      tags: [],
      mediaId: null,
      externalImageUrl: null,
    })
  })

  it.each([{ title: ' ' }, { prompt: ' ' }, { tags: [' '] }])('规范化也拒绝空必填文本 %j', (body) => {
    expect(() => promptValues(body)).toThrow(BadRequestException)
  })

  it('查询使用默认分页并转换数字，修剪组合搜索字段', () => {
    expect(plainToInstance(PromptQuery, {})).toEqual({ page: 1, pageSize: 12 })
    const query = plainToInstance(PromptQuery, {
      page: '2',
      pageSize: '48',
      q: '  夜色  ',
      model: ' Flux ',
      tag: ' Film ',
    })
    expect(validateSync(query, validation)).toEqual([])
    expect(query).toEqual({ page: 2, pageSize: 48, q: '夜色', model: 'Flux', tag: 'Film' })
  })

  it.each([
    { page: 10001 },
    { page: 1.5 },
    { pageSize: 0 },
    { pageSize: 'abc' },
    { q: '字'.repeat(201) },
    { q: null },
    { model: ' ' },
    { model: '𠮷'.repeat(41) },
    { tag: ' ' },
    { tag: '𠮷'.repeat(17) },
    { status: 'draft' },
  ])('公开查询拒绝越界及管理状态 %j', (query) => {
    expect(validateSync(plainToInstance(PromptQuery, query), validation)).not.toHaveLength(0)
  })

  it.each(['all', 'draft', 'published'])('仅管理查询允许状态 %s', (status) => {
    expect(validateSync(plainToInstance(AdminPromptQuery, { status }), validation)).toEqual([])
  })

  it.each(['withdrawn', '', null])('管理查询拒绝非法状态 %s', (status) => {
    expect(validateSync(plainToInstance(AdminPromptQuery, { status }), validation)).not.toHaveLength(0)
  })

  it.each([1, 2147483647])('接受合法提示词编号边界 %s', (id) => expect(() => promptId(id)).not.toThrow())
})

describe('提示词 URL 安全补充', () => {
  it.each([
    'https:///example.com/image.png',
    'https://',
    'https://[broken]/image.png',
    'https://:password@example.com/image.png',
    'https://example.com:65536/image.png',
    'https://example.com/a\u0000b',
    'https://example.com/a\u007fb',
    'https://example.com/a\tb',
  ])('图片与来源均拒绝非法地址 %j', (url) => {
    expect(() => promptValues({ externalImageUrl: url })).toThrow(BadRequestException)
    expect(() => promptSourceUrl(url)).toThrow(BadRequestException)
  })

  it('来源允许清空与 HTTP，规范化时保留路径、参数和片段的区别', () => {
    expect(promptSourceUrl('  ')).toBe('')
    expect(promptSourceUrl(' HTTP://EXAMPLE.COM:80/Work/?b=2&a=1&a=3#Part ')).toBe(
      'http://example.com/Work/?b=2&a=1&a=3#Part',
    )
    expect(promptSourceUrl('https://example.com/Work')).not.toBe(promptSourceUrl('https://example.com/work/'))
  })

  it('外部图片保留完整地址及编码，HTTP 与 HTTPS 都可登记', () => {
    const url = 'HTTP://EXAMPLE.COM:80/Work%2FOne.png?b=2&a=1&a=3#Part'
    expect(promptValues({ externalImageUrl: url })).toEqual({ externalImageUrl: url })
    expect(() => promptValues({ externalImageUrl: ' https://example.com/image.png ' })).toThrow(BadRequestException)
  })

  it('图片原地址与来源规范化后的地址分别限制 2048 字符', () => {
    const prefix = 'https://example.com/'
    const boundary = prefix + 'a'.repeat(2048 - prefix.length)
    expect(promptValues({ externalImageUrl: boundary })).toEqual({ externalImageUrl: boundary })
    expect(promptSourceUrl(boundary)).toBe(boundary)
    expect(() => promptValues({ externalImageUrl: boundary + 'a' })).toThrow(BadRequestException)
    expect(() => promptSourceUrl(boundary + 'a')).toThrow(BadRequestException)
    expect(() => promptSourceUrl(prefix + '图'.repeat(226))).toThrow(BadRequestException)
  })

  it.each([
    '/api/v1/media/12345678-1234-4123-A123-123456789ABC.webp',
    '%2Fapi%2Fv1%2Fmedia%2F12345678-1234-4123-a123-123456789abc.webp',
    '%252Fapi%252Fv1%252Fmedia%252F12345678-1234-4123-a123-123456789abc.webp',
  ])('不能用大小写或编码绕过受管图片引用 %s', (path) => {
    expect(() => promptValues({ externalImageUrl: `https://example.com/${path}` })).toThrow(BadRequestException)
  })
})
