/**
 * @file markdownLinks.test.ts
 * @description 三种 Markdown 渲染入口统一保护外链、区分访客内容并提供新窗口提示；提及处理不改写链接属性
 */
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { Icon } from '#components'
import { renderArticleMarkdown } from '~/utils/articleMarkdown'
import { renderFlashMarkdown } from '~/utils/flashMarkdown'
import { renderMomentMarkdown } from '~/composables/useMomentMarkdown'
import MomentCommentSection from '~/components/moment/MomentCommentSection.vue'

interface LinkOptions {
  siteUrl?: string
  ugc?: boolean
}

const renderers = [
  {
    name: '文章',
    render: (text: string, options: LinkOptions = {}) => renderArticleMarkdown(text, undefined, options),
  },
  { name: '闪念', render: (text: string, options: LinkOptions = {}) => renderFlashMarkdown(text, options) },
  { name: '朋友圈', render: (text: string, options: LinkOptions = {}) => renderMomentMarkdown(text, options) },
]
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')
const newWindowHint = '（在新窗口打开）'

function expectNewWindow(link: Element, rel = 'noopener noreferrer') {
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toBe(rel)
  const icon = link.querySelector('.markdown-link__icon')!
  expect(icon).not.toBeNull()
  expect(icon.classList.contains('iconify')).toBe(true)
  expect(icon.classList.contains('i-lucide:external-link')).toBe(true)
  expect(icon.getAttribute('aria-hidden')).toBe('true')
  const hints = link.querySelectorAll('.sr-only')
  expect(hints).toHaveLength(1)
  expect(hints[0]?.textContent).toBe(newWindowHint)
  expect(hints[0]?.getAttribute('aria-hidden')).toBeNull()
  expect(link.lastElementChild).toBe(hints[0])
}

