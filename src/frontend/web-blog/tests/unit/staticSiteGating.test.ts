/** @file staticSiteGating.test.ts @description 静态发布形态隐藏访客互动并跳过需要后端的请求；服务器部署保持原有入口 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import ArticleStatsBar from '../../app/components/article/ArticleStatsBar.vue'
import MomentCardFooter from '../../app/components/moment/MomentCardFooter.vue'
import FlashNoteCardFooter from '../../app/components/flash/FlashNoteCardFooter.vue'
import GuestbookComposer from '../../app/components/guestbook/GuestbookComposer.vue'
import { useSetupStatus } from '../../app/composables/useSetupStatus'
import type { FlashNote } from '../../app/features/flash/types'

const mocks = vi.hoisted(() => ({ staticSite: false }))
mockNuxtImport('useStaticSite', () => () => mocks.staticSite)
const wrappers: { unmount(): void }[] = []
async function mount<T>(component: T, props: Record<string, unknown>) {
  const wrapper = await mountSuspended(component as never, { props })
  wrappers.push(wrapper)
  return wrapper
}
const note: FlashNote = {
  id: 'f1',
  userId: 'owner',
  content: '今天整理了部署笔记',
  tags: [],
  images: [],
  type: 'memo',
  createdAt: '2026-10-20T08:00:00.000Z',
  updatedAt: '2026-10-20T08:00:00.000Z',
  likes: 3,
  comments: [],
} as FlashNote
beforeEach(() => {
  mocks.staticSite = false
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})

describe('文章统计栏', () => {
  const props = {
    views: 120,
    likes: 8,
    liked: false,
    interactionPending: false,
    interactionLoaded: true,
    favorited: false,
    totalComments: 4,
    articleTitle: '部署笔记',
    canonicalUrl: 'https://blog.example/articles/1',
  }
  it('默认展示浏览、点赞与评论数', async () => {
    const wrapper = await mount(ArticleStatsBar, props)
    expect(wrapper.text()).toContain('120')
    expect(wrapper.findAll('button[aria-pressed]')).toHaveLength(2)
  })
  it('不可互动时只保留本机收藏与分享', async () => {
    const wrapper = await mount(ArticleStatsBar, { ...props, interactive: false })
    expect(wrapper.text()).not.toContain('120')
    expect(wrapper.findAll('button[aria-pressed]')).toHaveLength(1)
  })
})

describe('朋友圈、闪念与留言的互动入口', () => {
  const momentProps = {
    momentId: 'm1',
    formattedDate: '10月20日',
    likes: 2,
    isLiked: false,
    commentCount: 1,
    showComments: false,
  }
  const flashProps = { note, liked: false, commentOpen: false, commentCount: 0, relativeTime: '1 天前', readOnly: true }

  it('服务器部署保留点赞与评论按钮', async () => {
    expect((await mount(MomentCardFooter, momentProps)).find('.moment-card__actions').exists()).toBe(true)
    expect((await mount(FlashNoteCardFooter, flashProps)).findAll('button[aria-pressed]')).toHaveLength(1)
  })

  it('静态发布不渲染点赞、评论与留言发送框，保留详情链接与复制', async () => {
    mocks.staticSite = true
    const moment = await mount(MomentCardFooter, momentProps)
    expect(moment.find('.moment-card__actions').exists()).toBe(false)
    expect(moment.find('a').exists()).toBe(true)
    const flash = await mount(FlashNoteCardFooter, flashProps)
    expect(flash.findAll('button[aria-pressed]')).toHaveLength(0)
    expect(flash.findAll('button').length).toBeGreaterThan(0)
    const interactions = new Proxy({}, { get: () => vi.fn() })
    const composer = await mount(GuestbookComposer, { composerProps: {}, interactions })
    expect(composer.find('textarea').exists()).toBe(false)
  })
})

describe('需要后端的请求', () => {
  it('静态发布不请求初始化状态', async () => {
    mocks.staticSite = true
    const fetch = vi.fn()
    vi.stubGlobal('$fetch', fetch)
    let check!: ReturnType<typeof useSetupStatus>
    await mount(
      defineComponent({
        setup() {
          check = useSetupStatus()
          return () => null
        },
      }),
      {},
    )
    await expect(check()).resolves.toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
