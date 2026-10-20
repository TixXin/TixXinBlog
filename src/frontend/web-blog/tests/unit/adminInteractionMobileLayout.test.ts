/** @file adminInteractionMobileLayout.test.ts @description 后台互动页面移动布局契约：保留卡片正文、可换行工具栏与有名称的分页容器 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import type { Component, Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import CommentsPage from '../../app/pages/admin/comments.vue'
import MomentCommentsPage from '../../app/pages/admin/moment-comments.vue'
import GuestbookPage from '../../app/pages/admin/guestbook.vue'
import AuditPage from '../../app/pages/admin/audit.vue'
import NotificationsPage from '../../app/pages/admin/notifications.vue'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  auth: {} as {
    currentUser: Ref<{ id: string } | null>
    isLoggedIn: Ref<boolean>
    initialized: Ref<boolean>
    restoringPending: Ref<boolean>
    authError: Ref<string>
    restore: ReturnType<typeof vi.fn>
  },
  // 初始 query 供 i18n 插件在测试应用启动时读取路由，缺失会导致界面语言未安装
  route: { query: {} } as { path: string; fullPath: string; query: Record<string, string> },
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport('useToast', () => () => ({ success: vi.fn(), error: vi.fn() }))

const wrappers: { unmount(): void }[] = []
const longText = 'https://example.com/' + 'long-unbroken-content'.repeat(12)
const comment = {
  id: 1,
  author: '读者',
  content: longText,
  status: 'published',
  revision: 1,
  depth: 0,
  isOwner: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  visible: true,
  postId: 10,
  postTitle: longText,
  postStatus: 'published',
  parentId: null,
}
beforeEach(() => {
  mocks.auth = {
    currentUser: ref({ id: 'owner-mobile-layout' }),
    isLoggedIn: ref(true),
    initialized: ref(true),
    restoringPending: ref(false),
    authError: ref(''),
    restore: vi.fn().mockResolvedValue(true),
  }
  mocks.route = reactive({ path: '/', fullPath: '/', query: {} })
  mocks.api.mockReset().mockImplementation(async (path: string) => {
    if (path === '/admin/comments') return { items: [comment], total: 41 }
    if (path === '/admin/comments/articles') return [{ id: 10, title: longText }]
    if (path === '/admin/comments/policy') return { requireApproval: false, revision: 1 }
    if (path === '/admin/comments/1/context')
      return {
        target: comment,
        ancestors: [],
        replies: [],
        total: 21,
        page: 1,
        deleteTotal: 1,
        visibleTotal: 1,
        approvedVisibleTotal: 1,
        post: { id: 10, title: longText, status: 'published' },
      }
    if (path === '/admin/moments/comments')
      return {
        items: [
          {
            id: 'moment-comment',
            author: '读者',
            content: longText,
            momentId: 'moment',
            momentContent: longText,
            momentStatus: 'published',
            moderationStatus: 'published',
            time: '2026-10-01T00:00:00.000Z',
          },
        ],
        total: 41,
      }
    if (path === '/admin/guestbook')
      return {
        items: [
          {
            ...comment,
            moderationStatus: 'published',
            isPinned: false,
            replyTo: { id: 2, author: '博主', content: longText },
          },
        ],
        total: 41,
      }
    if (path === '/admin/audit/actions') return { 'post.update': longText }
    if (path === '/admin/audit')
      return {
        items: [
          {
            id: 'audit-record',
            action: 'post.update',
            actionLabel: '修改文章',
            actor: longText,
            resourceType: 'post',
            resourceId: '10',
            state: 'success',
            summary: { fields: [longText] },
            createdAt: '2026-10-01T00:00:00.000Z',
            traceId: longText,
          },
        ],
        total: 41,
        health: { waitingResults: 0, retryQueue: 0, droppedRetries: 0 },
      }
    if (path === '/admin/notifications')
      return {
        items: [
          {
            id: 'notification',
            kind: 'comment',
            state: 'unavailable',
            url: null,
            createdAt: '2026-10-01T00:00:00.000Z',
            readAt: null,
          },
        ],
        unread: 1,
        total: 41,
      }
    throw new Error(`未预期的布局测试请求：${path}`)
  })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  useState('admin-notification-unread').value = null
})

async function render(component: Component, path: string, query: Record<string, string> = {}) {
  Object.assign(mocks.route, { path, fullPath: path, query })
  const wrapper = await mountSuspended(component, {
    global: { stubs: { GuestbookMessageInput: true } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

it('文章评论将筛选、卡片操作和两处分页放入独立换行容器，保留回复输入与完整长正文', async () => {
  const wrapper = await render(CommentsPage, '/admin/comments', { commentId: '1' })
  const filters = wrapper.get('form.admin-comments__filters')
  expect(filters.findAll('select')).toHaveLength(2)
  expect(filters.findAll('.date-picker__input')).toHaveLength(2)
  expect(filters.get('[aria-label="按文章筛选评论"]').text()).toContain(longText)
  const row = wrapper.get('.admin-comments__list > li')
  expect(row.text()).toContain(longText)
  expect(row.get('.admin-comments__select input').attributes('type')).toBe('checkbox')
  expect(row.get('.admin-comments__actions').findAll('button')).toHaveLength(5)
  expect(wrapper.get('nav[aria-label="评论分页"]').classes()).toContain('admin-comments__pagination')
  expect(wrapper.get('nav[aria-label="上下文回复分页"]').classes()).toContain('admin-comments__pagination')
  await row
    .get('.admin-comments__actions')
    .findAll('button')
    .find((button) => button.text() === '回复')!
    .trigger('click')
  expect(wrapper.get('.admin-comments__reply textarea').attributes('aria-label')).toBe('博主回复内容')
})

it('朋友圈评论保留完整卡片引用和可换行筛选、操作、分页', async () => {
  const wrapper = await render(MomentCommentsPage, '/admin/moment-comments')
  expect(wrapper.get('nav[aria-label="朋友圈评论筛选"]').classes()).toContain('moment-comments__actions')
  const row = wrapper.get('.moment-comments__list > li')
  expect(row.get('blockquote').text()).toContain(longText)
  expect(row.get('.moment-comments__actions').findAll('button')).toHaveLength(2)
  expect(wrapper.get('nav[aria-label="朋友圈评论分页"]').classes()).toContain('moment-comments__actions')
})

it('留言管理保留移动筛选、卡片操作及独立分页类名，长正文与引用均可读取', async () => {
  const wrapper = await render(GuestbookPage, '/admin/guestbook')
  expect(wrapper.get('.admin-guestbook__filters .date-picker__input').attributes('aria-label')).toBe('留言日期')
  const row = wrapper.get('.admin-guestbook__list > li')
  expect(row.get('.admin-guestbook__content').text()).toBe(longText)
  expect(row.text()).toContain(`引用 博主：${longText}`)
  expect(row.get('.admin-guestbook__actions').findAll('button')).toHaveLength(5)
  expect(wrapper.get('nav[aria-label="管理留言分页"]').classes()).toContain('admin-guestbook__pagination')
})

it('审计筛选和分页可独立换行，卡片标题、请求编号和提交字段保持完整', async () => {
  const wrapper = await render(AuditPage, '/admin/audit')
  expect(wrapper.get('.admin-audit__filters').findAll('label')).toHaveLength(4)
  expect(wrapper.get('nav[aria-label="审计记录分页"]').classes()).toContain('admin-audit__pagination')
  const row = wrapper.get('.audit-log > li')
  expect(row.get('.audit-log__header').text()).toContain('修改文章')
  expect(row.get('small').text()).toContain(longText)
  expect(row.text()).toContain(`提交字段：${longText}`)
})

it('通知筛选、摘要、卡片操作和分页保留移动布局容器与键盘焦点目标', async () => {
  const wrapper = await render(NotificationsPage, '/admin/notifications')
  expect(wrapper.get('nav[aria-label="通知筛选"]').classes()).toContain('notifications__filters')
  expect(wrapper.get('.notifications__summary button').text()).toContain('全部标记已读')
  const row = wrapper.get('.notifications__list > li')
  expect(row.attributes('tabindex')).toBe('-1')
  expect(row.get('.notifications__actions span').text()).toContain('内容已删除或隐藏')
  expect(row.get('.notifications__actions button').text()).toBe('标记已读')
  expect(wrapper.get('nav[aria-label="通知分页"]').classes()).toContain('notifications__pagination')
})
