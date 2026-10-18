/**
 * @file tabImportExport.test.ts
 * @description 标签页书签导入导出单元测试：Netscape HTML 解析与 JSON 导入导出
 * @author TixXin
 * @since 2026-07-20
 */

import { afterEach, describe, it, expect, vi } from 'vitest'
import { parseNetscapeBookmarks } from '../../app/features/tab/import-netscape'
import { buildExportJson, parseImportJson, triggerDownload, type TabExportFormat } from '../../app/features/tab/export'
import { MAX_BOOKMARKS, MAX_CATEGORIES, MAX_IMPORT_BYTES } from '../../app/features/tab/validation'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// 注：真实浏览器导出会带 `<DL><p>` 且 <DT> 不闭合，浏览器 HTML 解析器会自动容错修正；
// happy-dom 对这类非标准嵌套的树修正与浏览器不一致（<p> 不会在 <DT> 前自动闭合），
// 这里使用规范化的等价结构，聚焦验证分组遍历 / 归属 / icon 过滤逻辑本身
const SAMPLE_NETSCAPE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL>
  <DT><H3>开发</H3>
  <DL>
    <DT><A HREF="https://github.com" ICON="data:image/png;base64,AAA=">GitHub</A></DT>
    <DT><A HREF="https://developer.mozilla.org" ICON="https://mdn.dev/favicon.ico">MDN</A></DT>
  </DL>
  </DT>
  <DT><A HREF="https://example.com">顶层书签</A></DT>
