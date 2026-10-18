/** @file postPreview.test.ts @description 草稿预览的响应所有权、生命周期清理、只读渲染与搜索隔离 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { usePostPreview } from '../../app/composables/usePostPreview'
import { fetchPostPreview } from '../../app/features/post/api'
import type { PostPreviewDetail } from '../../app/features/post/types'
import PreviewPage from '../../app/pages/posts/preview.vue'

vi.mock('../../app/features/post/api', async (original) => ({
  ...(await original<typeof import('../../app/features/post/api')>()),
  fetchPostPreview: vi.fn(),
}))
const { seo, head, interaction, comments, history, navigate } = vi.hoisted(() => ({
  seo: vi.fn(),
  head: vi.fn(),
  interaction: vi.fn(),
  comments: vi.fn(),
  history: vi.fn(),
  // 页面测试在同一文档内挂载；不执行跨预览边界的整页导航，否则路由查询到不了组件。
  navigate: vi.fn(),
}))
mockNuxtImport('usePageSeo', () => seo)
mockNuxtImport('useHead', () => head)
mockNuxtImport('useArticleInteraction', () => interaction)
mockNuxtImport('useArticleComments', () => comments)
mockNuxtImport('useReadingHistory', () => history)
mockNuxtImport('navigateTo', () => navigate)

const draft: PostPreviewDetail = {
  id: '7',
  title: '尚未发布的散步笔记',
  cover: '',
  date: '2026-10-18',
  category: '生活',
  readTime: '2 分钟',
  views: 9,
  likes: 3,
  comments: 2,
  contentRaw: '## 傍晚\n\n河边的风开始凉了。',
  toc: [{ id: 'heading-1', text: '傍晚', level: 2 }],
  commentEnabled: false,
  seoNoindex: true,
}
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchPostPreview).mockReset().mockResolvedValue(draft)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

async function setup(initial = 'first-token') {
  const token = ref(initial)
  let state!: Awaited<ReturnType<typeof usePostPreview>>
  let app!: ReturnType<typeof useNuxtApp>
  const wrapper = await mountSuspended(
    defineComponent({
      async setup() {
        app = useNuxtApp()
        state = await usePostPreview(token)
        return () => h('div', state.article.value?.title ?? '')
      },
    }),
  )
  wrappers.push(wrapper)
  return { state, token, app, wrapper }
}

describe('页面独占预览读取', () => {
  it('每次进入和刷新读取最新草稿，保留原令牌且不采用上次正文缓存', async () => {
    const { state, wrapper } = await setup()
    expect(state.article.value?.title).toBe(draft.title)
    vi.mocked(fetchPostPreview).mockResolvedValueOnce({ ...draft, title: '保存后的新标题' })
    await state.refresh()
    expect(state.article.value?.title).toBe('保存后的新标题')
    expect(vi.mocked(fetchPostPreview).mock.calls.map((call) => call[1])).toEqual(['first-token', 'first-token'])
    wrapper.unmount()
    await setup()
    expect(fetchPostPreview).toHaveBeenCalledTimes(3)
  })

  it('刷新失败立即撤回旧正文，重试后恢复真实响应', async () => {
    const { state } = await setup()
    vi.mocked(fetchPostPreview).mockRejectedValueOnce(new Error('预览链接无效或已过期'))
    const request = state.refresh()
    expect(state.article.value).toBeNull()
    await request
    expect(state.article.value).toBeNull()
    expect(state.error.value?.message).toBe('预览链接无效或已过期')
    await state.refresh()
    expect(state.article.value?.title).toBe(draft.title)
  })

  it('切换令牌立即清空，取消旧请求，迟到响应不能覆盖当前草稿', async () => {
    const { state, token } = await setup()
    let finish!: (value: PostPreviewDetail) => void
    vi.mocked(fetchPostPreview).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    token.value = 'second-token'
    expect(state.article.value).toBeNull()
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    const oldSignal = vi.mocked(fetchPostPreview).mock.calls.at(-1)![2]!
    vi.mocked(fetchPostPreview).mockResolvedValueOnce({ ...draft, title: '另一个草稿' })
    token.value = 'third-token'
    await vi.waitFor(() => expect(state.article.value?.title).toBe('另一个草稿'))
    expect(oldSignal.aborted).toBe(true)
    finish({ ...draft, title: '迟到的私有草稿' })
    await flushPromises()
    expect(state.article.value?.title).toBe('另一个草稿')
  })

  it('离开页面清除临时水合正文并中止在途请求', async () => {
    const { state, app, wrapper } = await setup()
    const entry = Object.entries(app.payload.data).find(
      ([key, value]) =>
        key.startsWith('post-preview-') && (value as { article?: PostPreviewDetail } | undefined)?.article?.id === '7',
    )
    expect(entry).toBeTruthy()
    const signal = vi.mocked(fetchPostPreview).mock.calls.at(-1)![2]!
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    expect(state.article.value).toBeNull()
    expect(app.payload.data[entry![0]]).toBeUndefined()
  })
})

describe('预览页面', () => {
  const global = {
    stubs: {
      CommonCustomScrollbar: { template: '<div><slot /></div>' },
      Icon: true,
    },
  }

  it('复用 Markdown 正文与详情标题，显式提示最新内容和有效期，不挂载评论或记录浏览历史', async () => {
    const wrapper = await mountSuspended(PreviewPage, { route: '/posts/preview?token=shared-token', global })
    wrappers.push(wrapper)
    expect(wrapper.get('h1').text()).toBe(draft.title)
    expect(wrapper.get('.article-markdown').text()).toContain('河边的风开始凉了。')
    expect(wrapper.get('[aria-label="草稿预览说明"]').text()).toContain('预览，尚未发布')
    expect(wrapper.text()).toContain('原链接仍有效直到过期')
    expect(wrapper.text()).toContain('7 天')
    expect(interaction).not.toHaveBeenCalled()
    expect(comments).not.toHaveBeenCalled()
    expect(history).not.toHaveBeenCalled()
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(seo).toHaveBeenCalledWith(
      expect.objectContaining({ title: '草稿预览', robots: 'noindex, nofollow, noarchive' }),
    )
    expect(head).toHaveBeenCalledWith({ meta: [{ name: 'referrer', content: 'no-referrer' }] })
    expect(fetchPostPreview).toHaveBeenCalledWith(expect.any(String), 'shared-token', expect.any(AbortSignal))
  })

  it('旧结构化正文仍由既有 ArticleContent 渲染', async () => {
    vi.mocked(fetchPostPreview).mockResolvedValueOnce({
      ...draft,
      contentRaw: undefined,
      content: [{ type: 'paragraph', text: '旧文章的结构化草稿。' }],
    })
    const wrapper = await mountSuspended(PreviewPage, { route: '/posts/preview?token=legacy-token', global })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.find('.article-content__paragraph').text()).toBe('旧文章的结构化草稿。'))
  })

  it('失效链接显示可读错误和键盘可用的重试按钮，不呈现任何草稿正文', async () => {
    vi.mocked(fetchPostPreview).mockRejectedValueOnce(new Error('预览链接无效或已过期，请向博主获取新的链接。'))
    const wrapper = await mountSuspended(PreviewPage, { route: '/posts/preview?token=expired-token', global })
    wrappers.push(wrapper)
    expect(wrapper.get('[role="alert"]').text()).toContain('预览链接无效或已过期')
    expect(wrapper.find('.article-markdown').exists()).toBe(false)
    await wrapper.get('button[type="button"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.article-markdown').exists()).toBe(true))
  })
})
