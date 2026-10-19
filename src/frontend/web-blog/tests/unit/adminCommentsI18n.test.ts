/**
 * @file adminCommentsI18n.test.ts
 * @description 后台评论审核与分类标签页的英文冒烟：文章评论、闪念评论、朋友圈评论与分类标签页在英文界面下的关键文案，
 *              以及默认中文界面保持原文
 * @author TixXin
 * @since 2026-10-19
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import CommentsPage from '../../app/pages/admin/comments.vue'
import FlashCommentsPage from '../../app/pages/admin/flash-comments.vue'
import MomentCommentsPage from '../../app/pages/admin/moment-comments.vue'
import TaxonomyPage from '../../app/pages/admin/taxonomy.vue'

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
  resolve: () => ({ fullPath: mocks.route.fullPath }),
  afterEach: () => () => undefined,
  beforeEach: () => () => undefined,
  beforeResolve: () => () => undefined,
  onError: () => () => undefined,
  options: {},
}))
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)

/** 用到时再取：收集阶段 Nuxt 测试应用尚未就绪 */
const i18n = () => useNuxtApp().$i18n

async function inEnglish(run: () => Promise<void>) {
  await i18n().setLocale('en')
  try {
    await run()
  } finally {
    await i18n().setLocale('zh-CN')
  }
}

const wrappers: { unmount(): void }[] = []
async function mountPage(component: Parameters<typeof mountSuspended>[0], path: string) {
  mocks.route = reactive({ path, fullPath: path, query: {} })
  const wrapper = await mountSuspended(component)
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

function respond(path: string) {
  if (path === '/admin/comments/policy') return { requireApproval: true, revision: 3 }
  if (path === '/admin/comments/articles') return [{ id: 1, title: 'Post A' }]
  if (path === '/admin/comments')
    return {
      items: [
        {
          id: 7,
          status: 'pending',
          revision: 1,
          author: 'Reader',
          content: 'Nice post',
          depth: 0,
          isOwner: false,
          createdAt: '2026-10-18T01:00:00Z',
          visible: false,
          postId: 1,
          postTitle: 'Post A',
          postStatus: 'published',
          parentId: null,
        },
      ],
      total: 1,
    }
  if (path === '/admin/flashes/comments')
    return {
      items: [
        {
          id: 'c1',
          authorId: 'a1',
          authorName: 'Reader',
          authorAvatar: '/avatar.svg',
          content: 'Nice flash',
          createdAt: '2026-10-18T01:00:00Z',
          moderationStatus: 'pending',
          flashId: 'f1',
          flashContent: 'A flash',
          flashStatus: 'published',
        },
      ],
      total: 1,
    }
  if (path === '/admin/moments/comments')
    return {
      items: [
        {
          id: 'm1',
          author: 'Reader',
          isOwner: false,
          content: 'Nice moment',
          time: '2026-10-18T01:00:00Z',
          moderationStatus: 'hidden',
          momentId: 'mo1',
          momentContent: 'A moment',
          momentStatus: 'draft',
        },
      ],
      total: 1,
    }
  if (path === '/admin/taxonomy')
    return {
      folders: [{ id: 1, label: 'Notes', total: 2, published: 1 }],
      tags: [],
      categories: [{ category: 'tech', total: 4 }],
    }
  throw new Error(`unexpected ${path}`)
}

beforeEach(() => {
  mocks.api.mockReset()
  mocks.api.mockImplementation(async (path: string) => respond(path))
  mocks.auth = { currentUser: ref({ id: 'owner' }), isLoggedIn: ref(true), restore: vi.fn().mockResolvedValue(true) }
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('后台评论审核与分类标签英文冒烟', () => {
  it('文章评论管理页', async () => {
    await inEnglish(async () => {
      const wrapper = await mountPage(CommentsPage, '/admin/comments')
      const text = wrapper.text()
      expect(text).toContain('Moderation settings')
      expect(text).toContain('Server setting: Review before publishing · revision 3')
      expect(text).toContain('Pending review')
      expect(text).toContain('View context')
      expect(text).toContain('1 / 1 · 1 total')
      expect(text).not.toMatch(/[一-鿿]/)
    })
  })

  it('闪念评论与朋友圈评论页', async () => {
    await inEnglish(async () => {
      const flashPage = await mountPage(FlashCommentsPage, '/admin/flash-comments')
      const flash = flashPage.text()
      expect(flash).toContain('Flash comments')
      expect(flash).toContain('Flash published')
      expect(flash).toContain('Approve')
      expect(flash).not.toMatch(/[一-鿿]/)
      const moment = (await mountPage(MomentCommentsPage, '/admin/moment-comments')).text()
      expect(moment).toContain('Moment comments')
      expect(moment).toContain('Moment draft')
      expect(moment).toContain('Delete comment')
      expect(moment).not.toMatch(/[一-鿿]/)
    })
  })

  it('分类与标签页', async () => {
    await inEnglish(async () => {
      const text = (await mountPage(TaxonomyPage, '/admin/taxonomy')).text()
      expect(text).toContain('Categories & tags')
      expect(text).toContain('Tech · 4 posts')
      expect(text).toContain('Series (1)')
      expect(text).toContain('No tags yet')
      expect(text).not.toMatch(/[一-鿿]/)
    })
  })

  it('默认中文界面保持原文', async () => {
    const text = (await mountPage(TaxonomyPage, '/admin/taxonomy')).text()
    expect(text).toContain('技术 · 4 篇')
    expect(text).toContain('专栏（1）')
    expect(text).toContain('暂无标签')
    const comments = (await mountPage(CommentsPage, '/admin/comments')).text()
    expect(comments).toContain('服务器当前：先审核后公开 · 版本 3')
  })
})
