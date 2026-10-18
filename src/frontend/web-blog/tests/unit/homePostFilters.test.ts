/** @file homePostFilters.test.ts @description 首页标签筛选使用真实 slug，同时保留名称展示、清除与专栏筛选 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import HomePage from '../../app/pages/index.vue'

const mocks = vi.hoisted(() => ({
  tag: null as unknown as Ref<string | null>,
  category: null as unknown as Ref<string | null>,
  list: vi.fn(),
}))
mockNuxtImport('usePostListRoute', () => () => ({
  page: ref(1),
  selectedTag: mocks.tag,
  selectedCategory: mocks.category,
  displayMode: ref('pagination'),
  clearFilters: () => {
    mocks.tag.value = null
    mocks.category.value = null
  },
  replacePage: vi.fn(),
}))
mockNuxtImport('usePostList', () => async (options: unknown) => {
  mocks.list(options)
  return { posts: ref([]), total: ref(1), pending: ref(false), error: ref(null), refresh: vi.fn() }
})
mockNuxtImport('usePostMetadata', () => async () => ({
  metadata: ref({ tags: [{ label: 'Vue 3', slug: 'vue-3', color: 'blue', count: 1 }] }),
  tags: ref([{ name: 'Vue 3', color: '#3b82f6', count: 1 }]),
  categories: ref([{ name: '工程实践', icon: 'lucide:folder', iconColor: '#3b82f6', iconBg: '', count: 1 }]),
  pending: ref(false),
  error: ref(null),
  refresh: vi.fn(),
}))
mockNuxtImport('useSiteSettings', () => () => ({ settings: ref({ name: '文章站点' }) }))
mockNuxtImport('useSiteUrl', () => () => 'https://example.com')
mockNuxtImport('usePageSeo', async () => {
  const actual = await vi.importActual<typeof import('../../app/composables/usePageSeo')>(
    '../../app/composables/usePageSeo',
  )
  return actual.usePageSeo
})
mockNuxtImport('useJsonLd', () => () => {})
mockNuxtImport('useDefaultShareImage', () => () => ref(undefined))

const Frame = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('main', [slots.header?.(), slots.default?.()]),
})
const Drawer = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('aside', slots.default?.()),
})
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.tag = ref<string | null>(null)
  mocks.category = ref<string | null>(null)
  mocks.list.mockClear()
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup(route = '/') {
  const wrapper = await mountSuspended(HomePage, {
    route,
    global: {
      stubs: {
        CommonPageFrame: Frame,
        CommonContextDrawer: Drawer,
        CommonSearchBox: true,
        BlogPostTabs: true,
        BlogPostCardList: true,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

it('点击名称不同于 slug 的标签时传入接口标识，重复点击清除原筛选', async () => {
  const wrapper = await setup()
  const button = wrapper.get('button[aria-label="在首页筛选标签：Vue 3"]')
  await button.trigger('click')
  expect(mocks.tag.value).toBe('vue-3')
  expect(mocks.list.mock.calls[0]?.[0].selectedTag.value).toBe('vue-3')
  expect(button.attributes('aria-pressed')).toBe('true')
  expect(wrapper.get('[role="status"]').text()).toBe('当前筛选：Vue 3')
  await button.trigger('click')
  expect(mocks.tag.value).toBeNull()
  expect(button.attributes('aria-pressed')).toBe('false')
})

it('地址中的标签 slug 在标题里显示名称，canonical 仍保留 slug', async () => {
  mocks.tag.value = 'vue-3'
  await setup('/?tag=vue-3')
  await vi.waitFor(() => expect(document.title).toContain('标签 Vue 3'))
  expect(document.title).not.toContain('vue-3')
  const site = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${site}/?tag=vue-3`)
})

it('已有 slug 筛选恢复名称高亮，专栏筛选继续使用原 folder 名称', async () => {
  mocks.tag.value = 'vue-3'
  const wrapper = await setup()
  expect(wrapper.get('button[aria-label="在首页筛选标签：Vue 3"]').attributes('aria-pressed')).toBe('true')
  await wrapper.get('button[aria-label="在首页筛选专栏：工程实践"]').trigger('click')
  expect(mocks.category.value).toBe('工程实践')
  expect(mocks.list.mock.calls[0]?.[0].selectedCategory.value).toBe('工程实践')
  expect(wrapper.get('[role="status"]').text()).toBe('当前筛选：工程实践 · Vue 3')
  await wrapper.get('button[aria-label="清除筛选：工程实践 · Vue 3"]').trigger('click')
  expect(mocks.tag.value).toBeNull()
  expect(mocks.category.value).toBeNull()
})
