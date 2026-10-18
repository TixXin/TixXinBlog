/**
 * @file visitorTextXss.test.ts
 * @description 四类访客正文的实际渲染安全回归；存储原文共用后端语料，不替换 Markdown 或 Vue 渲染器。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount } from '@vue/test-utils'
import cases from '../../../../../tests/fixtures/visitor-text-xss.json'
import CommentBubble from '../../app/components/article/CommentBubble.vue'
import MessageBubble from '../../app/components/guestbook/MessageBubble.vue'
import PinnedMessage from '../../app/components/guestbook/PinnedMessage.vue'
import FlashNoteCard from '../../app/components/flash/FlashNoteCard.vue'
import MomentCommentSection from '../../app/components/moment/MomentCommentSection.vue'
import { renderMomentMarkdown } from '../../app/composables/useMomentMarkdown'
import type { CommentItem } from '../../app/features/post/types'
import type { GuestMessage } from '../../app/features/guestbook/types'
import type { FlashNote } from '../../app/features/flash/types'
import { expectSafeVisitorDom } from '../helpers/visitorTextXss'

mockNuxtImport('useToast', () => () => ({ success: () => {}, error: () => {} }))
enableAutoUnmount(afterEach)

// 后端用同一语料验证原文存储及投影；这里从 JSON 正文进入真实前端渲染路径。
const storedCases = [...cases.attacks, cases.normal]
const nickname = '<img src=x onerror=alert(1)>'
const stubs = {
  Icon: true,
  CommonTooltip: { template: '<span><slot /></span>' },
  MomentUserPopover: { template: '<span><slot /></span>' },
  CommonContentImage: true,
}
const global = { stubs }
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')
const roundTrip = (input: string): string => JSON.parse(JSON.stringify({ content: input })).content

function articleComment(content: string): CommentItem {
  return { id: 1, author: nickname, avatar: '', content, time: '刚刚', likes: 0 }
}

function guestMessage(content: string): GuestMessage {
  return {
    id: 1,
    author: nickname,
    avatar: '',
    content,
    time: '刚刚',
    isOwner: false,
    moderationStatus: 'published',
    replyTo: { id: 2, author: nickname, content },
  }
}

function flashNote(content: string): FlashNote {
  return {
    id: '1',
    userId: 'owner',
    content: '博主闪念',
    tags: [],
    images: [],
    type: 'memo',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
    likes: 0,
    comments: [
      {
        id: '1',
        authorId: 'visitor',
        authorName: nickname,
        authorAvatar: '',
        content,
        createdAt: '2026-10-18T00:00:00.000Z',
      },
    ],
  }
}

describe('文章评论文本节点', () => {
  it.each(storedCases)('$name：正文、昵称和回复不会成为 HTML', async ({ input }) => {
    const content = roundTrip(input)
    const comment = { ...articleComment(content), replies: [{ ...articleComment(content), id: 2 }] }
    const wrapper = await mountSuspended(CommentBubble, { props: { comment }, global })
    const bodies = wrapper.findAll('.comment-bubble__content')
    expect(bodies).toHaveLength(2)
    for (const body of bodies) {
      expect(body.element.textContent).toBe(input)
      expect(body.element.children).toHaveLength(0)
      expectSafeVisitorDom(body.element)
    }
    for (const author of wrapper.findAll('.comment-bubble__author')) {
      expect(author.element.textContent).toBe(nickname)
      expect(author.element.children).toHaveLength(0)
    }
  })
})

describe('留言文本节点', () => {
  it.each(storedCases)('$name：搜索高亮、回复引用和置顶仍按文本显示', async ({ input }) => {
    const message = guestMessage(roundTrip(input))
    const wrapper = await mountSuspended(MessageBubble, { props: { message, highlight: '安全正文' }, global })
    const body = wrapper.get('.message-bubble__text')
    expect(body.element.textContent).toBe(input)
    expect(body.get('mark').text()).toBe('安全正文')
    expect([...body.element.children].every((element) => element.tagName === 'MARK')).toBe(true)
    expectSafeVisitorDom(body.element)
    const reply = wrapper.get('.message-bubble__reply-content')
    expect(reply.element.textContent).toBe(input)
    expect(reply.element.children).toHaveLength(0)
    expectSafeVisitorDom(reply.element)
    const author = wrapper.get('.message-bubble__name')
    expect(author.element.textContent).toBe(nickname)
    expect(author.element.children).toHaveLength(0)
    expect(wrapper.get('.message-bubble__reply--link').attributes('aria-label')).toBe(
      `跳到 ${nickname} 的原留言：${input}`,
    )
    const pinned = await mountSuspended(PinnedMessage, { props: { message }, global })
    const pinnedBody = pinned.get('.pinned-message__content')
    expect(pinnedBody.element.textContent).toBe(input)
    expect(pinnedBody.element.children).toHaveLength(0)
    expectSafeVisitorDom(pinnedBody.element)
  })
})

describe('闪念评论文本节点', () => {
  it.each(storedCases)('$name：打开评论区后正文和昵称不会成为 HTML', async ({ input }) => {
    const wrapper = await mountSuspended(FlashNoteCard, {
      props: { note: flashNote(roundTrip(input)), readOnly: true },
      global,
    })
    await wrapper.get('button[aria-label="评论"]').trigger('click')
    const body = wrapper.get('.fnc__comment-text')
    expect(body.element.textContent).toBe(input)
    expect(body.element.children).toHaveLength(0)
    expectSafeVisitorDom(body.element)
    const author = wrapper.get('.fnc__comment-name')
    expect(author.element.textContent).toBe(nickname)
    expect(author.element.children).toHaveLength(0)
  })
})

describe('朋友圈评论真实 Markdown 渲染器及组件', () => {
  it.each(storedCases)('$name：inline 与提及处理后没有可执行标签、属性或协议', async ({ input }) => {
    const content = roundTrip(input)
    const html = renderMomentMarkdown(content, { inline: true, mentions: true })
    expectSafeVisitorDom(parse(html).body)
    // 再次解析实际输出，覆盖 HTML 插入 DOM 的边界，不以字符串包含 alert 等文字判定漏洞。
    expectSafeVisitorDom(parse(parse(html).body.innerHTML).body)
    const wrapper = await mountSuspended(MomentCommentSection, {
      props: { comments: [{ id: '1', author: nickname, avatar: '', time: '刚刚', content }], draft: '' },
      global,
    })
    expectSafeVisitorDom(wrapper.get('.moment-comments__text').element)
    const author = wrapper.get('.moment-comments__author')
    expect(author.element.textContent).toBe(nickname)
    expect(author.element.children).toHaveLength(0)
  })

  it('保留中文、强调、代码、站内链接、外链及提及，避免通过清空正文取得安全断言', () => {
    const doc = parse(renderMomentMarkdown(cases.normal.input, { inline: true, mentions: true }))
    expect(doc.querySelector('strong')?.textContent).toBe('重点')
    expect(doc.querySelector('em')?.textContent).toBe('斜体')
    expect(doc.querySelector('code')?.textContent).toBe('a < b')
    expect(doc.querySelector('br')).not.toBeNull()
    const links = doc.querySelectorAll('a')
    expect(links).toHaveLength(2)
    expect(links[0]?.getAttribute('href')).toBe('/posts/hello')
    expect(links[0]?.hasAttribute('target')).toBe(false)
    expect(links[1]?.getAttribute('href')).toBe('https://example.test/read?q=1&lang=zh')
    expect(links[1]?.getAttribute('target')).toBe('_blank')
    expect(links[1]?.getAttribute('rel')?.split(' ')).toEqual(expect.arrayContaining(['noopener', 'noreferrer']))
    expect(doc.querySelector('.mention')?.textContent).toBe('@小明')
  })
})
