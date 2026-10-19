/**
 * @file flashCommentModeration.test.ts
 * @description 闪念评论审核前端回归：计数只计已发布、待审评论本机提示与提交提示；后台闪念评论页的列表筛选、
 *   单条审核与批量接口契约（字符串编号 + 提交时状态）
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import FlashNoteCard from '../../app/components/flash/FlashNoteCard.vue'
import FlashCommentsPage from '../../app/pages/admin/flash-comments.vue'
import {
  appendComment,
  commentSubmittedMessage,
  publishedCommentCount,
  withoutComment,
} from '../../app/features/flash/comments'
import type { FlashComment, FlashNote, ManagedFlashComment } from '../../app/features/flash/types'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  auth: {} as {
    currentUser: Ref<{ id: string } | null>
    isLoggedIn: Ref<boolean>
    restore: ReturnType<typeof vi.fn>
  },
  // 初始 query 供 i18n 插件在测试应用启动时读取路由，缺失会导致界面语言未安装
  route: { query: {} } as { path: string; fullPath: string; query: Record<string, string> },
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useToast', () => () => mocks.toast)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport('useRouter', () => () => ({
  push: vi.fn(),
  replace: vi.fn(),
  resolve: () => ({ fullPath: '' }),
  afterEach: () => () => undefined,
  beforeEach: () => () => undefined,
  // i18n 插件在测试应用启动时读取路由配置并注册解析守卫与错误处理
  beforeResolve: () => () => undefined,
  onError: () => () => undefined,
  options: {},
}))

const comment = (id: string, moderationStatus?: FlashComment['moderationStatus']): FlashComment => ({
  id,
  authorId: 'author-' + id,
  authorName: '读者' + id,
  authorAvatar: '/avatar.svg',
  content: '评论' + id,
  createdAt: '2026-10-18T01:00:00Z',
  ...(moderationStatus ? { moderationStatus } : {}),
})
const note: FlashNote = {
  id: 'note-1',
  userId: 'owner',
  content: '公开闪念',
  tags: [],
  images: [],
  type: 'memo',
  createdAt: '2026-10-18T00:00:00Z',
  updatedAt: '2026-10-18T00:00:00Z',
  likes: 0,
  comments: [],
}

describe('闪念评论展示口径', () => {
  it('计数优先使用后端已发布数，缺省时只计已发布评论', () => {
    expect(publishedCommentCount({ comments: [comment('a'), comment('b', 'pending')], commentCount: 5 })).toBe(5)
    expect(publishedCommentCount({ comments: [comment('a'), comment('b', 'pending'), comment('c', 'hidden')] })).toBe(1)
  })

  it('提交待审评论时提示审核后公开，已发布评论沿用原提示', () => {
    expect(commentSubmittedMessage(comment('a', 'pending'))).toBe('已提交，待博主审核后公开')
    expect(commentSubmittedMessage(comment('a', 'published'))).toBe('评论已发送')
    expect(commentSubmittedMessage(comment('a'))).toBe('评论已发送')
  })

  it('本地追加与删除只让已发布评论影响计数', () => {
    const base = { ...note, commentCount: 1, comments: [comment('a', 'published')] }
    const pending = appendComment(base, comment('b', 'pending'))
    expect(pending.comments.map((item) => item.id)).toEqual(['a', 'b'])
    expect(pending.commentCount).toBe(1)
    expect(appendComment(base, comment('c', 'published')).commentCount).toBe(2)
    expect(withoutComment(pending, 'b').commentCount).toBe(1)
    expect(withoutComment(pending, 'a').commentCount).toBe(0)
    expect(appendComment(note, comment('d', 'pending')).commentCount).toBeUndefined()
  })

  it('卡片计数不含待审评论，访客本人的待审评论标注仅自己可见', async () => {
    const wrapper = await mountSuspended(FlashNoteCard, {
      props: {
        note: { ...note, commentCount: 1, comments: [comment('a', 'published'), comment('b', 'pending')] },
        readOnly: true,
      },
    })
    expect(wrapper.get('.fnc__action-count').text()).toBe('1')
    await wrapper.get('button[aria-label="评论"]').trigger('click')
    const statuses = wrapper.findAll('.fnc__comment-status').map((item) => item.text())
    expect(statuses).toEqual(['待审核，仅自己可见'])
    wrapper.unmount()
  })
})

describe('后台闪念评论审核页', () => {
  const managed = (id: string, moderationStatus: ManagedFlashComment['moderationStatus']): ManagedFlashComment => ({
    ...comment(id),
    moderationStatus,
    flashId: 'flash-' + id,
    flashContent: '闪念正文' + id,
    flashStatus: 'published',
  })
  const wrappers: { unmount(): void }[] = []
  let rows: ManagedFlashComment[] = []
  beforeEach(() => {
    rows = [managed('c1', 'pending'), managed('c2', 'pending'), managed('c3', 'published')]
    mocks.api.mockReset()
    mocks.api.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/admin/flashes/comments'
          ? { items: rows, total: rows.length }
          : {
              successCount: 1,
              failedCount: 1,
              results: [
                { id: 'c1', ok: true },
                { id: 'c2', ok: false, reason: 'conflict' },
              ],
            },
      ),
    )
    Object.values(mocks.toast).forEach((mock) => mock.mockReset())
    mocks.auth = {
      currentUser: ref({ id: 'owner' }),
      isLoggedIn: ref(true),
      restore: vi.fn().mockResolvedValue(true),
    }
    mocks.route = reactive({
      path: '/admin/flash-comments',
      fullPath: '/admin/flash-comments?status=pending',
      query: { status: 'pending' },
    })
  })
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.restoreAllMocks()
  })

  it('按状态读取，单条审核携带提交时状态，批量操作以字符串编号和状态提交', async () => {
    const wrapper = await mountSuspended(FlashCommentsPage, { attachTo: document.body })
    wrappers.push(wrapper)
    await flushPromises()
    expect(mocks.api).toHaveBeenCalledWith('/admin/flashes/comments', {
      query: { status: 'pending', page: 1, pageSize: 20 },
    })
    const items = () => wrapper.findAll('li[data-flash-comment-id]')
    expect(items()).toHaveLength(3)

    await items()[0]!
      .findAll('button')
      .find((button) => button.text() === '通过审核')!
      .trigger('click')
    await flushPromises()
    expect(mocks.api).toHaveBeenCalledWith('/admin/flashes/flash-c1/comments/c1', {
      method: 'PATCH',
      body: { status: 'published', expectedStatus: 'pending' },
    })

    const boxes = () => wrapper.findAll<HTMLInputElement>('.flash-comments__select input')
    await boxes()[0]!.setValue(true)
    await boxes()[1]!.setValue(true)
    expect(wrapper.get('.admin-batch-bar [role="status"]').text()).toBe('已选择 2 条闪念评论')
    await wrapper
      .findAll('.admin-batch-bar button')
      .find((button) => button.text() === '批量隐藏')!
      .trigger('click')
    await flushPromises()
    expect(mocks.api).toHaveBeenCalledWith('/admin/flashes/comments/batch/moderation', {
      method: 'POST',
      body: {
        status: 'hidden',
        items: [
          { id: 'c1', expectedStatus: 'pending' },
          { id: 'c2', expectedStatus: 'pending' },
        ],
      },
    })
    expect(wrapper.text()).toContain('1 条已被修改，请刷新后重新选择')

    Object.defineProperty(window, 'confirm', { value: vi.fn().mockReturnValue(true), configurable: true })
    await boxes()[2]!.setValue(true)
    await wrapper
      .findAll('.admin-batch-bar button')
      .find((button) => button.text() === '批量删除')!
      .trigger('click')
    await flushPromises()
    expect(mocks.api).toHaveBeenCalledWith('/admin/flashes/comments/batch/delete', {
      method: 'POST',
      body: { items: [{ id: 'c3', expectedStatus: 'published' }] },
    })
  })
})
