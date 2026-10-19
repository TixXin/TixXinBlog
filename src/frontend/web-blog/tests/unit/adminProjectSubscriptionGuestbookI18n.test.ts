/**
 * @file adminProjectSubscriptionGuestbookI18n.test.ts
 * @description 后台项目、订阅与留言管理的英文冒烟：列表、表单、恢复副本与留言管理的关键文案随界面语言切换
 * @author TixXin
 * @since 2026-10-19
 */
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, reactive, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import ProjectForm from '../../app/components/admin/ProjectForm.vue'
import ProjectRecoveryDetails from '../../app/components/admin/ProjectRecoveryDetails.vue'
import AdminProjectsPage from '../../app/pages/admin/projects/index.vue'
import AdminSubscriptionsPage from '../../app/pages/admin/subscriptions/index.vue'
import AdminGuestbookPage from '../../app/pages/admin/guestbook.vue'
import { projectForm } from '../../app/features/project/editor'
import type { ManagedProject } from '../../app/features/project/types'

const mocks = vi.hoisted(() => ({ projects: {} as unknown, subscriptions: {} as unknown, guestbook: {} as unknown }))
mockNuxtImport('useAdminProjects', () => () => mocks.projects)
mockNuxtImport('useAdminSubscriptions', () => () => mocks.subscriptions)
mockNuxtImport('useAdminGuestbook', () => () => mocks.guestbook)
mockNuxtImport('useGuestbookInteractions', () => () => ({
  state: reactive({
    draft: '',
    reply: null,
    submitting: false,
    error: '',
    notice: '',
    storageError: '',
    recovery: null,
  }),
  ready: ref(true),
  expired: ref(false),
  setDraft: vi.fn(),
  submit: vi.fn(),
  setReply: vi.fn(),
  restore: vi.fn(),
  discardRecovery: vi.fn(),
  openLogin: vi.fn(),
  persist: vi.fn(),
}))
mockNuxtImport('useAdminApi', () => () => vi.fn().mockResolvedValue({ items: [], total: 0 }))

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

const passthrough = { template: '<div><slot /></div>' }
const stubs = {
  ClientOnly: passthrough,
  AdminBackLink: passthrough,
  AdminActionBar: passthrough,
  CommonTooltip: passthrough,
  AdminMediaPicker: true,
  AdminContentRelations: true,
  AdminBatchBar: defineComponent({ props: ['noun', 'actions'], template: '<div>{{ noun }}</div>' }),
  CommonImageFrame: true,
  CommonRequestFeedback: true,
  SubscriptionFilters: true,
  SubscriptionHistory: true,
  GuestbookMessageInput: true,
}

const project = {
  id: 5,
  title: 'TixXinBlog',
  description: '个人博客',
  status: 'published',
  progress: 'active',
  sortOrder: 2,
  revision: 3,
  tags: [{ label: 'Vue', color: 'blue' }],
  links: [{ kind: 'source', href: 'https://example.com' }],
  cover: null,
  coverMediaId: null,
  width: null,
  height: null,
  relatedContent: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  publishedAt: null,
} as unknown as ManagedProject

describe('后台项目、订阅与留言英文冒烟', () => {
  it('项目列表与表单切到英文', async () => {
    mocks.projects = {
      data: ref({ items: [project], total: 1 }),
      pending: ref(false),
      error: ref(''),
      notice: ref(''),
      busy: ref([]),
      query: computed(() => ({ page: 1, status: 'all' })),
      filter: vi.fn(),
      load: vi.fn(),
      mutate: vi.fn(),
      isLoggedIn: ref(true),
      restoringPending: ref(false),
      stale: ref(false),
    }
    await inEnglish(async () => {
      const list = await mountSuspended(AdminProjectsPage, { global: { stubs } })
      expect(list.text()).toContain('New project')
      expect(list.text()).toContain('Published · Maintained · Sort 2 · Revision 3')
      expect(list.text()).toContain('Withdraw project')
      expect(list.text()).not.toContain('项目管理')
      list.unmount()

      const form = await mountSuspended(ProjectForm, {
        props: {
          value: reactive(projectForm({ title: 'TixXinBlog', tags: [{ label: 'Vue', color: 'blue' }] })),
          id: 5,
          saved: project,
          serverVersion: null,
          recovery: null,
          previousRecoveries: [],
          ready: true,
          loading: false,
          saving: false,
          dirty: false,
          error: '',
          notice: '',
          localError: '',
        },
        global: { stubs },
      })
      expect(form.get('h1').text()).toBe('Edit project')
      expect(form.text()).toContain('Tech tags (1 / 20)')
      expect(form.text()).toContain('All changes saved')
      expect(form.find('option[value="blue"]').text()).toBe('Blue')
      form.unmount()

      const details = await mountSuspended(ProjectRecoveryDetails, {
        props: { value: projectForm({ title: '', links: [{ kind: 'demo', href: '' }] }) },
      })
      expect(details.text()).toContain('Not provided')
      expect(details.text()).toContain('URL not provided')
      details.unmount()
    })
  })

  it('订阅与留言管理切到英文', async () => {
    mocks.subscriptions = {
      data: ref({ items: [], total: 3 }),
      pending: ref(false),
      error: ref(''),
      notice: ref(''),
      busy: ref([]),
      query: ref({ page: 1, pageSize: 20, status: 'all' }),
      filter: vi.fn(),
      load: vi.fn(),
      mutate: vi.fn(),
      stale: ref(false),
    }
    mocks.guestbook = {
      isLoggedIn: ref(true),
      restoring: ref(false),
      q: ref(''),
      status: ref('all'),
      unanswered: ref(false),
      date: ref(''),
      page: ref(1),
      items: ref([
        {
          id: 1,
          author: '访客',
          content: '你好',
          isOwner: false,
          isPinned: true,
          moderationStatus: 'pending',
          createdAt: '2026-10-01T08:30:00.000Z',
          replyTo: null,
        },
      ]),
      total: ref(1),
      pending: ref(false),
      error: ref(''),
      busy: ref([]),
      selected: ref(null),
      detailPending: ref(false),
      detailError: ref(''),
      load: vi.fn(),
      focus: vi.fn(),
      close: vi.fn(),
      apply: vi.fn(),
      setPage: vi.fn(),
      change: vi.fn(),
      selection: {
        count: ref(0),
        allSelected: ref(false),
        partiallySelected: ref(false),
        isSelected: () => false,
        toggle: vi.fn(),
        toggleAll: vi.fn(),
        clear: vi.fn(),
      },
      batchBusy: ref(''),
      batch: vi.fn(),
      retryDetail: vi.fn(),
    }
    await inEnglish(async () => {
      const subscriptions = await mountSuspended(AdminSubscriptionsPage, { global: { stubs } })
      expect(subscriptions.get('h1').text()).toBe('Subscriptions')
      expect(subscriptions.text()).toContain('3 matching subscriptions')
      expect(subscriptions.find('option[value="published"]').text()).toBe('Published')
      subscriptions.unmount()

      const guestbook = await mountSuspended(AdminGuestbookPage, { global: { stubs } })
      expect(guestbook.get('h1').text()).toBe('Guestbook')
      expect(guestbook.text()).toContain('Pending review · Pinned · 2026-10-01 08:30 UTC')
      expect(guestbook.text()).toContain('Unpin')
      expect(guestbook.text()).toContain('messages')
      guestbook.unmount()
    })
  })
})
