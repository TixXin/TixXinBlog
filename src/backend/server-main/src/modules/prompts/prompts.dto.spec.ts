/** @file prompts.dto.spec.ts @description 提示词写入 DTO 的完整长度、类型、枚举与严格白名单回归。 */
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { IMAGE_PROMPT_STATUSES } from '../../entities/image-prompt.entity'
import { SavePromptDto } from './prompts.dto'
import { promptSourceUrl, promptValues } from './prompts-values'

const uuid = '12345678-1234-4123-a123-123456789abc'

describe('图片提示词写入 DTO', () => {
  it('接受完整有效输入、局部更新以及明确清空的媒体来源', () => {
    expectDtoValid(SavePromptDto, {})
    expectDtoValid(SavePromptDto, { mediaId: null, externalImageUrl: null })
    expectDtoValid(SavePromptDto, {
      requestId: uuid,
      revision: 0,
      title: ' 夜间摄影 ',
      description: '',
      prompt: ' a quiet city ',
      negativePrompt: '',
      model: '',
      tags: [],
      mediaId: uuid,
      imageAlt: '',
      sourceUrl: '',
      status: 'draft',
    })
  })

  it.each([
    ['title', 160],
    ['description', 2000],
    ['prompt', 30000],
    ['negativePrompt', 10000],
    ['model', 80],
    ['externalImageUrl', 2048],
    ['imageAlt', 240],
    ['sourceUrl', 2048],
  ] as const)('%s 按 UTF-16 接受上限并拒绝超长或错误类型', (field, max) => {
    expectDtoValid(SavePromptDto, { [field]: '字'.repeat(max) })
    expectDtoValid(SavePromptDto, { [field]: '📷'.repeat(max / 2) })
    expectDtoInvalid(SavePromptDto, { [field]: '字'.repeat(max + 1) }, field, 'maxUtf16Length')
    expectDtoInvalid(SavePromptDto, { [field]: '📷'.repeat(max / 2) + '字' }, field, 'maxUtf16Length')
    expectDtoInvalid(SavePromptDto, { [field]: 1 }, field, 'isString')
  })

  it.each(['title', 'prompt'])('%s 保留一字符下限且拒绝空白', (field) => {
    expectDtoValid(SavePromptDto, { [field]: '字' })
    expectDtoInvalid(SavePromptDto, { [field]: '' }, field, 'minLength')
    expectDtoInvalid(SavePromptDto, { [field]: ' ' }, field, 'minLength')
  })

  it.each(['title', 'description', 'prompt', 'negativePrompt', 'model', 'imageAlt', 'sourceUrl'])(
    '%s 不允许 null 绕过校验',
    (field) => {
      expectDtoInvalid(SavePromptDto, { [field]: null }, field, 'isString')
    },
  )

  it.each(IMAGE_PROMPT_STATUSES)('接受发布状态 %s', (status) => expectDtoValid(SavePromptDto, { status }))

  it.each([
    ['requestId', 'not-a-uuid', 'isUuid'],
    ['requestId', '12345678-1234-1123-a123-123456789abc', 'isUuid'],
    ['requestId', 1, 'isUuid'],
    ['requestId', null, 'isUuid'],
    ['mediaId', '', 'isUuid'],
    ['mediaId', 1, 'isUuid'],
    ['revision', -1, 'min'],
    ['revision', 2147483648, 'max'],
    ['revision', 0.5, 'isInt'],
    ['revision', '0', 'isInt'],
    ['revision', null, 'isInt'],
    ['status', 'withdrawn', 'isIn'],
    ['status', 1, 'isIn'],
    ['status', null, 'isIn'],
    ['externalImageUrl', '', 'minLength'],
  ] as const)('拒绝 %s 的非法值 %j', (field, value, constraint) => {
    expectDtoInvalid(SavePromptDto, { [field]: value }, field, constraint)
  })

  it('接受版本上下限，拒绝伪造时间和图片尺寸等字段', () => {
    expectDtoValid(SavePromptDto, { revision: 0 })
    expectDtoValid(SavePromptDto, { revision: 2147483647 })
    for (const field of ['createdAt', 'publishedAt', 'width', 'height', 'unknown'])
      expectDtoInvalid(SavePromptDto, { [field]: 1 }, field, 'whitelistValidation')
  })

  it('标签数组接受零至十二项，每项一至三十二 UTF-16 单元', () => {
    expectDtoValid(SavePromptDto, { tags: [] })
    expectDtoValid(SavePromptDto, { tags: Array(12).fill('字') })
    expectDtoValid(SavePromptDto, { tags: ['📷'.repeat(16)] })
    expectDtoInvalid(SavePromptDto, { tags: Array(13).fill('字') }, 'tags', 'arrayMaxSize')
    expectDtoInvalid(SavePromptDto, { tags: ['📷'.repeat(16) + '字'] }, 'tags', 'maxUtf16Length')
    expectDtoInvalid(SavePromptDto, { tags: [''] }, 'tags', 'minLength')
    expectDtoInvalid(SavePromptDto, { tags: [' '] }, 'tags', 'minLength')
  })

  it.each([null, {}, 1, '标签'])('拒绝非数组标签 %j', (tags) => {
    expectDtoInvalid(SavePromptDto, { tags }, 'tags', 'isArray')
  })

  it.each([null, {}, 1, []].map((tag) => ({ tag })))('拒绝非字符串标签项 %j', ({ tag }) => {
    expectDtoInvalid(SavePromptDto, { tags: [tag] }, 'tags', 'isString')
  })
})

describe('图片提示词 URL 协议边界', () => {
  // 协议和地址安全由写入所用纯函数负责，DTO 负责字符串与长度限制。
  it.each(['http://example.com/image.png', 'https://example.com/image.png'])('接受 HTTP(S) 图片和来源 %s', (url) => {
    expectDtoValid(SavePromptDto, { externalImageUrl: url, sourceUrl: url })
    expect(promptValues({ externalImageUrl: url }).externalImageUrl).toBe(url)
    expect(promptSourceUrl(url)).toBe(url)
  })

  it('来源可以显式清空', () => {
    expectDtoValid(SavePromptDto, { sourceUrl: '' })
    expect(promptSourceUrl('')).toBe('')
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
  ])('图片和来源拒绝危险或不完整地址 %j', (url) => {
    expect(() => promptValues({ externalImageUrl: url })).toThrow()
    expect(() => promptSourceUrl(url)).toThrow()
  })
})
