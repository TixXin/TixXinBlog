/** @file write-post.dto.spec.ts @description 文章、目录和批量写入 DTO 的长度、类型、枚举及严格白名单边界。 */
import { plainToInstance } from 'class-transformer'
import type { EntityManager } from '@mikro-orm/postgresql'
import { expectDtoInvalid, expectDtoValid } from '../../../common/testing/dto-validation'
import { AdminPostService } from '../admin-post.service'
import { SaveTaxonomyDto } from '../admin-taxonomy.controller'
import type { PostRevisionsService } from '../post-revisions.service'
import { ExecutePostBatchDto, PostSelectionDto, PreviewPostBatchDto } from './batch-post.dto'
import { ExpectedPostRevisionDto, SavePostDto } from './save-post.dto'

const post = { title: '秋日散步' }
const selection = { id: 1, revision: 0 }
const batch = { action: 'archive', items: [selection] }
const ticket = '12345678-1234-4234-8234-123456789abc'

describe('文章封面协议业务校验', () => {
  // URL 协议由保存入口检查；事务仅为桩，不运行回调或连接数据库。
  function service() {
    const transactional = jest.fn().mockResolvedValue(undefined)
    return {
      transactional,
      posts: new AdminPostService({ transactional } as unknown as EntityManager, {} as PostRevisionsService),
    }
  }

  it.each(['https://example.com/cover.webp', 'http://example.com/cover.webp', '/api/v1/media/cover.webp', ''])(
    '允许 HTTP(S)、站内路径或空封面：%s',
    async (cover) => {
      const { posts, transactional } = service()
      const input = plainToInstance(SavePostDto, { ...post, cover })
      expectDtoValid(SavePostDto, input)
      await posts.save(null, input)
      expect(transactional).toHaveBeenCalledTimes(1)
    },
  )

  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,AA==',
    'ftp://example.com/cover.webp',
    '//example.com/cover.webp',
  ])('进入事务前拒绝不允许的协议：%s', async (cover) => {
    const { posts, transactional } = service()
    await expect(posts.save(null, plainToInstance(SavePostDto, { ...post, cover }))).rejects.toThrow(
      '封面只允许 HTTP(S) 或站内路径',
    )
    expect(transactional).not.toHaveBeenCalled()
  })
})

