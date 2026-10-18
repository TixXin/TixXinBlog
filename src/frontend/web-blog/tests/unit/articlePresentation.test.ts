/**
 * @file articlePresentation.test.ts
 * @description 文章结构化正文与归档组件的空数据、语义结构、链接和数据更新回归
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import ArticleContent from '../../app/components/article/ArticleContent.vue'
import ArchiveTimeline from '../../app/components/article/ArchiveTimeline.vue'
import ArchiveStats from '../../app/components/article/ArchiveStats.vue'
import type { ArchiveYear } from '../../app/features/article/types'
import type { ArticleSection } from '../../app/features/post/types'

const wrappers: { unmount(): void }[] = []
const hosts: HTMLElement[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
})

describe('ArticleContent 结构化正文', () => {
  it('空正文保留 article 语义且不添加虚构内容，切换文章后移除旧章节', async () => {
    const wrapper = await mountSuspended(ArticleContent, { props: { sections: [] } })
    wrappers.push(wrapper)
    expect(wrapper.element.tagName).toBe('ARTICLE')
    expect(wrapper.text()).toBe('')
    await wrapper.setProps({ sections: [{ type: 'heading', id: 'opening', text: '从一次散步开始' }] })
    expect(wrapper.get('h2#opening').text()).toBe('从一次散步开始')
    await wrapper.setProps({ sections: [] })
    expect(wrapper.find('h2').exists()).toBe(false)
  })

  it('保留标题锚点、段落、引用与列表语义，正文中的 HTML 仅作为文本展示', async () => {
    const sections: ArticleSection[] = [
      { type: 'heading', level: 2, id: 'walking', text: '沿河散步' },
      { type: 'paragraph', text: '<img src=x onerror="alert(1)">' },
      { type: 'heading', level: 3, id: 'evening', text: '傍晚的光线' },
      { type: 'quote', text: '把目光放在近处。' },
      { type: 'list', items: ['带上相机', '慢慢走'] },
    ]
    const wrapper = await mountSuspended(ArticleContent, { props: { sections } })
    wrappers.push(wrapper)
    expect(wrapper.findAll('h2, h3').map((heading) => [heading.element.tagName, heading.attributes('id')])).toEqual([
      ['H2', 'walking'],
      ['H3', 'evening'],
    ])
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.get('.article-content__paragraph').text()).toBe(sections[1]!.text)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('blockquote p').text()).toBe('把目光放在近处。')
    expect(wrapper.findAll('ul li').map((item) => item.text())).toEqual(['带上相机', '慢慢走'])
  })

  it('代码块复用公共组件，缺省代码传递空字符串而非 undefined', async () => {
    const codeBlock = defineComponent({
      props: { code: String, language: String },
      setup: (props) => () => h('pre', { 'data-language': props.language }, props.code),
    })
    const wrapper = await mountSuspended(ArticleContent, {
      props: { sections: [{ type: 'code', text: 'const count = 1', language: 'ts' }, { type: 'code' }] },
      global: { stubs: { CommonCodeBlock: codeBlock } },
    })
    wrappers.push(wrapper)
    const blocks = wrapper.findAllComponents(codeBlock)
    expect(blocks[0]!.props()).toEqual({ code: 'const count = 1', language: 'ts' })
    expect(blocks[1]!.props('code')).toBe('')
  })
})

describe('归档展示组件', () => {
  it('空归档不生成占位年份或文章链接', async () => {
    const wrapper = await mountSuspended(ArchiveTimeline, { props: { years: [] } })
    wrappers.push(wrapper)
    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('按传入年份和文章顺序展示真实链接、日期与分类，分页计数不从当前条目数推算', async () => {
    const years: ArchiveYear[] = [
      {
        year: 2026,
        shortYear: '26',
        count: 12,
        posts: [
          { date: '2026-10-01', title: '秋日记录', category: '生活', categoryColor: 'amber', href: '/articles/autumn' },
          { date: '2026-09-12', title: '河岸散步', category: '旅行', categoryColor: 'sky', href: '/articles/river' },
        ],
      },
      {
        year: 2025,
        shortYear: '25',
        count: 1,
        posts: [
          {
            date: '2025-12-31',
            title: '年末回望',
            category: '随笔',
            categoryColor: 'slate',
            href: '/articles/year-end',
          },
        ],
      },
    ]
    const host = document.createElement('div')
    document.body.append(host)
    hosts.push(host)
    const wrapper = await mountSuspended(ArchiveTimeline, { props: { years }, attachTo: host })
    wrappers.push(wrapper)
    expect(wrapper.findAll('h3').map((title) => title.text())).toEqual(['2026 年', '2025 年'])
    expect(wrapper.findAll('.archive-timeline__count').map((count) => count.text())).toEqual([
      '全年共 12 篇',
      '全年共 1 篇',
    ])
    const links = wrapper.findAll('a')
    expect(links.map((link) => link.attributes('href'))).toEqual([
      '/articles/autumn',
      '/articles/river',
      '/articles/year-end',
    ])
    for (const link of links) {
      const element = link.element as HTMLAnchorElement
      expect(element.tabIndex).toBe(0)
      element.focus()
      expect(document.activeElement).toBe(element)
    }
    expect(wrapper.get('time').attributes('datetime')).toBe('2026-10-01')
    expect(wrapper.get('.archive-item__tag').text()).toBe('生活')
    expect(wrapper.findAll('.archive-item--first')).toHaveLength(2)
    expect(wrapper.findAll('.archive-item__dot').every((dot) => dot.attributes('aria-hidden') === 'true')).toBe(true)
    await wrapper.setProps({ years: [years[1]!] })
    expect(wrapper.findAll('a').map((link) => link.text())).toEqual(['年末回望'])
  })

  it('统计为空时不伪造数据，零值与百分比更新后同步显示', async () => {
    const wrapper = await mountSuspended(ArchiveStats, {
      props: { stats: [], distribution: [] },
      global: { stubs: { Icon: true } },
    })
    wrappers.push(wrapper)
    expect(wrapper.get('h2').text()).toBe('归档概览')
    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(wrapper.find('.archive-stats__fill').exists()).toBe(false)
    await wrapper.setProps({
      stats: [{ label: '文章总数', value: '0' }],
      distribution: [{ name: '生活', count: 0, percent: 0 }],
    })
    expect(wrapper.get('li').text()).toBe('文章总数0')
    expect(wrapper.get('.archive-stats__dist-count').text()).toBe('0 · 0%')
    expect((wrapper.get('.archive-stats__fill').element as HTMLElement).style.width).toBe('0%')
    await wrapper.setProps({ distribution: [{ name: '旅行', count: 3, percent: 75 }] })
    expect(wrapper.get('.archive-stats__dist-name').text()).toBe('旅行')
    expect(wrapper.get('.archive-stats__dist-count').text()).toBe('3 · 75%')
    expect((wrapper.get('.archive-stats__fill').element as HTMLElement).style.width).toBe('75%')
  })
})