describe.each(renderers)('$name Markdown 外链', ({ render }) => {
  it('显式链接、自动识别裸链和协议相对外链保留安全属性与读屏提示', () => {
    const doc = parse(
      render('[资料](https://example.net/guide) http://example.org/news [图片站](//images.example.net)'),
    )
    const links = [...doc.querySelectorAll('a')]
    expect(links).toHaveLength(3)
    links.forEach((link) => expectNewWindow(link))
    expect(links[0]?.textContent).toBe(`资料${newWindowHint}`)
    expect(links[1]?.getAttribute('href')).toBe('http://example.org/news')
    expect(links[2]?.getAttribute('href')).toBe('//images.example.net')
  })

  it('无协议裸域名仍自动识别为外链，中文标点结束链接', () => {
    const doc = parse(render('访问 www.example.net 或 example.org/docs。详见 https://example.com/guide，谢谢'))
    const links = [...doc.querySelectorAll('a')]
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'http://www.example.net',
      'http://example.org/docs',
      'https://example.com/guide',
    ])
    links.forEach((link) => expectNewWindow(link))
  })

  it('评论与访客模式同时加 nofollow 和 ugc，保留新窗口安全属性', () => {
    const doc = parse(render('[访客推荐](https://example.net) https://example.org', { ugc: true }))
    const links = [...doc.querySelectorAll('a')]
    expect(links).toHaveLength(2)
    links.forEach((link) => expectNewWindow(link, 'noopener noreferrer nofollow ugc'))
  })

  it('相对路径、锚点、邮件与同源绝对地址保持当前窗口且不追加提示', () => {
    const doc = parse(
      render(
        '[文章](/posts/1) [相对](../archive) [目录](#heading-1) [邮件](mailto:reader@example.net) ' +
          '[本站](https://blog.example.com:443/posts/2) [本站图片](//blog.example.com/gallery)',
        { siteUrl: 'https://blog.example.com/about', ugc: true },
      ),
    )
    const links = [...doc.querySelectorAll('a')]
    expect(links).toHaveLength(6)
    for (const link of links) {
      expect(link.hasAttribute('target')).toBe(false)
      expect(link.hasAttribute('rel')).toBe(false)
      expect(link.querySelector('.markdown-link__icon, .sr-only')).toBeNull()
    }
  })

  it('不同协议、端口和子域仍视为外链，不把域名前缀当成同源', () => {
    const doc = parse(
      render(
        '[HTTP](http://blog.example.com) [端口](https://blog.example.com:8443) ' +
          '[子域](https://cdn.blog.example.com) [相似域](https://blog.example.com.evil.test)',
        { siteUrl: 'https://blog.example.com' },
      ),
    )
    const links = [...doc.querySelectorAll('a')]
    expect(links).toHaveLength(4)
    links.forEach((link) => expectNewWindow(link))
  })

  it('按浏览器语义识别协议简写外链，同协议相对地址仍留在本站', () => {
    const doc = parse(
      render('[简写](http:evil.example/path) [同协议相对](https:chapter) [同源](https://blog.example/chapter)', {
        siteUrl: 'https://blog.example',
        ugc: true,
      }),
    )
    const links = [...doc.querySelectorAll('a')]
    expect(links).toHaveLength(3)
    expectNewWindow(links[0]!, 'noopener noreferrer nofollow ugc')
    expect(links[0]?.getAttribute('href')).toBe('http:evil.example/path')
    for (const link of links.slice(1)) {
      expect(link.hasAttribute('target')).toBe(false)
      expect(link.hasAttribute('rel')).toBe(false)
      expect(link.querySelector('.markdown-link__icon, .sr-only')).toBeNull()
    }
  })

  it('没有站点地址时相对路径、锚点和邮件仍不加外链装饰', () => {
    const doc = parse(
      render('[文章](/posts/1) [相对](../archive) [目录](#heading-1) [邮件](mailto:reader@example.net)'),
    )
    const links = [...doc.querySelectorAll('a')]
    expect(links).toHaveLength(4)
    for (const link of links) {
      expect(link.hasAttribute('target')).toBe(false)
      expect(link.hasAttribute('rel')).toBe(false)
      expect(link.querySelector('.markdown-link__icon, .sr-only')).toBeNull()
    }
  })

  it('站点地址无效时仍保护 HTTP 外链，无法解析的链接不会导致渲染异常', () => {
    for (const siteUrl of ['不是网址', 'mailto:owner@example.net']) {
      const doc = parse(render('[资料](https://example.net/guide) [无效](http://[)', { siteUrl, ugc: true }))
      const link = doc.querySelector('a[href="https://example.net/guide"]')!
      expectNewWindow(link, 'noopener noreferrer nofollow ugc')
      expect(doc.body.textContent).toContain('无效')
      expect(doc.querySelectorAll('.markdown-link__icon')).toHaveLength(1)
    }
  })

  it('保留链接内格式与图片，不重复添加提示或嵌套交互元素', () => {
    const doc = parse(render('[**粗体**与*强调*](https://example.net) [![徽章](/badge.png)](https://example.org)'))
    const links = [...doc.querySelectorAll('a')]
    expect(links).toHaveLength(2)
    links.forEach((link) => expectNewWindow(link))
    expect(links[0]?.querySelector('strong')?.textContent).toBe('粗体')
    expect(links[0]?.querySelector('em')?.textContent).toBe('强调')
    expect(links[1]?.querySelector('img')?.getAttribute('alt')).toBe('徽章')
    expect(links[1]?.querySelector('img')?.getAttribute('src')).toBe('/badge.png')
    expect(doc.querySelector('a a, a button')).toBeNull()
    expect(doc.querySelectorAll('.markdown-link__icon')).toHaveLength(2)
  })

  it('地址与标题中的引号及 HTML 保持属性值，不生成事件或可执行元素', () => {
    const href = 'https://example.net/path?name=%22%3E%3Csvg%2Fonload%3Dalert(1)%3E&next=1'
    const doc = parse(render(`[资料](${href} "资料 &quot; onmouseover=&quot;alert(1)")`))
    const link = doc.querySelector('a')!
    expectNewWindow(link)
    expect(link.getAttribute('href')).toBe(href)
    expect(link.getAttribute('title')).toBe('资料 " onmouseover="alert(1)')
    expect(doc.querySelector('script, svg, [onload], [onerror], [onmouseover]')).toBeNull()
  })

  it('危险协议、原始 HTML 和代码中的链接不能绕过净化或产生外链装饰', () => {
    const doc = parse(
      render(
        '[脚本](javascript:alert(1)) [数据](data:text/html;base64,PHNjcmlwdD4=) ' +
          '<a href="javascript:alert(1)" onclick="alert(1)">原始标签</a> ' +
          '`https://example.org` <script>alert(1)</script>',
        { ugc: true },
      ),
    )
    expect(doc.querySelector('a, script, [onclick], .markdown-link__icon, .sr-only')).toBeNull()
    expect(doc.querySelector('code')?.textContent).toBe('https://example.org')
    expect(doc.body.textContent).toContain('原始标签')
  })

  it('复用解析器时访客模式与站点地址只影响当前调用', () => {
    const markdown = '[资料](https://example.net/guide)'
    expectNewWindow(parse(render(markdown, { ugc: true })).querySelector('a')!, 'noopener noreferrer nofollow ugc')
    const internal = parse(render(markdown, { siteUrl: 'https://example.net' })).querySelector('a')!
    expect(internal.hasAttribute('target')).toBe(false)
    expect(internal.hasAttribute('rel')).toBe(false)
    expectNewWindow(parse(render(markdown)).querySelector('a')!)
    expectNewWindow(parse(render(markdown, { ugc: false })).querySelector('a')!)
    expectNewWindow(parse(render(markdown, { ugc: true })).querySelector('a')!, 'noopener noreferrer nofollow ugc')
  })

  it('空内容和不含链接的正文不产生提示或图标', () => {
    expect(render('')).toBe('')
    const doc = parse(render('普通文字与 **重点**'))
    expect(doc.querySelector('a, .markdown-link__icon, .sr-only')).toBeNull()
    expect(doc.querySelector('strong')?.textContent).toBe('重点')
  })
})

