/** @file postOutline.test.ts @description 章节来源遵循 Markdown 语义，位置使用原始字符串的 UTF-16 索引。 */
import { describe, expect, it } from 'vitest'
import { postHeadings } from '../../app/features/post/outline'

describe('文章源码章节', () => {
  it('识别 ATX、Setext 和完整六级标题，跳过代码围栏及缩进代码', () => {
    const raw =
      '# 开始\n\n````md\n## 代码中的标题\n```\n````\n\n~~~\n伪标题\n===\n~~~\n\n    # 缩进代码\n\n正文小节\n---\n\n###### 结尾\n'
    expect(postHeadings(raw)).toEqual([
      { text: '开始', level: 1, line: 1, offset: 0 },
      { text: '正文小节', level: 2, line: 15, offset: raw.indexOf('正文小节') },
      { text: '结尾', level: 6, line: 18, offset: raw.indexOf('######') },
    ])
  })
  it('重复标题分别保留行号，行内格式以可读文字展示', () => {
    const raw = '# **回顾** [链接](https://example.com) `code`\n\n# 回顾\n'
    expect(postHeadings(raw).map(({ text, line, offset }) => ({ text, line, offset }))).toEqual([
      { text: '回顾 链接 code', line: 1, offset: 0 },
      { text: '回顾', line: 3, offset: raw.lastIndexOf('# 回顾') },
    ])
  })
  it('CRLF、单 CR、中文和代理对不会使源码偏移错位', () => {
    const raw = '前言🌱\r\n\r\n# 中文章节\r\n正文\r\r## 下一节'
    expect(
      postHeadings(raw).map((item) => [item.line, item.offset, raw.slice(item.offset).split(/\r?\n|\r/)[0]]),
    ).toEqual([
      [3, raw.indexOf('# 中文'), '# 中文章节'],
      [6, raw.indexOf('## 下一'), '## 下一节'],
    ])
  })
  it('不完整围栏中的标题仍是代码，空标题保留其真实位置', () => {
    expect(postHeadings('#\n\n```js\n# 围栏仍未结束')).toEqual([{ text: '', level: 1, line: 1, offset: 0 }])
    expect(postHeadings('#不是标题\n\n---\n\n普通正文')).toEqual([])
  })
  it('多行 Setext、引用和列表中的标题保留解析器实际起始行', () => {
    const raw = '第一行\n第二行\n===\n\n> ## 引用章节\n\n- ### 列表章节'
    expect(postHeadings(raw).map((item) => [item.text, item.level, item.line, item.offset])).toEqual([
      ['第一行 第二行', 1, 1, 0],
      ['引用章节', 2, 5, raw.indexOf('> ##')],
      ['列表章节', 3, 7, raw.indexOf('- ###')],
    ])
  })
  it('长文后半部分章节位置仍可直接定位且没有截断标题列表', () => {
    const raw = Array.from(
      { length: 150 },
      (_, index) => `## 第 ${index + 1} 节\n\n${'长段落中的中文与 English。'.repeat(30)}\n\n`,
    ).join('')
    const headings = postHeadings(raw)
    expect(raw.length).toBeGreaterThan(50000)
    expect(headings).toHaveLength(150)
    expect(headings.at(-1)?.offset).toBe(raw.indexOf('## 第 150 节'))
  })
})