</DL>`

describe('parseNetscapeBookmarks', () => {
  it('解析分组、书签与归属关系', () => {
    const result = parseNetscapeBookmarks(SAMPLE_NETSCAPE)

    expect(result.categories.map((c) => c.name)).toEqual(['导入', '开发'])
    expect(result.bookmarks).toHaveLength(3)

    const github = result.bookmarks.find((b) => b.name === 'GitHub')!
    expect(github.categoryName).toBe('开发')
    expect(github.url).toBe('https://github.com')

    const top = result.bookmarks.find((b) => b.name === '顶层书签')!
    expect(top.categoryName).toBe('导入')
  })

  it('仅保留 data: 协议的内联 icon，外链 icon 丢弃', () => {
    const result = parseNetscapeBookmarks(SAMPLE_NETSCAPE)

    expect(result.bookmarks.find((b) => b.name === 'GitHub')!.icon).toBe('data:image/png;base64,AAA=')
    expect(result.bookmarks.find((b) => b.name === 'MDN')!.icon).toBeUndefined()
  })

  it('缺少 DL 根节点时抛错', () => {
    expect(() => parseNetscapeBookmarks('<html><body>不是书签文件</body></html>')).toThrow('DL')
  })

  it('合并同名文件夹并保留嵌套分组归属，忽略没有地址的书签', () => {
    const result = parseNetscapeBookmarks(`<DL>
      <DT><H3>开发</H3><DL>
        <DT><H3>文档</H3><DL><DT><A HREF="https://vuejs.org">Vue</A></DT></DL></DT>
        <DT><A HREF="https://github.com">GitHub</A></DT>
      </DL></DT>
      <DT><H3>开发</H3><DL><DT><A HREF="https://nuxt.com">Nuxt</A></DT></DL></DT>
      <DT><A>没有地址</A></DT>
      <DT><A HREF="https://example.com"></A></DT>
    </DL>`)

    expect(result.categories.map((category) => category.name)).toEqual(['导入', '开发', '文档'])
    expect(result.bookmarks.map(({ name, categoryName }) => ({ name, categoryName }))).toEqual([
      { name: 'Vue', categoryName: '文档' },
      { name: 'GitHub', categoryName: '开发' },
      { name: 'Nuxt', categoryName: '开发' },
      { name: 'https://example.com', categoryName: '导入' },
    ])
  })
})

describe('buildExportJson / parseImportJson', () => {
  const payload: TabExportFormat = {
    version: 1,
    exportedAt: '2026-07-20T00:00:00Z',
    categories: [{ id: 'c1', userId: 'test', sortOrder: 0, name: '开发', icon: 'lucide:code', color: '#888888' }],
    bookmarks: [
      { id: 'b1', userId: 'test', sortOrder: 0, categoryId: 'c1', name: 'GitHub', url: 'https://github.com' },
    ],
  }

  it('导出后再导入可完整还原 categories / bookmarks', () => {
    const json = buildExportJson(payload)
    const parsed = parseImportJson(json)

    expect(parsed.version).toBe(1)
    expect(parsed.categories).toEqual(payload.categories)
    expect(parsed.bookmarks).toEqual(payload.bookmarks)
  })

  it('往返保留中文、可选字段与排序，不修改传入对象', () => {
    const original: TabExportFormat = {
      ...payload,
      user: { id: 'test', nickname: '博主' },
      categories: [{ ...payload.categories[0]!, sortOrder: 3, collapsed: true, description: '常用资料' }],
      bookmarks: [
        {
          ...payload.bookmarks[0]!,
          sortOrder: 7,
          description: '包含换行\n与 "引号" 的笔记',
          icon: 'lucide:code',
          color: '#abcdef',
          pinned: true,
          faviconUrl: 'https://github.com/favicon.ico',
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-18T00:00:00Z',
        },
      ],
    }
    const before = structuredClone(original)

    expect(parseImportJson(buildExportJson(original))).toEqual(before)
    expect(original).toEqual(before)
  })

  it.each(['分类 ID', '书签 ID'])('拒绝重复%s，避免导入后覆盖关系', (field) => {
    const duplicate = structuredClone(payload)
    if (field === '书签 ID') {
      duplicate.bookmarks.push({ ...duplicate.bookmarks[0]!, name: '另一个书签' })
    } else {
      duplicate.categories.push({
        ...duplicate.categories[0]!,
        name: '阅读',
      })
    }
    expect(() => parseImportJson(JSON.stringify(duplicate))).toThrow('重复')
  })

  it.each(['categories', 'bookmarks'] as const)('拒绝超过数量上限的%s', (field) => {
    const oversized = {
      ...payload,
      [field]: Array.from({ length: (field === 'categories' ? MAX_CATEGORIES : MAX_BOOKMARKS) + 1 }, () => null),
    }
    expect(() => parseImportJson(JSON.stringify(oversized))).toThrow('1000 个分类和 10000 个书签')
  })

  it('缺少 categories 或 bookmarks 字段时抛错', () => {
    expect(() => parseImportJson('{"version":1}')).toThrow('缺少')
    expect(() => parseImportJson('null')).toThrow()
  })

  it('非法 JSON 抛错', () => {
    expect(() => parseImportJson('{not-json')).toThrow()
  })

  it('拒绝未知版本、非法字段、危险协议和断开的分类引用', () => {
    expect(() => parseImportJson(JSON.stringify({ ...payload, version: 99 }))).toThrow('版本')
    for (const patch of [
      { name: 123 },
      { url: 'javascript:alert(1)' },
      { categoryId: 'missing' },
      { url: 'https://user:password@example.com' },
    ]) {
      const invalid = { ...payload, bookmarks: [{ ...payload.bookmarks[0], ...patch }] }
      expect(() => parseImportJson(JSON.stringify(invalid))).toThrow()
    }
  })

  it('浏览器 HTML 导入同样拒绝危险协议', () => {
    expect(() => parseNetscapeBookmarks('<DL><DT><A HREF="javascript:alert(1)">危险书签</A></DT></DL>')).toThrow('HTTP')
  })
})

describe('导入大小与浏览器下载', () => {
  it.each([
    ['JSON', parseImportJson],
    ['HTML', parseNetscapeBookmarks],
  ] as const)('%s 按 UTF-8 字节限制大小，而不是按字符数限制', (_format, parse) => {
    const raw = '中'.repeat(Math.floor(MAX_IMPORT_BYTES / 3) + 1)
    expect(raw.length).toBeLessThan(MAX_IMPORT_BYTES)
    expect(() => parse(raw)).toThrow('5 MB')
  })

  it('下载使用 JSON Blob 和指定文件名，移除临时链接并释放对象地址', async () => {
    const content = '{"书签":"开发资料"}'
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:tab-export')
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.isConnected).toBe(true)
    })
    vi.useFakeTimers()

    triggerDownload('我的书签.json', content)

    expect(click).toHaveBeenCalledTimes(1)
    const clicked = click.mock.contexts[0] as HTMLAnchorElement
    expect(clicked?.download).toBe('我的书签.json')
    expect(clicked?.href).toBe('blob:tab-export')
    expect(clicked?.isConnected).toBe(false)
    const blob = createUrl.mock.calls[0]![0] as Blob
    expect(blob.type).toBe('application/json')
    expect(await blob.text()).toBe(content)
    expect(revokeUrl).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:tab-export')
  })
})
