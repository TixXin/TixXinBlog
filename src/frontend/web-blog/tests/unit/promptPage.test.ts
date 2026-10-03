/** @file promptPage.test.ts @description 真实提示词页面的公开/草稿衔接、独立筛选清除及编辑入口消失后的焦点恢复。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import type { PropType, Ref } from 'vue'
import type { Router } from 'vue-router'
import { useRoute, useRouter } from '#app'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import PromptsPage from '../../app/pages/prompts.vue'
import SearchBox from '../../app/components/common/SearchBox.vue'
import { promptQuery } from '../../app/features/prompt/query'
import type { ImagePrompt, ManagedPrompt, PromptPage, PromptStatus } from '../../app/features/prompt/types'

const mocks = vi.hoisted(() => ({
  feed: vi.fn(),
  draftFeed: vi.fn(),
  detail: vi.fn(),
  adminDetail: vi.fn(),
  refresh: vi.fn(),
  refreshMetadata: vi.fn(),
  refreshDrafts: vi.fn(),
  changeQuery: vi.fn(),
  auth: {} as {
    currentUser: Ref<{ id: string } | null>
    isLoggedIn: Ref<boolean>
    restore: ReturnType<typeof vi.fn>
  },
}))
mockNuxtImport('usePrompts', () => async () => mocks.feed())
mockNuxtImport(
  'usePromptDrafts',
  () =>
    (...args: unknown[]) =>
      mocks.draftFeed(...args),
)
mockNuxtImport('usePromptRepository', () => () => ({ detail: mocks.detail, adminDetail: mocks.adminDetail }))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)

function item(status: PromptStatus = 'published', patch: Partial<ManagedPrompt> = {}): ManagedPrompt {
  return {
    id: 7,
    title: '窗边的光',
    description: '让光影成为画面的一部分',
    prompt: 'A quiet room with soft window light',
    negativePrompt: '',
    model: 'Flux',
    tags: ['光影'],
    imageUrl: '/window-light.webp',
    imageAlt: '光落在白色陶瓶上',
    width: 1200,
    height: 800,
    sourceUrl: '',
    publishedAt: status === 'published' ? '2026-10-03T12:00:00.000Z' : null,
    mediaId: 'window-light',
    externalImageUrl: null,
    status,
    revision: 1,
    createdAt: '2026-10-03T12:00:00.000Z',
    updatedAt: '2026-10-03T12:00:00.000Z',
    ...patch,
  }
}

const Frame = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('main', [slots.header?.(), slots.default?.(), slots.overlays?.()]),
})
const Header = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('header', [slots.default?.(), slots.action?.()]),
})
const Container = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('div', slots.default?.()),
})
const Card = defineComponent({
  props: { item: { type: Object as PropType<ImagePrompt>, required: true } },
  emits: ['open', 'edit'],
  setup:
    (props, { emit }) =>
    () =>
      h('article', { 'data-card': props.item.id }, [
        h('button', { type: 'button', onClick: () => emit('open', props.item.id) }, props.item.title),
        h(
          'button',
          { type: 'button', 'data-edit-card': props.item.id, onClick: () => emit('edit', props.item.id) },
          '编辑',
        ),
      ]),
})
const Detail = defineComponent({
  props: {
    visible: Boolean,
    item: Object as PropType<ImagePrompt | null>,
    pending: Boolean,
    error: String,
    draft: Boolean,
  },
  emits: ['edit', 'close'],
  setup:
    (props, { emit }) =>
    () =>
      props.visible
        ? h('section', { 'data-detail': '', 'data-draft': String(props.draft) }, [
            h('p', { 'data-detail-body': '' }, props.item?.prompt),
            h('p', { role: 'alert' }, props.error),
            h(
              'button',
              { type: 'button', 'data-edit-detail': '', onClick: () => emit('edit', props.item?.id) },
              '编辑详情',
            ),
          ])
        : null,
})
const Editor = defineComponent({
  props: { id: Number },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const firstButton = ref<HTMLButtonElement | null>(null)
    onMounted(() => firstButton.value?.focus())
    return () =>
      h('section', { class: 'prompt-editor' }, [
        h(
          'button',
          {
            ref: firstButton,
            type: 'button',
            'data-save-draft': '',
            onClick: () => emit('saved', item('draft', { id: props.id ?? 7, revision: 2 })),
          },
          '保存草稿',
        ),
        h(
          'button',
          {
            type: 'button',
            'data-save-published': '',
            onClick: () => emit('saved', item('published', { id: props.id ?? 7, revision: 2 })),
          },
          '发布',
        ),
        h('button', { type: 'button', 'data-close-editor': '', onClick: () => emit('close') }, '关闭编辑器'),
      ])
  },
})
let router: Router
let publicItems: Ref<ImagePrompt[]>
let drafts: Ref<PromptPage<ManagedPrompt>>
let feedTotal: Ref<number | null>
let feedPending: Ref<boolean>
let feedStale: Ref<boolean>
let feedError: Ref<Error | null>
const wrappers: { unmount(): void }[] = []

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth = {
    currentUser: ref({ id: 'owner' }),
    isLoggedIn: ref(true),
    restore: vi.fn().mockResolvedValue(true),
  }
  publicItems = ref([item()])
  feedTotal = ref(null)
  feedPending = ref(false)
  feedStale = ref(false)
  feedError = ref(null)
  drafts = ref({ items: [item('draft')], total: 1, page: 1, pageSize: 12 })
  mocks.detail.mockResolvedValue(item())
  mocks.adminDetail.mockResolvedValue(item('draft'))
  mocks.refresh.mockResolvedValue(undefined)
  mocks.refreshMetadata.mockResolvedValue(undefined)
  mocks.refreshDrafts.mockResolvedValue(undefined)
  mocks.feed.mockImplementation(() => {
    const route = useRoute()
    router = useRouter()
    // 按列表依赖的契约应用单项补丁；测试同时核对页面没有传入其它筛选清空指令。
    mocks.changeQuery.mockImplementation((patch: Record<string, string | number | undefined>) =>
      router.push({ path: '/prompts', query: { ...route.query, page: undefined, prompt: undefined, ...patch } }),
    )
    return {
      query: computed(() => promptQuery(route.query)),
      ready: ref(true),
      prompts: publicItems,
      total: computed(() => feedTotal.value ?? publicItems.value.length),
      stale: feedStale,
      pending: feedPending,
      error: feedError,
      refresh: mocks.refresh,
      metadata: ref({
        stats: { prompts: 1, models: 1, tags: 1 },
        models: [{ label: 'Flux', count: 1 }],
        tags: [{ label: '光影', count: 1 }],
      }),
      metadataError: ref(null),
      refreshMetadata: mocks.refreshMetadata,
      changeQuery: mocks.changeQuery,
    }
  })
  mocks.draftFeed.mockReturnValue({
    drafts,
    pending: ref(false),
    error: ref(''),
    stale: ref(false),
    refresh: mocks.refreshDrafts,
  })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

async function setup(route = '/prompts', realSearch = false) {
  const wrapper = await mountSuspended(PromptsPage, {
    route,
    attachTo: document.body,
    global: {
      stubs: {
        CommonPageFrame: Frame,
        CommonPageHeader: Header,
        CommonCustomScrollbar: Container,
        ClientOnly: Container,
        Icon: true,
        CommonSearchBox: realSearch ? SearchBox : true,
        CommonStateBlock: true,
        CommonRequestFeedback: true,
        PromptCard: Card,
        PromptDetail: Detail,
        PromptEditor: Editor,
      },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

it('公开详情保存为草稿后转到草稿视图，关闭编辑器继续通过管理接口核对正文', async () => {
  const wrapper = await setup('/prompts?prompt=7&q=窗&page=2')
  expect(mocks.detail).toHaveBeenCalledWith(7, expect.any(AbortSignal))
  const publicReads = mocks.detail.mock.calls.length
  await wrapper.get('[data-edit-detail]').trigger('click')
  mocks.detail.mockRejectedValue(new Error('提示词不存在或尚未公开'))
  mocks.adminDetail.mockResolvedValue(item('draft', { prompt: '保存后的私人提示词', revision: 2 }))
  mocks.refresh.mockImplementation(async () => {
    publicItems.value = []
  })
  await wrapper.get('[data-save-draft]').trigger('click')
  await flushPromises()
  await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ prompt: '7', q: '窗', view: 'drafts' }))
  await flushPromises()
  expect(mocks.adminDetail).toHaveBeenCalledWith(7)
  expect(mocks.detail).toHaveBeenCalledTimes(publicReads)
  await wrapper.get('[data-close-editor]').trigger('click')
  await flushPromises()
  expect(wrapper.get('[data-detail]').attributes('data-draft')).toBe('true')
  expect(wrapper.get('[data-detail-body]').text()).toBe('保存后的私人提示词')
  expect(wrapper.get('[data-detail] [role="alert"]').text()).toBe('')
})

it('草稿详情发布后切回公开列表，并通过公开详情接口读取已发布内容', async () => {
  const wrapper = await setup('/prompts?view=drafts&prompt=7&tag=光影&page=3')
  expect(mocks.adminDetail).toHaveBeenCalledWith(7)
  const adminReads = mocks.adminDetail.mock.calls.length
  await wrapper.get('[data-edit-detail]').trigger('click')
  const published = item('published', { prompt: '发布后的完整提示词', revision: 2 })
  mocks.detail.mockResolvedValue(published)
  mocks.adminDetail.mockRejectedValue(new Error('旧草稿读取不应继续'))
  mocks.refresh.mockImplementation(async () => {
    publicItems.value = [published]
    drafts.value = { items: [], total: 0, page: 1, pageSize: 12 }
  })
  await wrapper.get('[data-save-published]').trigger('click')
  await flushPromises()
  await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ prompt: '7', tag: '光影' }))
  await flushPromises()
  expect(mocks.detail).toHaveBeenCalledWith(7, expect.any(AbortSignal))
  expect(mocks.adminDetail).toHaveBeenCalledTimes(adminReads)
  expect(mocks.refresh).toHaveBeenCalledOnce()
  expect(mocks.refreshMetadata).toHaveBeenCalledOnce()
  expect(mocks.refreshDrafts).not.toHaveBeenCalled()
  await wrapper.get('[data-close-editor]').trigger('click')
  await flushPromises()
  expect(wrapper.get('[data-detail]').attributes('data-draft')).toBe('false')
  expect(wrapper.get('[data-detail-body]').text()).toBe('发布后的完整提示词')
  expect(wrapper.get('[data-detail] [role="alert"]').text()).toBe('')
  expect(wrapper.get('.prompts-views button').attributes('aria-pressed')).toBe('true')
})

it.each([
  ['q', '移除关键词筛选：窗'],
  ['model', '移除模型筛选：Flux'],
  ['tag', '移除风格筛选：光影'],
])('移除 %s 筛选 chip 时保留其它筛选与浏览范围', async (key, label) => {
  const wrapper = await setup('/prompts?q=窗&model=Flux&tag=光影&view=drafts&page=3&panel=notes')
  await wrapper.get(`[aria-label="${label}"]`).trigger('click')
  await flushPromises()
  expect(mocks.changeQuery).toHaveBeenCalledExactlyOnceWith({ [key]: undefined })
  const expected = Object.fromEntries(
    Object.entries({ q: '窗', model: 'Flux', tag: '光影', view: 'drafts', panel: 'notes' }).filter(
      ([field]) => field !== key,
    ),
  )
  await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual(expected))
  await flushPromises()
  expect(wrapper.find(`[aria-label="${label}"]`).exists()).toBe(false)
})

it('保存切换列表移除原编辑入口后，关闭编辑器将焦点交还稳定浏览按钮', async () => {
  const wrapper = await setup()
  const trigger = wrapper.get<HTMLButtonElement>('[data-edit-card="7"]')
  trigger.element.focus()
  await trigger.trigger('click')
  expect(document.activeElement?.closest('.prompt-editor')).not.toBeNull()
  drafts.value = { items: [], total: 0, page: 1, pageSize: 12 }
  mocks.refresh.mockImplementation(async () => {
    publicItems.value = []
  })
  await wrapper.get('[data-save-draft]').trigger('click')
  await flushPromises()
  await vi.waitFor(() => expect(trigger.element.isConnected).toBe(false))
  await wrapper.get('[data-close-editor]').trigger('click')
  await flushPromises()
  const fallback = wrapper.get<HTMLButtonElement>('.prompts-views button')
  expect(document.activeElement).toBe(fallback.element)
  expect(document.activeElement).not.toBe(document.body)
  expect(fallback.element.isConnected).toBe(true)
})

it.each(['public', 'drafts'])('%s 当前结果的越界链接返回末页并保留筛选和详情', async (view) => {
  feedTotal.value = 17
  publicItems.value = []
  drafts.value = { items: [], total: 17, page: 999, pageSize: 12 }
  await setup(`/prompts?page=999&model=Flux&tag=光影&prompt=7${view === 'drafts' ? '&view=drafts' : ''}`)
  await vi.waitFor(() => expect(router.currentRoute.value.query.page).toBe('2'))
  expect(router.currentRoute.value.query).toMatchObject({ model: 'Flux', tag: '光影', prompt: '7' })
  expect(router.currentRoute.value.query.view).toBe(view === 'drafts' ? 'drafts' : undefined)
})

it('最后一页内容减少为零时回到第一页，不保留无效页码', async () => {
  publicItems.value = []
  feedTotal.value = 0
  await setup('/prompts?page=2&q=晨雾')
  await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ q: '晨雾' }))
})

it.each(['pending', 'stale', 'error'])('%s 状态下不使用旧统计修正页码，当前请求成功后才恢复', async (state) => {
  feedTotal.value = 1
  if (state === 'pending') feedPending.value = true
  if (state === 'stale') feedStale.value = true
  if (state === 'error') feedError.value = new Error('读取失败')
  await setup('/prompts?page=3&model=Flux')
  expect(router.currentRoute.value.query.page).toBe('3')
  feedTotal.value = 13
  feedPending.value = false
  feedStale.value = false
  feedError.value = null
  await vi.waitFor(() => expect(router.currentRoute.value.query.page).toBe('2'))
  expect(router.currentRoute.value.query.model).toBe('Flux')
})

it('旧列表完成后自动纠正页码，搜索框仍保留并提交用户刚输入的新关键词', async () => {
  feedTotal.value = 17
  feedPending.value = true
  publicItems.value = []
  const wrapper = await setup('/prompts?q=旧关键词&page=999&model=Flux', true)
  const input = wrapper.get<HTMLInputElement>('input[aria-label="搜索图片提示词"]')
  await input.setValue('窗边的新光')
  feedPending.value = false
  await flushPromises()
  await vi.waitFor(() => expect(router.currentRoute.value.query.page).toBe('2'))
  expect(input.element.value).toBe('窗边的新光')
  await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ q: '窗边的新光', model: 'Flux' }))
})