describe('文章保存 DTO', () => {
  it('接受最小请求、默认值及规范化后的标题、专栏和 slug', () => {
    expectDtoValid(SavePostDto, post)
    const payload = { title: ' 秋日散步 ', folder: ' 随笔 ', slug: ' AUTUMN-WALK ' }
    expectDtoValid(SavePostDto, payload)
    expect(plainToInstance(SavePostDto, payload)).toMatchObject({
      title: '秋日散步',
      folder: '随笔',
      slug: 'autumn-walk',
      category: 'life',
      status: 'draft',
    })
    expectDtoInvalid(SavePostDto, {}, 'title', 'isString')
  })

  it.each([
    ['title', 1, 200],
    ['folder', 1, 64],
    ['summary', 0, 1000],
    ['contentRaw', 0, 200000],
    ['cover', 0, 2048],
    ['coverAlt', 0, 300],
    ['seoTitle', 0, 160],
    ['seoDescription', 0, 320],
  ] as const)('%s 接受长度端点并拒绝越界和非字符串', (field, minimum, maximum) => {
    for (const length of [minimum, maximum]) expectDtoValid(SavePostDto, { ...post, [field]: '文'.repeat(length) })
    expectDtoInvalid(SavePostDto, { ...post, [field]: '文'.repeat(maximum + 1) }, field, 'maxLength')
    if (minimum > 0) {
      for (const value of ['', '  ']) expectDtoInvalid(SavePostDto, { ...post, [field]: value }, field, 'minLength')
    }
    for (const value of [42, false, [], {}])
      expectDtoInvalid(SavePostDto, { ...post, [field]: value }, field, 'isString')
  })

  it('slug 接受空值与合法长度，拒绝非法格式和类型', () => {
    for (const slug of ['', 'a', 'a'.repeat(120), 'hello-2026']) expectDtoValid(SavePostDto, { ...post, slug })
    expectDtoInvalid(SavePostDto, { ...post, slug: 'a'.repeat(121) }, 'slug', 'maxLength')
    for (const slug of ['1hello', '-hello', 'hello--world', 'hello_', '中文']) {
      expectDtoInvalid(SavePostDto, { ...post, slug }, 'slug', 'matches')
    }
    expectDtoInvalid(SavePostDto, { ...post, slug: 1 }, 'slug', 'isString')
  })

  it.each([
    ['category', ['tech', 'life']],
    ['status', ['draft', 'published', 'archived']],
  ] as const)('%s 只接受契约枚举', (field, values) => {
    for (const value of values) expectDtoValid(SavePostDto, { ...post, [field]: value })
    for (const value of ['', 'unknown', 1, [], null])
      expectDtoInvalid(SavePostDto, { ...post, [field]: value }, field, 'isIn')
  })

  it.each(['pinned', 'seoNoindex'])('%s 拒绝字符串布尔值和其他类型', (field) => {
    for (const value of [true, false]) expectDtoValid(SavePostDto, { ...post, [field]: value })
    for (const value of ['false', 0, [], {}])
      expectDtoInvalid(SavePostDto, { ...post, [field]: value }, field, 'isBoolean')
  })

  it('阅读时长保留显式数字转换，限制为 1–300 的整数', () => {
    for (const readTimeMinutes of [1, 300, '10']) expectDtoValid(SavePostDto, { ...post, readTimeMinutes })
    expectDtoInvalid(SavePostDto, { ...post, readTimeMinutes: 0 }, 'readTimeMinutes', 'min')
    expectDtoInvalid(SavePostDto, { ...post, readTimeMinutes: 301 }, 'readTimeMinutes', 'max')
    for (const readTimeMinutes of [1.5, 'bad', {}, true, false, '', '  '])
      expectDtoInvalid(SavePostDto, { ...post, readTimeMinutes }, 'readTimeMinutes', 'isInt')
  })

  it('保存版本必须为非负整数且不隐式转换字符串', () => {
    expectDtoValid(SavePostDto, { ...post, revision: 0 })
    expectDtoInvalid(SavePostDto, { ...post, revision: -1 }, 'revision', 'min')
    for (const revision of [0.5, '0', true, {}])
      expectDtoInvalid(SavePostDto, { ...post, revision }, 'revision', 'isInt')
  })

  it('标签限制为 0–20 个唯一字符串，每项长 1–64', () => {
    expectDtoValid(SavePostDto, { ...post, tags: [] })
    expectDtoValid(SavePostDto, { ...post, tags: Array.from({ length: 20 }, (_, i) => `${i}`.padEnd(64, '文')) })
    expectDtoInvalid(
      SavePostDto,
      { ...post, tags: Array.from({ length: 21 }, (_, i) => `${i}`) },
      'tags',
      'arrayMaxSize',
    )
    expectDtoInvalid(SavePostDto, { ...post, tags: ['同名', '同名'] }, 'tags', 'arrayUnique')
    expectDtoInvalid(SavePostDto, { ...post, tags: [''] }, 'tags', 'minLength')
    expectDtoInvalid(SavePostDto, { ...post, tags: ['文'.repeat(65)] }, 'tags', 'maxLength')
    expectDtoInvalid(SavePostDto, { ...post, tags: [1] }, 'tags', 'isString')
    for (const tags of ['标签', {}, null]) expectDtoInvalid(SavePostDto, { ...post, tags }, 'tags', 'isArray')
  })

  it('关联数组上限为 12，并逐项检查类型和未知字段', () => {
    const relation = { type: 'post', id: 1 }
    expectDtoValid(SavePostDto, { ...post, relatedContent: [] })
    expectDtoValid(SavePostDto, {
      ...post,
      relatedContent: Array.from({ length: 12 }, (_, i) => ({ ...relation, id: i + 1 })),
    })
    expectDtoInvalid(
      SavePostDto,
      { ...post, relatedContent: Array(13).fill(relation) },
      'relatedContent',
      'arrayMaxSize',
    )
    for (const relatedContent of [null, {}, 'post'])
      expectDtoInvalid(SavePostDto, { ...post, relatedContent }, 'relatedContent', 'isArray')
    expectDtoInvalid(
      SavePostDto,
      { ...post, relatedContent: [{ ...relation, injected: true }] },
      'relatedContent.0.injected',
      'whitelistValidation',
    )
    expectDtoInvalid(
      SavePostDto,
      { ...post, relatedContent: [{ ...relation, id: '1' }] },
      'relatedContent.0.id',
      'isInt',
    )
    expectDtoInvalid(SavePostDto, { ...post, relatedContent: [[]] }, 'relatedContent', 'isObject')
  })

  it('拒绝客户端注入计数等多余字段', () => {
    expectDtoInvalid(SavePostDto, { ...post, likes: 999 }, 'likes', 'whitelistValidation')
  })
})

