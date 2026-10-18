/** @file project-write.dto.spec.ts @description 项目写入、标签、外链与删除版本的严格 DTO 边界。 */
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import {
  PROJECT_LINK_KINDS,
  PROJECT_PROGRESS,
  PROJECT_STATUSES,
  PROJECT_TAG_COLORS,
} from '../../entities/project.entity'
import { ProjectLinkDto, ProjectRevisionDto, ProjectTagDto, SaveProjectDto } from './project.dto'
import { projectUrl } from './project-values'

const uuid = '12345678-1234-4123-a123-123456789abc'
const tag = { label: 'Vue', color: 'emerald' }
const link = { kind: 'source', href: 'https://example.com/source' }

describe('项目写入 DTO', () => {
  it('接受局部更新、可清空封面与完整有效输入', () => {
    expectDtoValid(SaveProjectDto, {})
    expectDtoValid(SaveProjectDto, { title: '字' })
    expectDtoValid(SaveProjectDto, { coverMediaId: null, tags: [], links: [], relatedContent: [] })
    expectDtoValid(SaveProjectDto, {
      requestId: uuid,
      revision: 0,
      title: ' 我的项目 ',
      description: '',
      coverMediaId: uuid,
      tags: [tag],
      links: [link],
      progress: 'dev',
      status: 'draft',
      sortOrder: 0,
      relatedContent: [{ type: 'gallery', id: 1 }],
    })
  })

  it.each([
    ['title', 160],
    ['description', 5000],
  ] as const)('%s 接受长度上限并拒绝超限、错误类型与 null', (field, max) => {
    expectDtoValid(SaveProjectDto, { [field]: '字'.repeat(max) })
    expectDtoValid(SaveProjectDto, { [field]: '📷'.repeat(max / 2) })
    expectDtoInvalid(SaveProjectDto, { [field]: '字'.repeat(max + 1) }, field, 'maxUtf16Length')
    expectDtoInvalid(SaveProjectDto, { [field]: '📷'.repeat(max / 2) + '字' }, field, 'maxUtf16Length')
    for (const value of [123, null]) expectDtoInvalid(SaveProjectDto, { [field]: value }, field, 'isString')
  })

  it.each(['', '   '])('标题不接受 %j', (title) => expectDtoInvalid(SaveProjectDto, { title }, 'title', 'minLength'))
  it.each(PROJECT_STATUSES)('接受发布状态 %s', (status) => expectDtoValid(SaveProjectDto, { status }))
  it.each(PROJECT_PROGRESS)('接受项目进展 %s', (progress) => expectDtoValid(SaveProjectDto, { progress }))

  it.each([
    ['requestId', '', 'isUuid'],
    ['requestId', '12345678-1234-1123-a123-123456789abc', 'isUuid'],
    ['requestId', 1, 'isUuid'],
    ['requestId', null, 'isUuid'],
    ['coverMediaId', '', 'isUuid'],
    ['coverMediaId', 1, 'isUuid'],
    ['revision', -1, 'min'],
    ['revision', 0.5, 'isInt'],
    ['revision', '0', 'isInt'],
    ['revision', null, 'isInt'],
    ['status', 'all', 'isIn'],
    ['status', 1, 'isIn'],
    ['progress', 'published', 'isIn'],
    ['progress', 1, 'isIn'],
    ['sortOrder', -1000001, 'min'],
    ['sortOrder', 1000001, 'max'],
    ['sortOrder', 0.5, 'isInt'],
    ['sortOrder', '1', 'isInt'],
  ] as const)('拒绝 %s 的非法值 %j', (field, value, constraint) => {
    expectDtoInvalid(SaveProjectDto, { [field]: value }, field, constraint)
  })

  it('接受排序上下限并拒绝伪造外部计数和系统字段', () => {
    for (const sortOrder of [-1000000, 1000000]) expectDtoValid(SaveProjectDto, { sortOrder })
    for (const field of ['stars', 'forks', 'publishedAt', 'unknown'])
      expectDtoInvalid(SaveProjectDto, { [field]: 1 }, field, 'whitelistValidation')
  })

  it.each([
    ['tags', 20, tag],
    ['links', 4, link],
    ['relatedContent', 12, { type: 'post', id: 1 }],
  ] as const)('%s 限制数组容量、元素类型和嵌套未知字段', (field, max, value) => {
    expectDtoValid(SaveProjectDto, { [field]: Array(max).fill(value) })
    expectDtoInvalid(SaveProjectDto, { [field]: Array(max + 1).fill(value) }, field, 'arrayMaxSize')
    expectDtoInvalid(SaveProjectDto, { [field]: {} }, field, 'isArray')
    expectDtoInvalid(SaveProjectDto, { [field]: [1] }, `${field}.0`, 'nestedValidation')
    expectDtoInvalid(SaveProjectDto, { [field]: [[]] }, field, 'isObject')
    expectDtoInvalid(
      SaveProjectDto,
      { [field]: [{ ...value, unknown: true }] },
      `${field}.0.unknown`,
      'whitelistValidation',
    )
  })
})

