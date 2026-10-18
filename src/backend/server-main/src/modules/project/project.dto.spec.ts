/** @file project.dto.spec.ts @description 项目查询与管理保存的字段、嵌套集合及只读属性校验 */
import 'reflect-metadata'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { AdminProjectQuery, ProjectQuery, SaveProjectDto } from './project.dto'

describe('项目查询 DTO', () => {
  it('默认每页十二条，转换分页参数并裁剪搜索与标签首尾空白', () => {
    const defaults = plainToInstance(ProjectQuery, {})
    expect(defaults).toMatchObject({ page: 1, pageSize: 12 })
    expect(validateSync(defaults)).toEqual([])
    const query = plainToInstance(ProjectQuery, {
      page: '10000',
      pageSize: '48',
      q: '  编辑器  ',
      tag: '  TypeScript  ',
      progress: 'archived',
    })
    expect(query).toMatchObject({ page: 10000, pageSize: 48, q: '编辑器', tag: 'TypeScript', progress: 'archived' })
    expect(validateSync(query)).toEqual([])
  })

  it.each([
    ['page', '0'],
    ['page', '10001'],
    ['page', '1.5'],
    ['page', 'abc'],
    ['pageSize', '0'],
    ['pageSize', '49'],
    ['pageSize', '1.5'],
    ['q', '字'.repeat(201)],
    ['q', null],
    ['tag', '  '],
    ['tag', '字'.repeat(41)],
    ['tag', null],
    ['progress', 'published'],
  ])('拒绝超出契约的 %s 查询参数', (field, value) => {
    expect(validateSync(plainToInstance(ProjectQuery, { [field]: value }))).toEqual([
      expect.objectContaining({ property: field }),
    ])
  })

  it('管理查询的发布状态与项目进展各自校验', () => {
    for (const status of ['all', 'draft', 'published', 'withdrawn']) {
      expect(validateSync(plainToInstance(AdminProjectQuery, { status, progress: 'archived' }))).toEqual([])
    }
    expect(validateSync(plainToInstance(AdminProjectQuery, { status: 'active' }))).toEqual([
      expect.objectContaining({ property: 'status' }),
    ])
  })
})

describe('项目保存 DTO', () => {
  it('允许省略字段、明确清空封面及集合，并裁剪文本和嵌套字段', () => {
    expect(validateSync(plainToInstance(SaveProjectDto, {}))).toEqual([])
    const input = plainToInstance(SaveProjectDto, {
      revision: 0,
      title: '  桌面编辑器  ',
      description: '  离线写作工具  ',
      coverMediaId: null,
      tags: [{ label: '  TypeScript  ', color: 'sky' }],
      links: [{ kind: 'source', href: '  https://example.com/source  ' }],
    })
    expect(validateSync(input)).toEqual([])
    expect(input).toMatchObject({
      title: '桌面编辑器',
      description: '离线写作工具',
      coverMediaId: null,
      tags: [{ label: 'TypeScript', color: 'sky' }],
      links: [{ kind: 'source', href: 'https://example.com/source' }],
    })
    expect(input.status).toBeUndefined()
    expect(input.progress).toBeUndefined()
    expect(validateSync(plainToInstance(SaveProjectDto, { revision: 1, tags: [], links: [] }))).toEqual([])
  })

  it('三种进展均可配合任一发布状态', () => {
    for (const progress of ['active', 'dev', 'archived']) {
      for (const status of ['draft', 'published', 'withdrawn']) {
        expect(validateSync(plainToInstance(SaveProjectDto, { progress, status }))).toEqual([])
      }
    }
  })

  it('接受二十项标签、四种链接、UUID 及排序边界', () => {
    for (const sortOrder of [-1000000, 1000000]) {
      const input = plainToInstance(SaveProjectDto, {
        title: '桌面编辑器',
        requestId: '87654321-4321-4321-b321-cba987654321',
        coverMediaId: '12345678-1234-4123-a123-123456789abc',
        tags: Array.from({ length: 20 }, (_, index) => ({ label: `技术 ${index + 1}`, color: 'sky' })),
        links: ['source', 'demo', 'docs', 'download'].map((kind) => ({ kind, href: `https://example.com/${kind}` })),
        sortOrder,
      })
      expect(validateSync(input)).toEqual([])
    }
  })

  it.each(['title', 'description', 'tags', 'links', 'progress', 'status', 'sortOrder', 'revision', 'requestId'])(
    '%s 不接受 null 绕过保存校验',
    (field) => {
      expect(validateSync(plainToInstance(SaveProjectDto, { [field]: null }))).toEqual([
        expect.objectContaining({ property: field }),
      ])
    },
  )

  it.each([
    ['title', '  '],
    ['coverMediaId', 'not-a-uuid'],
    ['requestId', '12345678-1234-1123-a123-123456789abc'],
    ['revision', -1],
    ['revision', 1.5],
    ['sortOrder', 1000001],
    ['sortOrder', -1000001],
    ['status', 'archived'],
    ['progress', 'published'],
    ['tags', Array(21).fill({ label: 'Vue', color: 'sky' })],
    ['tags', [{ label: '  ', color: 'sky' }]],
    ['tags', [{ label: 'Vue', color: 'purple' }]],
    ['tags', [{ label: 123, color: 'sky' }]],
    ['links', Array(5).fill({ kind: 'source', href: 'https://example.com' })],
    ['links', [{ kind: 'website', href: 'https://example.com' }]],
    ['links', [{ kind: 'source', href: '  ' }]],
    ['links', [{ kind: 'source', href: 'x'.repeat(2049) }]],
  ])('拒绝非法保存字段 %s', (field, value) => {
    expect(validateSync(plainToInstance(SaveProjectDto, { [field]: value }))).toEqual([
      expect.objectContaining({ property: field }),
    ])
  })

  it.each(['width', 'height', 'publishedAt', 'deletedAt', 'requestHash', 'stars', 'forks'])(
    '请求白名单禁止客户端伪造 %s',
    async (field) => {
      const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
      await expect(
        pipe.transform({ title: '桌面编辑器', [field]: '伪造值' }, { type: 'body', metatype: SaveProjectDto }),
      ).rejects.toBeInstanceOf(BadRequestException)
    },
  )
})
