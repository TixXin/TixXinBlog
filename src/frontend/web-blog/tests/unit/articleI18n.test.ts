/**
 * @file articleI18n.test.ts
 * @description 文章域英文冒烟：Markdown 渲染文案随传入语言变化、无 i18n 时保持中文兜底，
 *              以及评论、代码复制、归档时间段、阅读时长与搜索类型在英文界面下的关键文案
 * @author TixXin
 * @since 2026-10-19
 */

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import CodeCopyButton from '../../app/components/article/CodeCopyButton.vue'
import CommentSection from '../../app/components/article/CommentSection.vue'
import ArticleMarkdown from '../../app/components/article/Markdown.vue'
import { postArchivePeriod, postArchiveSeo } from '../../app/features/post/archive'
import { searchTypeLabel } from '../../app/features/search/types'
import { renderArticleMarkdown } from '../../app/utils/articleMarkdown'
import { MARKDOWN_FALLBACK_LABELS } from '../../app/utils/markdownLabels'
import { formatReadTime } from '../../app/utils/readTime'

// 按原文读取中文字典（?raw 绕过 i18n 插件的预编译）
const zhArticle = JSON.parse(
  Object.values(
    import.meta.glob<string>('../../i18n/locales/zh-CN/article.json', {
      eager: true,
      query: '?raw',
      import: 'default',
    }),
  )[0]!,
) as Record<string, unknown>

/** 用到时再取：收集阶段 Nuxt 测试应用尚未就绪 */
const i18n = () => useNuxtApp().$i18n

async function inEnglish(run: () => void | Promise<void>) {
  await i18n().setLocale('en')
  try {
    await run()
  } finally {
    await i18n().setLocale('zh-CN')
  }
}

const englishT = () => (key: string, params?: Record<string, unknown>) =>
  params ? i18n().t(key, params) : i18n().t(key)

const markdown = '```\nplain\n```\n\n![洱海日落](/sunset.png)\n\n[外链](https://example.com)'

function parse(html: string) {
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('文章 Markdown 渲染文案', () => {
  it('中文兜底与 zh-CN 字典逐字一致', () => {
    for (const [key, value] of Object.entries(MARKDOWN_FALLBACK_LABELS)) {
      const leaf = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], zhArticle)
      expect(leaf, key).toBe(value)
    }
  })

  it('未传翻译函数（订阅全文的服务端渲染）保持中文', () => {
    const doc = parse(renderArticleMarkdown(markdown))
    expect(doc.querySelector('.article-code__lang')?.textContent).toBe('文本')
    expect(doc.querySelector('[data-article-image]')?.getAttribute('aria-label')).toBe('查看大图：洱海日落')
    expect(doc.querySelector('a .sr-only')?.textContent).toBe('（在新窗口打开）')
  })

  it('传入英文翻译函数时代码标签、查看大图与新窗口提示为英文', async () => {
    await inEnglish(() => {
      const doc = parse(renderArticleMarkdown(markdown, undefined, { t: englishT() }))
      expect(doc.querySelector('.article-code__lang')?.textContent).toBe('Text')
      expect(doc.querySelector('[data-article-image]')?.getAttribute('aria-label')).toBe('View full image: 洱海日落')
      expect(doc.querySelector('a .sr-only')?.textContent).toBe('(opens in a new window)')
    })
  })

  it('Markdown 组件按当前界面语言渲染，切换语言后重新输出', async () => {
    const wrapper = await mountSuspended(ArticleMarkdown, { props: { content: '[外链](https://example.com)' } })
    try {
      expect(wrapper.get('a .sr-only').text()).toBe('（在新窗口打开）')
      await inEnglish(async () => {
        await nextTick()
        expect(wrapper.get('a .sr-only').text()).toBe('(opens in a new window)')
      })
    } finally {
      wrapper.unmount()
    }
  })
})

describe('文章域英文界面', () => {
  it('代码复制按钮与评论区显示英文', async () => {
    await inEnglish(async () => {
      const copy = await mountSuspended(CodeCopyButton, { props: { code: 'x' } })
      const section = await mountSuspended(CommentSection, {
        props: {
          comments: [],
          total: 0,
          replyTarget: null,
          submitting: false,
          loading: false,
          busy: false,
          canSubmit: false,
          submitError: '',
          submitNotice: '',
          loadError: '',
          likeError: '',
          pendingLikes: [],
          modelValue: '',
        },
      })
      try {
        expect(copy.get('button').attributes('aria-label')).toBe('Copy code')
        expect(section.text()).toContain('Post comment')
        expect(section.text()).toContain('No comments yet. Be the first to write one.')
        expect(section.text()).not.toMatch(/[一-鿿]/)
      } finally {
        copy.unmount()
        section.unmount()
      }
    })
  })

  it('归档时间段、阅读时长与搜索类型随语言变化，中文保持原文', async () => {
    expect(postArchivePeriod({ year: 2026, month: 3 })).toBe('2026 年 3 月')
    expect(postArchiveSeo({ year: 2026, page: 2 }).title).toBe('2026 年文章归档 · 第 2 页')
    expect(formatReadTime('12 分钟', i18n().t)).toBe('12 分钟')
    await inEnglish(() => {
      expect(postArchivePeriod({ year: 2026, month: 3 })).toBe('March 2026')
      expect(postArchiveSeo({ year: 2026, page: 2 }).title).toBe('Posts from 2026 · Page 2')
      expect(formatReadTime('12 分钟', englishT())).toBe('12 min')
      expect(formatReadTime('约一刻钟', englishT())).toBe('约一刻钟')
      expect(searchTypeLabel('moment', englishT())).toBe('Moments')
    })
  })
})