describe('项目标签 DTO', () => {
  it.each(PROJECT_TAG_COLORS)('接受标签颜色 %s', (color) => expectDtoValid(ProjectTagDto, { ...tag, color }))

  it('名称接受一字符及 UTF-16 上限，拒绝空白和超长', () => {
    expectDtoValid(ProjectTagDto, { ...tag, label: '字' })
    expectDtoValid(ProjectTagDto, { ...tag, label: '📷'.repeat(20) })
    expectDtoInvalid(ProjectTagDto, { ...tag, label: ' ' }, 'label', 'minLength')
    expectDtoInvalid(ProjectTagDto, { ...tag, label: '📷'.repeat(20) + '字' }, 'label', 'maxUtf16Length')
    expectDtoInvalid(ProjectTagDto, { ...tag, label: 1 }, 'label', 'isString')
    expectDtoInvalid(ProjectTagDto, { ...tag, color: 'purple' }, 'color', 'isIn')
    expectDtoInvalid(ProjectTagDto, { ...tag, color: 1 }, 'color', 'isIn')
    expectDtoInvalid(ProjectTagDto, {}, 'label', 'isString')
    expectDtoInvalid(ProjectTagDto, {}, 'color', 'isIn')
    expectDtoInvalid(ProjectTagDto, { ...tag, unknown: true }, 'unknown', 'whitelistValidation')
  })
})

describe('项目链接 DTO 与协议边界', () => {
  it.each(PROJECT_LINK_KINDS)('接受用途 %s', (kind) => expectDtoValid(ProjectLinkDto, { ...link, kind }))

  it('长度、类型、用途和白名单分别校验', () => {
    expectDtoValid(ProjectLinkDto, { ...link, href: 'a' })
    expectDtoValid(ProjectLinkDto, { ...link, href: 'https://example.com/' + 'a'.repeat(2028) })
    expectDtoInvalid(ProjectLinkDto, { ...link, href: 'a'.repeat(2049) }, 'href', 'maxLength')
    expectDtoInvalid(ProjectLinkDto, { ...link, href: ' ' }, 'href', 'minLength')
    expectDtoInvalid(ProjectLinkDto, { ...link, href: 1 }, 'href', 'isString')
    expectDtoInvalid(ProjectLinkDto, { ...link, kind: 'website' }, 'kind', 'isIn')
    expectDtoInvalid(ProjectLinkDto, { ...link, kind: 1 }, 'kind', 'isIn')
    expectDtoInvalid(ProjectLinkDto, {}, 'href', 'isString')
    expectDtoInvalid(ProjectLinkDto, {}, 'kind', 'isIn')
    expectDtoInvalid(ProjectLinkDto, { ...link, unknown: true }, 'unknown', 'whitelistValidation')
  })

  // 协议语义沿用实际写入调用的纯函数，不另建 DTO 地址规范。
  it.each(['http://example.com/source', 'https://example.com/source'])('接受 HTTP(S) 地址 %s', (href) => {
    expectDtoValid(ProjectLinkDto, { ...link, href })
    expect(projectUrl(href)).toBe(href)
  })

  it.each([
    'javascript:alert(1)',
    'ftp://example.com/a',
    'file:///tmp/a',
    'data:text/plain,a',
    '//example.com/a',
    'https://user:password@example.com/a',
    'https://example.com/a b',
    'https://example.com/a\\b',
    'https://example.com/a\nb',
  ])('拒绝危险协议和非法地址 %j', (href) => {
    expect(() => projectUrl(href)).toThrow()
  })
})

describe('项目删除版本 DTO', () => {
  it('接受非负版本及查询数字字符串，拒绝缺失与未知字段', () => {
    expectDtoValid(ProjectRevisionDto, { revision: '0' })
    expectDtoValid(ProjectRevisionDto, { revision: 1 })
    expectDtoInvalid(ProjectRevisionDto, {}, 'revision', 'isInt')
    expectDtoInvalid(ProjectRevisionDto, { revision: 0, unknown: true }, 'unknown', 'whitelistValidation')
  })

  it.each([-1, 0.5, 'invalid', null, '', ' ', true, false])('拒绝非法版本 %j', (revision) => {
    expectDtoInvalid(ProjectRevisionDto, { revision }, 'revision', revision === -1 ? 'min' : 'isInt')
  })
})
