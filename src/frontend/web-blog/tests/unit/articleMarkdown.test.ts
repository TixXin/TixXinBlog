/** @file articleMarkdown.test.ts @description 正文开头的重复标题不展示，锚点编号仍与后端目录一致 */
import { describe, expect, it } from 'vitest'
import { articleTocItems, renderArticleMarkdown } from '~/utils/articleMarkdown'

describe('renderArticleMarkdown', () => {
  it('跳过与标题相同的首个一级标题，后续锚点从 heading-2 开始', () => {
    const html = renderArticleMarkdown('# 我的标题\n\n正文\n\n## 第一节', '我的标题')
    expect(html).not.toContain('我的标题')
    expect(html).toContain('<h2 id="heading-2">第一节</h2>')
  })
  it('标题不同或不在开头时照常渲染', () => {
    expect(renderArticleMarkdown('# 另一个标题\n\n正文', '我的标题')).toContain('<h1 id="heading-1">另一个标题</h1>')
    expect(renderArticleMarkdown('引子\n\n# 我的标题', '我的标题')).toContain('<h1 id="heading-1">我的标题</h1>')
    expect(renderArticleMarkdown('# 我的标题')).toContain('<h1 id="heading-1">我的标题</h1>')
  })
  it('目录去掉重复的首项', () => {
    const items = [
      { id: 'heading-1', text: '我的标题', level: 1 },
      { id: 'heading-2', text: '第一节', level: 2 },
    ]
    expect(articleTocItems(items, '我的标题')).toEqual([items[1]])
    expect(articleTocItems(items, '别的标题')).toEqual(items)
  })
})
