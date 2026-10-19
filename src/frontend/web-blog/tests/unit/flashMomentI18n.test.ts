/**
 * @file flashMomentI18n.test.ts
 * @description 闪念与朋友圈域英文冒烟：非组件模块的中文兜底与字典逐字一致、Markdown 读屏文案随传入语言变化，
 *              以及闪念列表、卡片、编辑器与朋友圈列表在英文界面下的关键文案
 * @author TixXin
 * @since 2026-10-19
 */

import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import FlashEditor from '../../app/components/flash/FlashEditor.vue'
import FlashNoteCard from '../../app/components/flash/FlashNoteCard.vue'
import FlashNoteList from '../../app/components/flash/FlashNoteList.vue'
import MomentList from '../../app/components/moment/MomentList.vue'
import { renderMomentMarkdown } from '../../app/composables/useMomentMarkdown'
import { commentSubmittedMessage } from '../../app/features/flash/comments'
import { FLASH_MOMENT_FALLBACK_MESSAGES, flashMomentMessage } from '../../app/features/flash/messages'
import type { FlashNote } from '../../app/features/flash/types'
import { findMomentTopic } from '../../app/features/moment/topics'
import { renderFlashMarkdown } from '../../app/utils/flashMarkdown'
import { TASK_ITEM_FALLBACK_LABEL, TASK_ITEM_LABEL_KEY } from '../../app/utils/markdownTaskLabels'

mockNuxtImport('useToast', () => () => ({ success: () => {}, error: () => {} }))

// 按原文读取中文字典（?raw 绕过 i18n 插件的预编译）
const zhDictionary = JSON.parse(
  Object.values(
    import.meta.glob<string>('../../i18n/locales/zh-CN/flash-moment.json', {
      eager: true,
      query: '?raw',
      import: 'default',
    }),
  )[0]!,
) as Record<string, unknown>

function leaf(key: string) {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], zhDictionary)
}

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

const currentT = () => (key: string, params?: Record<string, unknown>) =>
  params ? i18n().t(key, params) : i18n().t(key)

function parse(html: string) {
  return new DOMParser().parseFromString(html, 'text/html')
}

const note: FlashNote = {
  id: 'n1',
  userId: 'owner',
  // 待办项只有图片时没有可读文字，复选框使用兜底名称
  content: '- [ ] ![](/todo.png)\n\n[资料](https://example.com)',
  tags: [],
  images: [],
  type: 'idea',
  createdAt: '2026-09-07T00:00:00Z',
  updatedAt: '2026-09-07T00:00:00Z',
  likes: 0,
  comments: [],
}

describe('闪念与朋友圈的非组件文案', () => {
  it('中文兜底与 zh-CN 字典逐字一致', () => {
    for (const [key, value] of Object.entries(FLASH_MOMENT_FALLBACK_MESSAGES)) expect(leaf(key), key).toBe(value)
    expect(leaf(TASK_ITEM_LABEL_KEY)).toBe(TASK_ITEM_FALLBACK_LABEL)
  })

  it('脱离 i18n 或翻译仍是 key 时回退中文，不显示裸 key', () => {
    expect(flashMomentMessage('flash-moment.request.flashUnavailable', (key) => key)).toBe(
      '闪念服务暂时不可用，请稍后重试',
    )
    expect(commentSubmittedMessage({ moderationStatus: 'pending' }, (key) => key)).toBe('已提交，待博主审核后公开')
  })

  it('英文界面下的请求提示、评论提示与内置话题简介', async () => {
    await inEnglish(() => {
      expect(flashMomentMessage('flash-moment.request.momentNotFound', currentT())).toBe(
        "This moment doesn't exist or isn't public yet",
      )
      expect(commentSubmittedMessage({ moderationStatus: 'published' }, currentT())).toBe('Comment sent')
      const topic = findMomentTopic('生活日常', currentT())
      // 话题名属于内容，不翻译；简介属于界面文案
      expect(topic?.name).toBe('生活日常')
      expect(topic?.description).toBe('Small joys from every day')
    })
  })
})

describe('闪念与朋友圈 Markdown 读屏文案', () => {
  it('未传翻译函数时待办名称与新窗口提示保持中文', () => {
    const doc = parse(renderFlashMarkdown(note.content))
    expect(doc.querySelector('.task-list-item-checkbox')?.getAttribute('aria-label')).toBe('待办事项')
    expect(doc.querySelector('a .sr-only')?.textContent).toBe('（在新窗口打开）')
  })

  it('传入英文翻译函数时闪念与朋友圈正文输出英文', async () => {
    await inEnglish(() => {
      for (const html of [
        renderFlashMarkdown(note.content, { t: currentT() }),
        renderMomentMarkdown(note.content, { t: currentT() }),
      ]) {
        const doc = parse(html)
        expect(doc.querySelector('.task-list-item-checkbox')?.getAttribute('aria-label')).toBe('To-do item')
        expect(doc.querySelector('a .sr-only')?.textContent).toBe('(opens in a new window)')
      }
    })
  })
})

describe('闪念与朋友圈组件英文冒烟', () => {
  it('闪念列表的空状态与加载更多', async () => {
    await inEnglish(async () => {
      const empty = await mountSuspended(FlashNoteList, { props: { notes: [], readOnly: true } })
      expect(empty.text()).toContain("The author hasn't shared any flash notes yet")
      empty.unmount()
      const more = await mountSuspended(FlashNoteList, { props: { notes: [note], readOnly: true, hasMore: true } })
      expect(more.get('.flash-note-list__more-button').text()).toContain('Load more flash notes')
      more.unmount()
    })
  })

  it('闪念卡片的类型、操作名称与新窗口提示', async () => {
    await inEnglish(async () => {
      const wrapper = await mountSuspended(FlashNoteCard, { props: { note, readOnly: false } })
      expect(wrapper.get('.fnc__type').text()).toBe('Idea')
      expect(wrapper.find('[aria-label="Copy"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="Edit flash note"]').exists()).toBe(true)
      expect(wrapper.get('.fnc__content a .sr-only').text()).toBe('(opens in a new window)')
      wrapper.unmount()
    })
  })

  it('闪念编辑器的类型切换与发布按钮', async () => {
    await inEnglish(async () => {
      const wrapper = await mountSuspended(FlashEditor)
      expect(wrapper.get('.fed__moods').text()).toContain('To-do')
      expect(wrapper.get('textarea.fed__textarea').attributes('placeholder')).toBe(
        'The idea that just crossed my mind…',
      )
      expect(wrapper.get('.fed__submit').text()).toContain('Publish')
      wrapper.unmount()
    })
  })

  it('朋友圈列表的空状态', async () => {
    await inEnglish(async () => {
      const wrapper = await mountSuspended(MomentList, {
        props: {
          moments: [],
          ownerProfile: { name: 'TixXin', avatar: '/avatar.svg', bio: '', link: '/about' },
          states: {},
          pending: false,
          hasMore: false,
          filtered: true,
        },
      })
      expect(wrapper.text()).toContain('No matching moments')
      expect(wrapper.text()).toContain('Adjust or clear the filters and try again.')
      wrapper.unmount()
    })
  })
})
