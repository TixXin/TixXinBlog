/**
 * @file postPublishing.test.ts
 * @description 发布辅助规则：中英文阅读估算、摘要和安全地址生成。
 */
import { describe, expect, it } from 'vitest'
import { suggestedReadTime, suggestedSummary } from '~/utils/postPublishing'
import { articlePath } from '~/utils/articlePath'
describe('发布辅助', () => {
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