describe('朋友圈评论提及与外链', () => {
  it('只装饰普通文本中的提及，链接地址、标题、邮箱与代码保持原样', () => {
    const doc = parse(
      renderMomentMarkdown(
        '@访客 **@朋友** [@链接](https://example.net/@author?email=a@example.net "发给 a@example.net") ' +
          'a@example.net `@代码` ![联系 a@example.net](/portrait.png)',
        { inline: true, mentions: true, ugc: true },
      ),
    )
    expect([...doc.querySelectorAll('.mention')].map((node) => node.textContent)).toEqual(['@访客', '@朋友'])
    const links = [...doc.querySelectorAll('a')]
    expect(links).toHaveLength(2)
    expectNewWindow(links[0]!, 'noopener noreferrer nofollow ugc')
    expect(links[0]?.getAttribute('href')).toBe('https://example.net/@author?email=a@example.net')
    expect(links[0]?.getAttribute('title')).toBe('发给 a@example.net')
    expect(links[0]?.textContent).toBe(`@链接${newWindowHint}`)
    expect(links[1]?.getAttribute('href')).toBe('mailto:a@example.net')
    expect(links[1]?.textContent).toBe('a@example.net')
    expect(doc.querySelector('code')?.textContent).toBe('@代码')
    expect(doc.querySelector('img')?.getAttribute('alt')).toBe('联系 a@example.net')
    expect(doc.querySelector('p')).toBeNull()
  })

  it('提及选项不会改变后续正文渲染，也不会把提及内的特殊字符变成 HTML', () => {
    const doc = parse(renderMomentMarkdown('@访客<script>alert(1)</script>', { inline: true, mentions: true }))
    expect(doc.querySelector('script')).toBeNull()
    expect(doc.body.textContent).toBe('@访客<script>alert(1)</script>')
    expect(parse(renderMomentMarkdown('@访客')).querySelector('.mention')).toBeNull()
    expect(parse(renderMomentMarkdown('@访客', { inline: true })).querySelector('.mention')).toBeNull()
  })

  it('评论组件对评论内容显式使用访客链接策略', async () => {
    const wrapper = await mountSuspended(MomentCommentSection, {
      props: {
        comments: [
          { id: 'visitor', author: '访客', avatar: '', content: 'https://example.net', time: '刚刚' },
          { id: 'owner', author: '博主', avatar: '', content: 'https://example.org', time: '刚刚', isOwner: true },
        ],
        draft: '',
      },
      global: {
        stubs: {
          MomentUserPopover: { template: '<div><slot /></div>' },
          CommonContentImage: true,
          Icon: true,
        },
      },
    })
    try {
      const links = wrapper.findAll('.moment-comments__text a')
      expect(links).toHaveLength(2)
      links.forEach((link) => expectNewWindow(link.element, 'noopener noreferrer nofollow ugc'))
    } finally {
      wrapper.unmount()
    }
  })
})

it('Markdown 外链图标复用真实 Lucide Icon 的 CSS 类和已注册样式', async () => {
  const host = defineComponent({
    setup() {
      return () =>
        h('span', { hidden: true, 'aria-hidden': 'true' }, [h(Icon, { name: 'lucide:external-link', mode: 'css' })])
    },
  })
  const wrapper = await mountSuspended(host)
  try {
    await flushPromises()
    const icon = wrapper.get('.iconify')
    const markdownIcon = parse(renderFlashMarkdown('[资料](https://example.net)')).querySelector(
      '.markdown-link__icon',
    )!
    for (const className of icon.classes()) expect(markdownIcon.classList.contains(className)).toBe(true)
    expect(icon.classes()).toContain('i-lucide:external-link')
    const css = [...document.head.querySelectorAll('style')].map((style) => style.textContent).join('\n')
    expect(css).toContain('.i-lucide\\:external-link')
    expect(css).toContain('mask-image:')
    expect(wrapper.attributes('hidden')).toBeDefined()
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  } finally {
    wrapper.unmount()
  }
})
