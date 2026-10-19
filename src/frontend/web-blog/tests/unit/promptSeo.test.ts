/** @file promptSeo.test.ts @description 分享元信息跟随选中公开作品，私有/缺失目标不暴露内容或借用列表图片。 */
import { afterEach, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import type { Router } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { usePromptSeo } from '../../app/composables/usePromptSeo'
import { promptId } from '../../app/features/prompt/query'
import type { ImagePrompt } from '../../app/features/prompt/types'
const selected: ImagePrompt = {
  id: 7,
  title: '窗边的光',
  description: '柔和光影与陶器的质感',
  prompt: 'A quiet sunlit room',
  negativePrompt: '',
  model: 'Flux',
  tags: [],
  imageUrl: '/api/v1/media/selected.webp',
  imageAlt: '窗边陶器',
  width: 1200,
  height: 800,
  sourceUrl: '',
  publishedAt: '2026-10-03',
}
const wrappers: { unmount(): void }[] = []
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await flushPromises()
})
async function setup(path: string, initial: ImagePrompt | null = selected) {
  let seo!: ReturnType<typeof usePromptSeo>
  let router!: Router
  const selectedItem = ref<ImagePrompt | null>(initial)
  const selectedDraft = ref(false),
    editorOpen = ref(false)
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          const route = useRoute()
          const config = useRuntimeConfig()
          const previousSite = config.public.siteUrl
          config.public.siteUrl = 'https://journal.example/'
          onScopeDispose(() => {
            config.public.siteUrl = previousSite
          })
          router = useRouter()
          seo = usePromptSeo({
            selectedId: computed(() => promptId(route.query.prompt)),
            selectedItem,
            selectedDraft,
            editorOpen,
            prompts: ref([{ ...selected, id: 99, title: '列表首图', imageUrl: '/other.webp' }]),
          })
          return () => h('div')
        },
      }),
      { route: path },
    ),
  )
  await flushPromises()
  return { seo, router, selectedItem, selectedDraft, editorOpen }
}
it('分享标题、描述和绝对图片来自选中作品，canonical 剔除筛选与跟踪参数', async () => {
  const { seo } = await setup('/prompts?prompt=7&q=窗&page=2&utm_source=share')
  expect(seo.value).toMatchObject({
    title: '窗边的光 · 灵感图鉴',
    description: '柔和光影与陶器的质感',
    canonical: 'https://journal.example/prompts?prompt=7',
    image: 'https://journal.example/api/v1/media/selected.webp',
    robots: 'index, follow',
  })
  await vi.waitFor(() =>
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(seo.value.image),
  )
  expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(seo.value.canonical)
  expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(seo.value.canonical)
})
it.each(['/prompts?view=drafts&prompt=7', '/prompts?edit=7&prompt=7'])(
  '私有地址 %s 不输出草稿题目、正文或图片',
  async (path) => {
    const { seo } = await setup(path, { ...selected, title: '私人作品标题', description: '尚未公开的正文' })
    expect(seo.value.robots).toBe('noindex, nofollow')
    expect(seo.value.image).toBeUndefined()
    expect(seo.value.canonical).toBe('https://journal.example/prompts')
    expect(JSON.stringify(seo.value)).not.toMatch(/私人作品标题|尚未公开的正文|selected.webp/)
  },
)
it('页内编辑状态也隐藏作品分享数据，关闭编辑器恢复公开元信息', async () => {
  const state = await setup('/prompts?prompt=7')
  state.editorOpen.value = true
  expect(state.seo.value.robots).toBe('noindex, nofollow')
  expect(state.seo.value.image).toBeUndefined()
  state.editorOpen.value = false
  expect(state.seo.value.image).toBe('https://journal.example/api/v1/media/selected.webp')
})
it('从有效作品切到缺失目标时清除旧 OG 图片，不改用列表首图', async () => {
  const state = await setup('/prompts?prompt=7')
  await vi.waitFor(() => expect(document.querySelector('meta[property="og:image"]')).not.toBeNull())
  await state.router.replace('/prompts?prompt=404')
  state.selectedItem.value = null
  expect(state.seo.value.image).toBeUndefined()
  expect(state.seo.value.robots).toBe('noindex, follow')
  expect(state.seo.value.canonical).toBe('https://journal.example/prompts?prompt=404')
  await vi.waitFor(() => expect(document.querySelector('meta[property="og:image"]')).toBeNull())
  expect(document.querySelector('meta[name="twitter:image"]')).toBeNull()
})
it('无效深链不借用列表图，普通列表可使用绝对首图', async () => {
  const state = await setup('/prompts?prompt=bad', null)
  expect(state.seo.value.robots).toBe('noindex, follow')
  expect(state.seo.value.image).toBeUndefined()
  await state.router.replace('/prompts')
  expect(state.seo.value.image).toBe('https://journal.example/other.webp')
  expect(state.seo.value.robots).toBe('index, follow')
})
it('无描述时从公开提示词提取完整 Unicode 摘要，外部 HTTP 图片保持原地址', async () => {
  const { seo } = await setup('/prompts?prompt=7', {
    ...selected,
    description: '',
    prompt: '光影 🌤️ '.repeat(100),
    imageUrl: 'https://images.example/Scene.JPG?x=A&x=B',
  })
  expect([...seo.value.description]).toHaveLength(161)
  expect(seo.value.description.endsWith('…')).toBe(true)
  expect(seo.value.image).toBe('https://images.example/Scene.JPG?x=A&x=B')
})
it('英文冒烟：切换界面语言后分享标题与描述随之更新', async () => {
  const i18n = useNuxtApp().$i18n
  const { seo, router } = await setup('/prompts?prompt=7')
  await i18n.setLocale('en')
  try {
    expect(seo.value.title).toBe('窗边的光 · Prompt Gallery')
    await router.push('/prompts')
    await flushPromises()
    expect(seo.value.title).toBe('Prompt Gallery · Image prompts')
    expect(seo.value.description).toContain('find your own inspiration')
  } finally {
    await i18n.setLocale('zh-CN')
  }
  expect(seo.value.title).toBe('灵感图鉴 · 图片提示词')
})
