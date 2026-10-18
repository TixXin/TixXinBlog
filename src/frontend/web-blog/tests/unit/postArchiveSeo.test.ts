/** @file postArchiveSeo.test.ts @description 年月归档分享地址、SSR 内容隔离与客户端元信息联动 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, createSSRApp, defineComponent, h, onScopeDispose, reactive, shallowReactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { renderToString } from '@vue/server-renderer'
import { createHead, renderSSRHead } from '@unhead/vue/server'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createNuxtApp } from '#app/nuxt'
import type { NuxtApp } from '#app'
import { usePageSeo } from '~/composables/usePageSeo'
import { usePostArchive } from '~/composables/usePostArchive'
import { fetchPostArchive } from '~/features/post/api'
import { postArchiveQuery, postArchiveSeo } from '~/features/post/archive'
import type { PostArchiveItem } from '~/features/post/types'
import { defaultSiteSettings } from '~/features/site/settings'
import { invalidatePublicReads } from '~/utils/invalidatePublicReads'

vi.mock('~/features/post/api', () => ({ fetchPostArchive: vi.fn() }))

const posts: PostArchiveItem[] = [
  { id: 4, title: '四月小记', folder: '随笔', date: '2026-04-01T00:00:00.000Z' },
  { id: 3, title: '三月月末', folder: '随笔', date: '2026-03-31T23:59:59.999Z' },
  { id: 2, title: '三月月初', folder: '随笔', date: '2026-03-01T00:00:00.000Z' },
  { id: 1, title: '去年记录', folder: '随笔', date: '2025-03-01T00:00:00.000Z' },
]
const requests: NuxtApp[] = []
const wrappers: { unmount(): void }[] = []
let originalApp: NuxtApp
let requestSequence = 0

beforeEach(() => {
  originalApp = useNuxtApp()
  vi.mocked(fetchPostArchive)
    .mockReset()
    .mockImplementation(async (_base, query) => {
      const items = posts.filter(
        (post) =>
          (!query.year || Number(post.date.slice(0, 4)) === query.year) &&
          (!query.month || Number(post.date.slice(5, 7)) === query.month),
      )
      return {
        items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        // 总量跨过一页，页码才会留在地址里，而不是被末页归一清掉。
        total: Math.max(items.length, query.pageSize + 1),
        page: query.page,
        pageSize: query.pageSize,
        years: [
          { year: 2026, count: 3 },
          { year: 2025, count: 1 },
        ],
      }
    })
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  requests.splice(0).forEach((app) => app._scope.stop())
  originalApp.runWithContext(() => {})
})

function installSeo() {
  const route = useRoute()
  const seo = computed(() => postArchiveSeo(postArchiveQuery(route.query)))
  usePageSeo({
    title: () => seo.value.title,
    description: () => seo.value.description,
    canonical: () => seo.value.canonical,
    type: 'website',
  })
}

async function renderArchive(path: string) {
  const head = createHead()
  const component = defineComponent({
    async setup() {
      installSeo()
      const archive = await usePostArchive()
      return () =>
        h(
          'main',
          archive.archiveYears.value.flatMap((year) => year.posts.map((post) => h('p', post.title))),
        )
    },
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/archive', component }],
  })
  await router.push(path)
  const vueApp = createSSRApp(component)
  const config = {
    ...originalApp.$config,
    public: { ...originalApp.$config.public, siteUrl: 'https://journal.example', postUseMockRepo: false },
  }
  // 客户端测试运行时会用 window.__NUXT__.config 覆盖新建应用的站点地址，先换上本次请求的配置。
  const nuxtState = (window as Window & { __NUXT__?: { config?: unknown } }).__NUXT__
  const previousConfig = nuxtState?.config
  if (nuxtState) nuxtState.config = config
  const app = createNuxtApp({
    id: `archive-ssr-request-${++requestSequence}`,
    vueApp,
    ssrContext: {
      url: path,
      head,
      runtimeConfig: config,
      payload: { config },
    } as NonNullable<NuxtApp['ssrContext']>,
  })
  if (nuxtState) nuxtState.config = previousConfig
  // 独立真实 Nuxt 数据容器模拟每次 HTTP 请求，只替换公开 API，避免复用客户端 payload。
  app.isHydrating = false
  app.payload.serverRendered = true
  app.payload.data = shallowReactive({})
  app.payload.state = reactive({})
  app.payload._errors = shallowReactive({})
  app._route = router.currentRoute.value
  app.provide('router', router)
  vueApp.use(head)
  requests.push(app)
  const html = await app.runWithContext(() => renderToString(vueApp))
  const { headTags } = await renderSSRHead(head)
  return { html, head: new DOMParser().parseFromString(headTags, 'text/html') }
}

it.each([
  { input: {}, title: '归档', canonical: '/archive' },
  { input: { year: '2026' }, title: '2026 年文章归档', canonical: '/archive?year=2026' },
  {
    input: { month: '03', year: '2026', page: '2', utm_source: 'share' },
    title: '2026 年 3 月文章归档 · 第 2 页',
    canonical: '/archive?year=2026&month=3&page=2',
  },
  { input: { year: '2026', month: '13', page: '1' }, title: '2026 年文章归档', canonical: '/archive?year=2026' },
  { input: { month: '3' }, title: '归档', canonical: '/archive' },
  { input: { year: ['2025', '2026'], month: '3' }, title: '归档', canonical: '/archive' },
])('归档元信息使用规范查询：$canonical', ({ input, title, canonical }) => {
  expect(postArchiveSeo(postArchiveQuery(input))).toMatchObject({ title, canonical })
})

it.each([
  {
    path: '/archive?year=2026&utm_source=share',
    query: { year: 2026, page: 1, pageSize: 50 },
    title: '2026 年文章归档',
    canonical: 'https://journal.example/archive?year=2026',
    included: ['四月小记', '三月月末', '三月月初'],
    excluded: ['去年记录'],
  },
  {
    path: '/archive?month=03&year=2026&page=1&utm_source=share',
    query: { year: 2026, month: 3, page: 1, pageSize: 50 },
    title: '2026 年 3 月文章归档',
    canonical: 'https://journal.example/archive?year=2026&month=3',
    included: ['三月月末', '三月月初'],
    excluded: ['四月小记', '去年记录'],
  },
])('SSR 首次请求 $path 只输出当前时间段并带独立元信息', async (example) => {
  const result = await renderArchive(example.path)
  expect(fetchPostArchive).toHaveBeenCalledTimes(1)
  expect(vi.mocked(fetchPostArchive).mock.calls[0]?.[1]).toEqual(example.query)
  for (const title of example.included) expect(result.html).toContain(title)
  for (const title of example.excluded) expect(result.html).not.toContain(title)
  expect(result.head.title).toBe(example.title)
  expect(result.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
  expect(result.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(example.canonical)
  expect(result.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(example.canonical)
})

it('客户端换月、换年与返回旧地址时同步更新标题和唯一 canonical', async () => {
  let archive!: Awaited<ReturnType<typeof usePostArchive>>
  let router!: ReturnType<typeof useRouter>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        async setup() {
          const app = useNuxtApp()
          const config = useRuntimeConfig()
          const previousSite = config.public.siteUrl
          config.public.siteUrl = 'https://journal.example/'
          onScopeDispose(() => {
            config.public.siteUrl = previousSite
          })
          invalidatePublicReads(app, ['archive'])
          clearNuxtData('post-archive')
          router = useRouter()
          installSeo()
          archive = await usePostArchive()
          return () => h('div')
        },
      }),
      { route: '/archive?year=2026&month=3&utm_source=share' },
    ),
  )
  async function expectHead(title: string, path: string) {
    // app.vue 的 titleTemplate 会在页面标题后追加站点名。
    await vi.waitFor(() => expect(document.title).toBe(`${title} - ${defaultSiteSettings.name}`))
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`https://journal.example${path}`)
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      `https://journal.example${path}`,
    )
  }
  await expectHead('2026 年 3 月文章归档', '/archive?year=2026&month=3')
  await archive.changeQuery({ month: 4 })
  await expectHead('2026 年 4 月文章归档', '/archive?year=2026&month=4')
  await archive.changeQuery({ year: 2025 })
  await expectHead('2025 年文章归档', '/archive?year=2025')
  await router.replace('/archive?year=2026&page=2')
  await expectHead('2026 年文章归档 · 第 2 页', '/archive?year=2026&page=2')
  await router.replace('/archive')
  await expectHead('归档', '/archive')
})
