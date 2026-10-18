/**
 * @file articleMarkdown.test.ts
 * @description 正文开头的重复标题不展示，锚点编号仍与后端目录一致，正文标题整体降一级；
 *              标题输出静态锚点挂载位，代码块高亮并保留主题变量，未知语言回退纯文本，正文图片懒加载并可放大
 */
import { describe, expect, it } from 'vitest'
import { articleTocItems, renderArticleMarkdown } from '~/utils/articleMarkdown'
import { collectCodeLanguages, loadCodeHighlighter } from '~/utils/highlightCode'

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')
const anchorSlot = '<span class="article-heading__anchor"></span>'
const headingHtml = (tag: string, id: string, inner: string) =>
  `<${tag} id="${id}" aria-labelledby="${id}-text"><span id="${id}-text">${inner}</span>${anchorSlot}</${tag}>`

describe('renderArticleMarkdown', () => {
  it('跳过与标题相同的首个一级标题，后续锚点从 heading-2 开始', () => {
    const html = renderArticleMarkdown('# 我的标题\n\n正文\n\n## 第一节', '我的标题')
    expect(html).not.toContain('我的标题')
    expect(html).toContain(headingHtml('h3', 'heading-2', '第一节'))
    expect(parse(html).querySelectorAll('.article-heading__anchor')).toHaveLength(1)
  })
  it('标题不同或不在开头时照常渲染', () => {
    expect(renderArticleMarkdown('# 另一个标题\n\n正文', '我的标题')).toContain(
      headingHtml('h2', 'heading-1', '另一个标题'),
    )
    expect(renderArticleMarkdown('引子\n\n# 我的标题', '我的标题')).toContain(
      headingHtml('h2', 'heading-1', '我的标题'),
    )
    expect(renderArticleMarkdown('# 我的标题')).toContain(headingHtml('h2', 'heading-1', '我的标题'))
  })
  it('正文标题整体降一级，h6 封顶且不输出 h1', () => {
    const html = renderArticleMarkdown('# 一\n\n## 二\n\n### 三\n\n#### 四\n\n##### 五\n\n###### 六')
    expect(html).not.toContain('<h1')
    expect(html).toContain(headingHtml('h2', 'heading-1', '一'))
    expect(html).toContain(headingHtml('h3', 'heading-2', '二'))
    expect(html).toContain(headingHtml('h4', 'heading-3', '三'))
    expect(html).toContain(headingHtml('h5', 'heading-4', '四'))
    expect(html).toContain(headingHtml('h6', 'heading-5', '五'))
    expect(html).toContain(headingHtml('h6', 'heading-6', '六'))
    const doc = parse(html)
    expect(doc.querySelectorAll('.article-heading__anchor')).toHaveLength(6)
    expect([...doc.querySelectorAll('.article-heading__anchor')].every((slot) => !slot.hasChildNodes())).toBe(true)
    expect(doc.querySelector('button, [role="status"], [role="tooltip"]')).toBeNull()
    for (const heading of doc.querySelectorAll('h2, h3, h4, h5, h6')) {
      const label = heading.querySelector(`#${heading.id}-text`)
      expect(heading.getAttribute('aria-labelledby')).toBe(`${heading.id}-text`)
      expect(label?.textContent).toBeTruthy()
      expect(label?.querySelector('.article-heading__anchor')).toBeNull()
    }
  })
  it('重复渲染保持相同静态结构，富文本与 Setext 标题保留内容，挂载位不会嵌入标题内的链接', () => {
    const markdown = '# **粗体** 与 [链接](https://example.com)\n\n段落\n\n小节 `代码`\n---\n\n```md\n## 伪标题\n```'
    const html = renderArticleMarkdown(markdown)
    expect(renderArticleMarkdown(markdown)).toBe(html)
    const doc = parse(html)
    const heading = doc.querySelector('h2#heading-1')!
    expect(heading.textContent).toBe('粗体 与 链接')
    expect(heading.getAttribute('aria-labelledby')).toBe('heading-1-text')
    const label = heading.querySelector('#heading-1-text')
    expect(label?.textContent).toBe('粗体 与 链接')
    expect(label?.querySelector('strong')?.textContent).toBe('粗体')
    expect(label?.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
    expect(label?.querySelector('.article-heading__anchor')).toBeNull()
    expect(heading.querySelector('a .article-heading__anchor')).toBeNull()
    expect(heading.lastElementChild?.className).toBe('article-heading__anchor')
    expect(doc.querySelector('h3#heading-2 code')?.textContent).toBe('代码')
    expect(doc.querySelectorAll('.article-heading__anchor')).toHaveLength(2)
    expect(doc.querySelector('pre .article-heading__anchor')).toBeNull()
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

describe('renderArticleMarkdown 代码块与图片', () => {
  it('预加载语言后输出 Shiki 高亮，消毒保留 class 与双主题变量', async () => {
    const markdown = '```ts\nconst answer: number = 42\n// 保留注释对比度\n```'
    expect(collectCodeLanguages(markdown)).toEqual(['typescript'])
    const highlighter = await loadCodeHighlighter(collectCodeLanguages(markdown))
    const doc = parse(renderArticleMarkdown(markdown, undefined, { highlighter }))
    const block = doc.querySelector('.article-code')!
    expect(block.getAttribute('data-language')).toBe('typescript')
    expect(block.querySelector('.article-code__lang')?.textContent).toBe('TypeScript')
    expect(block.querySelector('.article-code__actions')).not.toBeNull()
    const pre = block.querySelector('pre.shiki')!
    expect(pre.getAttribute('tabindex')).toBe('0')
    expect(pre.querySelector('code')?.textContent).toBe('const answer: number = 42\n// 保留注释对比度')
    const token = [...pre.querySelectorAll<HTMLElement>('span[style]')].find((span) => span.textContent === 'const')!
    expect(token.getAttribute('style')).toMatch(/--shiki-light:#[0-9a-f]+;--shiki-dark:#[0-9a-f]+/i)
    const comment = [...pre.querySelectorAll<HTMLElement>('span[style]')].find(
      (span) => span.textContent === '// 保留注释对比度',
    )!
    expect(comment.style.getPropertyValue('--shiki-light').toLowerCase()).toBe('#6a737d')
    expect(comment.style.getPropertyValue('--shiki-dark').toLowerCase()).toBe('#bdc4cc')
  })

  it('未加载高亮器或未知语言回退为转义后的纯文本代码块', async () => {
    const highlighter = await loadCodeHighlighter(['ts'])
    for (const html of [
      renderArticleMarkdown('```astro\n<script>alert(1)</script>\n```', undefined, { highlighter }),
      renderArticleMarkdown('```ts\n<script>alert(1)</script>\n```'),
    ]) {
      const doc = parse(html)
      expect(doc.querySelector('script')).toBeNull()
      expect(doc.querySelector('pre.article-code__plain code')?.textContent).toBe('<script>alert(1)</script>')
    }
    expect(parse(renderArticleMarkdown('```astro\nx\n```')).querySelector('.article-code__lang')?.textContent).toBe(
      'astro',
    )
    expect(parse(renderArticleMarkdown('```\nx\n```')).querySelector('.article-code__lang')?.textContent).toBe('文本')
  })

  it('style 只放行 Shiki 变量与表格对齐', () => {
    const html = renderArticleMarkdown('| a | b |\n| :-: | --: |\n| 1 | 2 |')
    expect(html).toContain('style="text-align:center"')
    expect(html).toContain('style="text-align:right"')
  })

  it('正文图片懒加载、异步解码，并包裹为带可访问名的放大按钮；链接内图片不包裹', () => {
    const doc = parse(
      renderArticleMarkdown('![洱海日落](/api/v1/media/a.webp)\n\n[![徽章](/b.png)](https://example.com)'),
    )
    const trigger = doc.querySelector('button.article-image[data-article-image]')!
    expect(trigger.getAttribute('type')).toBe('button')
    expect(trigger.getAttribute('aria-label')).toBe('查看大图：洱海日落')
    const image = trigger.querySelector('img')!
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(image.getAttribute('decoding')).toBe('async')
    expect(image.getAttribute('alt')).toBe('洱海日落')
    const managed = '/api/v1/media/3ba4de2b-a168-4fd4-ab7f-21d5fb614db4.webp'
    const managedImage = parse(renderArticleMarkdown(`![骑行](${managed})`)).querySelector('img')!
    expect(managedImage.getAttribute('srcset')).toBe(
      [320, 640, 960, 1280].map((width) => `${managed}?w=${width} ${width}w`).join(', '),
    )
    expect(managedImage.getAttribute('sizes')).toBe('(max-width: 768px) 100vw, 800px')
    expect(image.hasAttribute('srcset')).toBe(false)
    const linked = doc.querySelector('a img')!
    expect(linked.closest('button')).toBeNull()
    expect(linked.getAttribute('loading')).toBe('lazy')
    expect(doc.querySelectorAll('[data-article-image]')).toHaveLength(1)
  })
})
