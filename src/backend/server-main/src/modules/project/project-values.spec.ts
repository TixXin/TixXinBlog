/** @file project-values.spec.ts @description 项目外链、标签去重、局部更新及编号边界回归 */
import { BadRequestException } from '@nestjs/common'
import { PROJECT_LINK_KINDS } from '../../entities/project.entity'
import type { SaveProjectDto } from './project.dto'
import { projectId, projectUrl, projectValues } from './project-values'

describe('项目外链校验', () => {
  it.each([
    [' HTTPS://EXAMPLE.COM:443/Work/ ', 'https://example.com/Work/'],
    ['HTTP://EXAMPLE.COM:80/Work', 'http://example.com/Work'],
    ['https://example.com:8443/Work', 'https://example.com:8443/Work'],
    ['https://example.com', 'https://example.com/'],
    ['https://example.com/路径', 'https://example.com/%E8%B7%AF%E5%BE%84'],
    ['https://example.com/Work%2fOne?a=2&a=1&b=%2B#Preview', 'https://example.com/Work%2fOne?a=2&a=1&b=%2B#Preview'],
  ])('规范化协议、主机和默认端口并保留路径与查询语义：%s', (input, expected) => {
    expect(projectUrl(input)).toBe(expected)
  })

  it.each([
    '',
    '#',
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///tmp/project',
    'ftp://example.com/project',
    '//example.com/project',
    '/project',
    'example.com/project',
    'https:example.com/project',
    'https:/example.com/project',
    'https:///example.com/project',
    'https://',
    'https://[invalid]/project',
    'https://example.com:invalid/project',
    'https://user:password@example.com/project',
    'https://user@example.com/project',
  ])('拒绝危险、不完整、畸形或带凭据地址：%s', (url) => {
    expect(() => projectUrl(url)).toThrow(BadRequestException)
  })

  it.each([' ', '\t', '\n', '\r', '\u0000', '\u001f', '\u007f', '\\'])(
    '拒绝内部空白、控制字符或反斜杠 %j',
    (character) => {
      expect(() => projectUrl(`https://example.com/project${character}/docs`)).toThrow(BadRequestException)
    },
  )

  it('规范化后允许恰好 2048 个字符，拒绝超过限制的地址', () => {
    const prefix = 'https://example.com/'
    const url = prefix + 'a'.repeat(2048 - prefix.length)
    expect(projectUrl(url)).toBe(url)
    expect(() => projectUrl(`${url}a`)).toThrow('规范化后的项目链接不能超过2048个字符')
  })

  it('编码膨胀后的地址仍受长度限制', () => {
    const url = `https://example.com/${'中'.repeat(226)}`
    expect(url.length).toBeLessThan(2048)
    expect(() => projectUrl(url)).toThrow('规范化后的项目链接不能超过2048个字符')
  })
})

describe('项目保存值规范化', () => {
  it('标签去除首尾空白并忽略大小写去重，保留首项写法、颜色与顺序', () => {
    const input: SaveProjectDto = {
      tags: [
        { label: ' TypeScript ', color: 'blue' },
        { label: 'typescript', color: 'rose' },
        { label: ' Vue ', color: 'emerald' },
        { label: 'TYPESCRIPT', color: 'amber' },
        { label: ' 中文 ', color: 'sky' },
        { label: 'vue', color: 'slate' },
      ],
    }
    expect(projectValues(input)).toEqual({
      tags: [
        { label: 'TypeScript', color: 'blue' },
        { label: 'Vue', color: 'emerald' },
        { label: '中文', color: 'sky' },
      ],
    })
    expect(input.tags).toHaveLength(6)
    expect(input.tags?.[0]).toEqual({ label: ' TypeScript ', color: 'blue' })
  })

  it.each(['', ' ', '\t\n'])('拒绝修剪后为空的标签：%j', (label) => {
    expect(() => projectValues({ tags: [{ label, color: 'blue' }] })).toThrow('技术标签名称不能为空')
  })

  it.each(PROJECT_LINK_KINDS)('拒绝重复的 %s 用途，即使地址不同', (kind) => {
    expect(() =>
      projectValues({
        links: [
          { kind, href: 'https://example.com/first' },
          { kind, href: 'https://example.com/second' },
        ],
      }),
    ).toThrow('同一种项目链接只能填写一个地址')
  })

  it('不同用途可共用同一地址，保存时分别规范化且不改写输入', () => {
    const input: SaveProjectDto = {
      links: PROJECT_LINK_KINDS.map((kind) => ({ kind, href: ' HTTPS://EXAMPLE.COM:443/Work ' })),
    }
    expect(projectValues(input)).toEqual({
      links: PROJECT_LINK_KINDS.map((kind) => ({ kind, href: 'https://example.com/Work' })),
    })
    expect(input.links?.[0]?.href).toBe(' HTTPS://EXAMPLE.COM:443/Work ')
  })

  it('链接安全校验在保存值规范化时同样执行', () => {
    expect(() => projectValues({ links: [{ kind: 'demo', href: 'javascript:alert(1)' }] })).toThrow(BadRequestException)
  })

  it('局部更新不携带省略值或提交控制字段，显式空值和零值可保留', () => {
    expect(
      projectValues({
        requestId: '12345678-1234-4123-a123-123456789abc',
        revision: 3,
        title: '星图',
        description: '',
        sortOrder: 0,
        coverMediaId: null,
        tags: undefined,
        links: undefined,
        progress: undefined,
        relatedContent: undefined,
      }),
    ).toEqual({ title: '星图', description: '', sortOrder: 0, coverMediaId: null })
    expect(projectValues({ requestId: '12345678-1234-4123-a123-123456789abc', revision: 0 })).toEqual({})
  })

  it('显式空数组清空标签、链接和关联，不被当成省略字段', () => {
    expect(projectValues({ tags: [], links: [], relatedContent: [] })).toEqual({
      tags: [],
      links: [],
      relatedContent: [],
    })
  })

  it('关联按类型和编号去重并保留原始顺序', () => {
    expect(
      projectValues({
        relatedContent: [
          { type: 'gallery', id: 3 },
          { type: 'post', id: 3 },
          { type: 'gallery', id: 3 },
        ],
      }),
    ).toEqual({
      relatedContent: [
        { type: 'gallery', id: 3 },
        { type: 'post', id: 3 },
      ],
    })
  })
})

describe('项目编号边界', () => {
  it.each([1, 2147483647])('接受正整数数据库编号边界 %s', (id) => {
    expect(() => projectId(id)).not.toThrow()
  })

  it.each([0, -1, 1.5, 2147483648, Number.MAX_SAFE_INTEGER, Number.NaN, Infinity, -Infinity])(
    '拒绝不合法或超出数据库整数范围的编号 %s',
    (id) => {
      expect(() => projectId(id)).toThrow('项目编号不合法')
    },
  )
})
