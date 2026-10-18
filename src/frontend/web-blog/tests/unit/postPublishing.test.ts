/**
 * @file postPublishing.test.ts
 * @description 发布辅助规则：Markdown 正文字数、中英文阅读估算、摘要和安全地址生成。
 */
import { describe, expect, it } from 'vitest'
import { postReadingStats, suggestedReadTime, suggestedSummary } from '~/utils/postPublishing'
import { articlePath } from '~/utils/articlePath'
describe('发布辅助', () => {
  it('汉字逐字、英文和数字按词计数，混排无需空格且忽略标点、空白和表情', () => {
    expect(postReadingStats('你好，Vue3世界！Hello world 2026\n\t😊。')).toEqual({
      chineseCharacters: 4,
      words: 4,
      wordCount: 8,
      minutes: 1,
    })
    expect(postReadingStats("𠮷野家 café cafe\u0301 don't it’s well-known")).toEqual({
      chineseCharacters: 3,
      words: 5,
      wordCount: 8,
      minutes: 1,
    })
  })
  it.each(['', ' \r\n\t', '，。！？😊✨', '---\n\n***'])('空白或纯符号正文 %j 为零字，建议值最低一分钟', (raw) => {
    expect(postReadingStats(raw)).toEqual({ chineseCharacters: 0, words: 0, wordCount: 0, minutes: 1 })
  })
  it('统计标题、列表、引用、表格与行内代码，去掉强调和链接语法但保留可见文字', () => {
    const raw = [
      '# 标题',
      '',
      '> 引用 **粗体** [链接](https://example.com/path "标题") `useState`',
      '',
      '- list-item',
      '1. ordered',
      '',
      '| 中文 | English |',
      '| --- | --- |',
      '| 数据 | value |',
    ].join('\n')
    expect(postReadingStats(raw)).toEqual({ chineseCharacters: 12, words: 5, wordCount: 17, minutes: 1 })
    expect(postReadingStats('read**able** [linked][ref]\n\n[ref]: https://example.com/hidden')).toMatchObject({
      words: 2,
      wordCount: 2,
    })
  })
  it('忽略不同围栏、缩进及未闭合的代码块，也忽略内联和引用图片', () => {
    const raw = [
      '正文 ![风景](https://example.com/a_(b).jpg "封面") end',
      '',
      '![参考][image]',
      '',
      '[image]: https://example.com/photo.jpg',
      '',
      '```ts',
      '代码 secret',
      '```',
      '',
      '~~~js',
      'hidden 123',
      '~~~',
      '',
      '    缩进 code',
      '',
      '```',
      '尚未闭合 incomplete',
    ].join('\r\n')
    expect(postReadingStats(raw)).toEqual({ chineseCharacters: 2, words: 1, wordCount: 3, minutes: 1 })
    expect(postReadingStats('one![图](https://example.com/p.png)two\nthree  \nfour')).toMatchObject({ words: 4 })
  })
  it('中英文用各自阅读速度相加后向上取整，字数不受阅读时长上限影响', () => {
    expect(suggestedReadTime('中'.repeat(175) + 'word '.repeat(110))).toBe(1)
    expect(suggestedReadTime('中'.repeat(176) + 'word '.repeat(110))).toBe(2)
    expect(suggestedReadTime('中'.repeat(350) + 'word '.repeat(220))).toBe(2)
    expect(suggestedReadTime('中'.repeat(351))).toBe(2)
    expect(suggestedReadTime('word '.repeat(221))).toBe(2)
    expect(postReadingStats('中'.repeat(200000))).toEqual({
      chineseCharacters: 200000,
      words: 0,
      wordCount: 200000,
      minutes: 300,
    })
  })
  it('中文和英文分别估算且结果有上下限', () => {
    expect(suggestedReadTime('')).toBe(1)
    expect(suggestedReadTime('中'.repeat(700))).toBe(2)
    expect(suggestedReadTime('word '.repeat(440))).toBe(2)
    expect(suggestedReadTime('word '.repeat(100000))).toBe(300)
  })
  it('摘要去除代码块和 Markdown 标记并限制长度', () => {
    expect(suggestedSummary('# 标题\n\n**正文** [链接](https://example.com)\n```js\nsecret code\n```')).toBe(
      '标题 正文 链接',
    )
    expect(suggestedSummary('长'.repeat(500))).toHaveLength(160)
    expect(suggestedSummary('['.repeat(200000))).toBe('['.repeat(160))
  })
  it('优先使用标识并编码路径，数字地址保持可用', () => {
    expect(articlePath({ id: 1, slug: 'vue-guide' })).toBe('/articles/vue-guide')
    expect(articlePath({ id: 1 })).toBe('/articles/1')
    expect(articlePath({ id: 1, slug: '../x' })).toBe('/articles/..%2Fx')
  })
})
