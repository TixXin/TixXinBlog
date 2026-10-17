/** @file articleMarkdown.test.ts @description 正文开头的重复标题不展示，锚点编号仍与后端目录一致，正文标题整体降一级 */
import { describe, expect, it } from 'vitest'
import { articleTocItems, renderArticleMarkdown } from '~/utils/articleMarkdown'

describe('renderArticleMarkdown', () => {
  it('跳过与标题相同的首个一级标题，后续锚点从 heading-2 开始', () => {
    const html = renderArticleMarkdown('# 我的标题\n\n正文\n\n## 第一节', '我的标题')
    expect(html).not.toContain('我的标题')
    expect(html).toContain('<h3 id="heading-2">第一节</h3>')
  })
  it('标题不同或不在开头时照常渲染', () => {
    expect(renderArticleMarkdown('# 另一个标题\n\n正文', '我的标题')).toContain('<h2 id="heading-1">另一个标题</h2>')
    expect(renderArticleMarkdown('引子\n\n# 我的标题', '我的标题')).toContain('<h2 id="heading-1">我的标题</h2>')
    expect(renderArticleMarkdown('# 我的标题')).toContain('<h2 id="heading-1">我的标题</h2>')
  })
  it('正文标题整体降一级，h6 封顶且不输出 h1', () => {
    const html = renderArticleMarkdown('# 一\n\n## 二\n\n### 三\n\n#### 四\n\n##### 五\n\n###### 六')
    expect(html).not.toContain('<h1')
    expect(html).toContain('<h2 id="heading-1">一</h2>')
    expect(html).toContain('<h3 id="heading-2">二</h3>')
    expect(html).toContain('<h4 id="heading-3">三</h4>')
    expect(html).toContain('<h5 id="heading-4">四</h5>')
    expect(html).toContain('<h6 id="heading-5">五</h6>')
    expect(html).toContain('<h6 id="heading-6">六</h6>')
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