describe('文章版本与目录 DTO', () => {
  it('版本查询和恢复接受零及数字字符串，拒绝缺失、负数、小数和非法类型', () => {
    for (const revision of [0, 1, '0']) expectDtoValid(ExpectedPostRevisionDto, { revision })
    expectDtoInvalid(ExpectedPostRevisionDto, {}, 'revision', 'isInt')
    expectDtoInvalid(ExpectedPostRevisionDto, { revision: -1 }, 'revision', 'min')
    for (const revision of [0.1, 'bad', null, {}, true, false, '', '  '])
      expectDtoInvalid(ExpectedPostRevisionDto, { revision }, 'revision', 'isInt')
    expectDtoInvalid(ExpectedPostRevisionDto, { revision: 0, force: true }, 'force', 'whitelistValidation')
  })

  it('目录名去空白后为 1–64 字，颜色采用固定枚举', () => {
    for (const label of ['文', '文'.repeat(64)]) expectDtoValid(SaveTaxonomyDto, { label })
    expect(plainToInstance(SaveTaxonomyDto, { label: ' 随笔 ' }).label).toBe('随笔')
    expectDtoInvalid(SaveTaxonomyDto, {}, 'label', 'isString')
    for (const label of ['', '  ']) expectDtoInvalid(SaveTaxonomyDto, { label }, 'label', 'minLength')
    expectDtoInvalid(SaveTaxonomyDto, { label: '文'.repeat(65) }, 'label', 'maxLength')
    for (const label of [1, [], {}, null]) expectDtoInvalid(SaveTaxonomyDto, { label }, 'label', 'isString')
    for (const color of ['emerald', 'rose', 'sky', 'orange', 'blue', 'amber'])
      expectDtoValid(SaveTaxonomyDto, { label: '随笔', color })
    for (const color of ['red', '', 1, []]) expectDtoInvalid(SaveTaxonomyDto, { label: '随笔', color }, 'color', 'isIn')
    expectDtoInvalid(SaveTaxonomyDto, { label: '随笔', count: 100 }, 'count', 'whitelistValidation')
  })
})

describe('文章批量操作 DTO', () => {
  it('单项选择要求正整数编号和非负版本', () => {
    expectDtoValid(PostSelectionDto, selection)
    for (const field of ['id', 'revision']) {
      expectDtoInvalid(PostSelectionDto, {}, field, 'isInt')
      expectDtoInvalid(PostSelectionDto, { ...selection, [field]: -1 }, field, 'min')
      for (const value of [0.5, '1', true, null, []])
        expectDtoInvalid(PostSelectionDto, { ...selection, [field]: value }, field, 'isInt')
    }
    expectDtoInvalid(PostSelectionDto, { ...selection, id: 0 }, 'id', 'min')
    expectDtoInvalid(PostSelectionDto, { ...selection, force: true }, 'force', 'whitelistValidation')
  })

  it('预览限制为 1–50 个唯一编号，并验证嵌套字段', () => {
    expectDtoValid(PreviewPostBatchDto, batch)
    expectDtoValid(PreviewPostBatchDto, {
      ...batch,
      items: Array.from({ length: 50 }, (_, i) => ({ ...selection, id: i + 1 })),
    })
    expectDtoInvalid(PreviewPostBatchDto, { ...batch, items: [] }, 'items', 'arrayMinSize')
    expectDtoInvalid(
      PreviewPostBatchDto,
      { ...batch, items: Array.from({ length: 51 }, (_, i) => ({ ...selection, id: i + 1 })) },
      'items',
      'arrayMaxSize',
    )
    expectDtoInvalid(
      PreviewPostBatchDto,
      { ...batch, items: [selection, { ...selection, revision: 2 }] },
      'items',
      'arrayUnique',
    )
    for (const items of [null, {}, '1']) expectDtoInvalid(PreviewPostBatchDto, { ...batch, items }, 'items', 'isArray')
    expectDtoInvalid(PreviewPostBatchDto, { ...batch, items: [{ id: 0, revision: 0 }] }, 'items.0.id', 'min')
    expectDtoInvalid(
      PreviewPostBatchDto,
      { ...batch, items: [{ ...selection, force: true }] },
      'items.0.force',
      'whitelistValidation',
    )
    expectDtoInvalid(PreviewPostBatchDto, { ...batch, items: [[]] }, 'items', 'isObject')
    expectDtoInvalid(PreviewPostBatchDto, { ...batch, force: true }, 'force', 'whitelistValidation')
  })

  it('预览只接受固定动作', () => {
    for (const action of ['withdraw', 'archive', 'trash', 'restore', 'delete'])
      expectDtoValid(PreviewPostBatchDto, { ...batch, action })
    for (const action of ['publish', '', 1, null])
      expectDtoInvalid(PreviewPostBatchDto, { ...batch, action }, 'action', 'isIn')
  })

  it('执行凭据必须是 UUID v4，确认文字最长 32 字', () => {
    for (const acknowledgement of [undefined, '', '文'.repeat(32)])
      expectDtoValid(ExecutePostBatchDto, { ticket, acknowledgement })
    for (const value of [undefined, '', 1, '12345678-1234-1234-8234-123456789abc'])
      expectDtoInvalid(ExecutePostBatchDto, { ticket: value }, 'ticket', 'isUuid')
    expectDtoInvalid(ExecutePostBatchDto, { ticket, acknowledgement: '文'.repeat(33) }, 'acknowledgement', 'maxLength')
    expectDtoInvalid(ExecutePostBatchDto, { ticket, acknowledgement: true }, 'acknowledgement', 'isString')
    expectDtoInvalid(ExecutePostBatchDto, { ticket, action: 'delete' }, 'action', 'whitelistValidation')
  })
})
