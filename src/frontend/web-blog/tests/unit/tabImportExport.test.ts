/**
 * @file tabImportExport.test.ts
 * @description 标签页书签导入导出单元测试：Netscape HTML 解析与 JSON 导入导出
 * @author TixXin
 * @since 2026-07-20
 */

import { describe, it, expect } from 'vitest'
import { parseNetscapeBookmarks } from '../../app/features/tab/import-netscape'
import { buildExportJson, parseImportJson, type TabExportFormat } from '../../app/features/tab/export'

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
})

describe('buildExportJson / parseImportJson', () => {
  const payload: TabExportFormat = {
    version: 1,
    exportedAt: '2026-07-20T00:00:00Z',
    categories: [{ id: 'c1', name: '开发', icon: 'lucide:code', color: '#888888' } as never],
    bookmarks: [{ id: 'b1', categoryId: 'c1', name: 'GitHub', url: 'https://github.com' } as never],
  }

  it('导出后再导入可完整还原 categories / bookmarks', () => {
    const json = buildExportJson(payload)
    const parsed = parseImportJson(json)

    expect(parsed.version).toBe(1)
    expect(parsed.categories).toEqual(payload.categories)
    expect(parsed.bookmarks).toEqual(payload.bookmarks)
  })

  it('缺少 categories 或 bookmarks 字段时抛错', () => {
    expect(() => parseImportJson('{"version":1}')).toThrow('缺少')
    expect(() => parseImportJson('null')).toThrow()
  })

  it('非法 JSON 抛错', () => {
    expect(() => parseImportJson('{not-json')).toThrow()
  })
})
