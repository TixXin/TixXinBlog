/** @file postPreviewLink.test.ts @description 草稿预览签发的保存边界、身份所有权、复制失败与公开取数契约。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { usePostPreviewLink } from '../../app/composables/usePostPreviewLink'
import { fetchPostPreview } from '../../app/features/post/api'
import PostPreviewLinkPanel from '../../app/components/admin/PostPreviewLink.vue'
import type { AdminPostDraft } from '../../app/features/post/adminTypes'
import type { PostPreviewLink } from '../../app/features/post/types'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  auth: {} as { currentUser: Ref<{ id: string } | null> },
  fetch: vi.fn(),
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('$fetch', () => mocks.fetch)

const wrappers: { unmount(): void }[] = []
const issued = { token: 'signed-preview-token', expiresAt: '2026-10-25T12:00:00.000Z' }
const write = vi.fn()
let clipboard: PropertyDescriptor | undefined

function savedDraft(): AdminPostDraft {
  return {
    id: 23,
    revision: 2,
    title: '本机未保存标题',
    summary: '',
    cover: '',
    folder: '开发随记',
    category: 'tech',
    status: 'draft',
    contentRaw: '未保存的正文',
    pinned: false,
    readTimeMinutes: 1,
    tags: [],
  }
}

beforeEach(() => {
  mocks.api.mockReset().mockResolvedValue(issued)
  mocks.fetch.mockReset()
  mocks.auth = { currentUser: ref({ id: 'owner-a' }) }
  write.mockReset().mockResolvedValue(undefined)
  clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } })
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
  vi.unstubAllGlobals()
})

async function setup(initial = savedDraft()) {
  const draft = ref(initial)
  const busy = ref(false)
  let preview!: ReturnType<typeof usePostPreviewLink>
  let context!: Ref<string>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        context = useState<string>('page-content-context', () => '')
        context.value = 'library-a'
        preview = usePostPreviewLink(draft, busy)
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  return { draft, busy, preview, context, wrapper }
}

describe('后台草稿预览链接', () => {
  it('分享面板说明未保存边界与到期规则，并提供独立复制和安全新页入口', async () => {
    const wrapper = await mountSuspended(PostPreviewLinkPanel, {
      props: {
        saved: true,
        available: true,
        dirty: true,
        busy: false,
        pending: false,
        copying: false,
        url: 'https://blog.example/posts/preview?token=sample',
        expiresAt: issued.expiresAt,
        error: '',
        notice: '预览链接已生成，可复制分享。',
      },
      global: { stubs: { Icon: true, CommonTooltip: { template: '<span><slot /></span>' } } },
    })
    wrappers.push(wrapper)
    expect(wrapper.text()).toContain('旧链接仍有效直到过期')
    expect(wrapper.text()).toContain('生成链接不会保存当前输入')
    expect(wrapper.get('input').attributes('readonly')).toBeDefined()
    expect(wrapper.get('time').attributes('datetime')).toBe(issued.expiresAt)
    expect(wrapper.get('a').attributes()).toMatchObject({ target: '_blank', rel: 'noopener noreferrer' })
    const buttons = wrapper.findAll('button')
    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('copy')).toHaveLength(1)
    expect(wrapper.emitted('generate')).toBeUndefined()
    await wrapper.setProps({ available: false, url: '' })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('签发只发送文章编号，不保存未提交输入，修改并保存后保留旧链接', async () => {
    const { draft, preview } = await setup()
    const original = JSON.stringify(draft.value)
    await preview.generate()
    expect(mocks.api).toHaveBeenCalledExactlyOnceWith('/admin/posts/23/preview-link', { method: 'POST' })
    expect(JSON.stringify(draft.value)).toBe(original)
    expect(preview.url.value).toBe(`${window.location.origin}/posts/preview?token=signed-preview-token`)
    expect(preview.link.value?.expiresAt).toBe(issued.expiresAt)
    draft.value = { ...draft.value, contentRaw: '后来保存的正文', revision: 3, savedAt: '2026-10-18T12:05:00Z' }
    expect(preview.url.value).toContain(issued.token)
    expect(mocks.api).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['新建文章', { id: undefined }],
    ['已发布文章', { status: 'published' as const }],
    ['归档文章', { status: 'archived' as const }],
    ['已删除草稿', { deletedAt: '2026-10-18T12:00:00Z' }],
  ])('%s 不能签发预览', async (_label, changes) => {
    const { preview } = await setup({ ...savedDraft(), ...changes })
    expect(preview.available.value).toBe(false)
    await preview.generate()
    expect(mocks.api).not.toHaveBeenCalled()
  })

  it('保存期间和重复点击不会并发签发', async () => {
    const { busy, preview } = await setup()
    busy.value = true
    await preview.generate()
    expect(mocks.api).not.toHaveBeenCalled()
    busy.value = false
    let resolve!: (value: PostPreviewLink) => void
    mocks.api.mockImplementationOnce(() => new Promise<PostPreviewLink>((done) => (resolve = done)))
    const pending = preview.generate()
    await preview.generate()
    expect(mocks.api).toHaveBeenCalledTimes(1)
    resolve(issued)
    await pending
    expect(preview.pending.value).toBe(false)
  })

  it.each(['文章', '发布状态', '账号', '内容库', '卸载'])('%s 变化后清除链接并丢弃在途签发结果', async (change) => {
    const { draft, preview, context, wrapper } = await setup()
    await preview.generate()
    let resolve!: (value: PostPreviewLink) => void
    mocks.api.mockImplementationOnce(() => new Promise<PostPreviewLink>((done) => (resolve = done)))
    const pending = preview.generate()
    if (change === '文章') draft.value.id = 24
    if (change === '发布状态') draft.value.status = 'published'
    if (change === '账号') mocks.auth.currentUser.value = { id: 'owner-b' }
    if (change === '内容库') context.value = 'library-b'
    if (change === '卸载') wrapper.unmount()
    expect(preview.link.value).toBeNull()
    resolve({ ...issued, token: 'stale-token' })
    await pending
    expect(preview.link.value).toBeNull()
    expect(preview.url.value).toBe('')
  })

  it('失败保留输入与已有链接，复制失败允许手动复制及重试', async () => {
    const { draft, preview } = await setup()
    const original = JSON.stringify(draft.value)
    await preview.generate()
    mocks.api.mockRejectedValueOnce({ data: { message: '草稿暂时无法读取' } })
    await preview.generate()
    expect(preview.error.value).toBe('草稿暂时无法读取')
    expect(preview.url.value).toContain(issued.token)
    expect(JSON.stringify(draft.value)).toBe(original)
    write.mockRejectedValueOnce(new Error('denied'))
    await preview.copy()
    expect(preview.error.value).toContain('手动选择并复制')
    expect(preview.url.value).toContain(issued.token)
    await preview.copy()
    expect(preview.notice.value).toBe('预览链接已复制。')
    expect(write).toHaveBeenLastCalledWith(preview.url.value)
  })
})

describe('公开预览请求', () => {
  it('使用专用令牌接口并禁止缓存，不发送访客身份或触发互动请求', async () => {
    mocks.fetch.mockResolvedValue({
      code: 0,
      data: {
        id: '23',
        title: '当前已保存草稿',
        date: '2026-10-18T12:00:00.000Z',
        contentRaw: '最新正文',
        seoNoindex: true,
        commentEnabled: false,
        toc: [],
      },
    })
    const controller = new AbortController()
    const result = await fetchPostPreview('/api/v1/', 'signed.token', controller.signal)
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/v1/posts/preview', {
      query: { token: 'signed.token' },
      signal: controller.signal,
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      timeout: 10000,
      retry: 0,
    })
    expect(result).toMatchObject({
      date: '2026-10-18',
      contentRaw: '最新正文',
      commentEnabled: false,
      seoNoindex: true,
    })
  })

  it('无效签名或到期错误直接交给页面处理，不回退 Mock', async () => {
    mocks.fetch.mockRejectedValue({ statusCode: 404 })
    await expect(fetchPostPreview('/api/v1', 'expired.token')).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
})
