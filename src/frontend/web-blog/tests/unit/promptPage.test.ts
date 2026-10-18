/** @file promptPage.test.ts @description 真实提示词页面的公开/草稿衔接、独立筛选清除及编辑入口消失后的焦点恢复。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onMounted, onUnmounted, ref } from 'vue'
import type { PropType, Ref } from 'vue'
import type { Router } from 'vue-router'
import { useRoute, useRouter } from '#app'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import PromptsPage from '../../app/pages/prompts.vue'
import SearchBox from '../../app/components/common/SearchBox.vue'
import RequestFeedback from '../../app/components/common/RequestFeedback.vue'
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
  openLogin: vi.fn(),
  editorMounted: vi.fn(),
  editorUnmounted: vi.fn(),
  auth: {} as {
    currentUser: Ref<{ id: string } | null>
    isLoggedIn: Ref<boolean>
    authError: Ref<string>
    restoringPending: Ref<boolean>
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
mockNuxtImport('useLoginDrawer', () => () => ({ open: mocks.openLogin }))

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
    const sessionInput = ref('')
    onMounted(() => {
      mocks.editorMounted()
      firstButton.value?.focus()
    })
    onUnmounted(() => mocks.editorUnmounted())
    return () =>
      h('section', { class: 'prompt-editor' }, [
        h('input', {
          'data-editor-session-input': '',
          value: sessionInput.value,
          onInput: (event: Event) => {
            sessionInput.value = (event.target as HTMLInputElement).value
          },
        }),
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
let metadataError: Ref<Error | null>
let metadataPending: Ref<boolean>
const wrappers: { unmount(): void }[] = []

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth = {
    currentUser: ref({ id: 'owner' }),
    isLoggedIn: ref(true),
    authError: ref(''),
    restoringPending: ref(false),
    restore: vi.fn().mockResolvedValue(true),
  }
  publicItems = ref([item()])
  feedTotal = ref(null)
  feedPending = ref(false)
  feedStale = ref(false)
  feedError = ref(null)
  metadataError = ref(null)
  metadataPending = ref(false)
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
      metadataError,
      metadataPending,
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
        CommonRequestFeedback: RequestFeedback,
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

it('筛选元数据独立失败时保留列表，使用统一反馈重试且在途不重复请求', async () => {
  metadataError.value = new Error('元数据接口不可用')
  let finish!: () => void
  mocks.refreshMetadata.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        metadataPending.value = true
        metadataError.value = null
        finish = () => {
          metadataPending.value = false
          resolve()
        }
      }),
  )
  const wrapper = await setup('/prompts?model=Flux')
  const feedback = wrapper.getComponent(RequestFeedback)
  expect(feedback.get('[role="alert"]').text()).toContain('模型与标签加载失败')
  expect(wrapper.get('[data-card="7"]').text()).toContain('窗边的光')
  await feedback.get('button').trigger('click')
  expect(mocks.refreshMetadata).toHaveBeenCalledOnce()
  expect(feedback.get('button').attributes('aria-disabled')).toBe('true')
  await feedback.get('button').trigger('click')
  expect(mocks.refreshMetadata).toHaveBeenCalledOnce()
  expect(mocks.refresh).not.toHaveBeenCalled()
  expect(router.currentRoute.value.query).toEqual({ model: 'Flux' })
  finish()
  await flushPromises()
  expect(wrapper.findComponent(RequestFeedback).exists()).toBe(false)
  expect(wrapper.get('[data-card="7"]').text()).toContain('窗边的光')
})

it('公开详情保存为草稿后转到草稿视图，关闭编辑器继续通过管理接口核对正文', async () => {
  const wrapper = await setup('/prompts?prompt=7&q=窗&page=2')
  expect(mocks.detail).toHaveBeenCalledWith(7, expect.any(AbortSignal))
  const publicReads = mocks.detail.mock.calls.length
  await wrapper.get('[data-edit-detail]').trigger('click')
  await vi.waitFor(() => expect(wrapper.findComponent(Editor).exists()).toBe(true))
  expect(router.currentRoute.value.query.edit).toBe('7')
  mocks.detail.mockRejectedValue(new Error('提示词不存在或尚未公开'))
  mocks.adminDetail.mockResolvedValue(item('draft', { prompt: '保存后的私人提示词', revision: 2 }))
  mocks.refresh.mockImplementation(async () => {
    publicItems.value = []
  })
  await wrapper.get('[data-save-draft]').trigger('click')
  await flushPromises()
  await vi.waitFor(() =>
    expect(router.currentRoute.value.query).toEqual({ prompt: '7', q: '窗', view: 'drafts', edit: '7' }),
  )
  await flushPromises()
  expect(mocks.adminDetail).toHaveBeenCalledWith(7)
  expect(mocks.detail).toHaveBeenCalledTimes(publicReads)
  await wrapper.get('[data-close-editor]').trigger('click')
  await vi.waitFor(() => expect(wrapper.findComponent(Editor).exists()).toBe(false))
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
  await vi.waitFor(() => expect(wrapper.findComponent(Editor).exists()).toBe(true))
  expect(router.currentRoute.value.query.edit).toBe('7')
  const published = item('published', { prompt: '发布后的完整提示词', revision: 2 })
  mocks.detail.mockResolvedValue(published)
  mocks.adminDetail.mockRejectedValue(new Error('旧草稿读取不应继续'))
  mocks.refresh.mockImplementation(async () => {
    publicItems.value = [published]
    drafts.value = { items: [], total: 0, page: 1, pageSize: 12 }
  })
  await wrapper.get('[data-save-published]').trigger('click')
  await flushPromises()
  await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ prompt: '7', tag: '光影', edit: '7' }))
  await flushPromises()
  expect(mocks.adminDetail).toHaveBeenCalledTimes(adminReads)
  expect(mocks.refresh).toHaveBeenCalledOnce()
  expect(mocks.refreshMetadata).toHaveBeenCalledOnce()
  expect(mocks.refreshDrafts).not.toHaveBeenCalled()
  await wrapper.get('[data-close-editor]').trigger('click')
  await vi.waitFor(() => expect(wrapper.findComponent(Editor).exists()).toBe(false))
  await flushPromises()
  await vi.waitFor(() => expect(mocks.detail).toHaveBeenCalledWith(7, expect.any(AbortSignal)))
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
  await vi.waitFor(() => expect(wrapper.findComponent(Editor).exists()).toBe(true))
  expect(document.activeElement?.closest('.prompt-editor')).not.toBeNull()
  drafts.value = { items: [], total: 0, page: 1, pageSize: 12 }
  mocks.refresh.mockImplementation(async () => {
    publicItems.value = []
  })
  await wrapper.get('[data-save-draft]').trigger('click')
  await flushPromises()
  await vi.waitFor(() => expect(trigger.element.isConnected).toBe(false))
  await wrapper.get('[data-close-editor]').trigger('click')
  await vi.waitFor(() => expect(wrapper.findComponent(Editor).exists()).toBe(false))
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

it('新建草稿获得编号后保持同一编辑器会话与局部输入，后续保存不重新挂载', async () => {
  const wrapper = await setup('/prompts?model=Flux')
  await wrapper.get('.prompts-add').trigger('click')
  await vi.waitFor(() => expect(router.currentRoute.value.query.edit).toBe('new'))
  await vi.waitFor(() => expect(wrapper.findComponent(Editor).exists()).toBe(true))
  const editor = wrapper.getComponent(Editor)
  const session = editor.vm
  const root = editor.element
  expect(editor.props('id')).toBeNull()
  await editor.get('[data-editor-session-input]').setValue('同一会话中继续补充的创作笔记')
  await editor.get('[data-save-draft]').trigger('click')
  await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({ model: 'Flux', edit: '7', view: 'drafts' }))
  await flushPromises()
  const savedEditor = wrapper.getComponent(Editor)
  expect(savedEditor.vm).toBe(session)
  expect(savedEditor.element).toBe(root)
  expect(savedEditor.props('id')).toBe(7)
  expect(savedEditor.get<HTMLInputElement>('[data-editor-session-input]').element.value).toBe(
    '同一会话中继续补充的创作笔记',
  )
  expect(mocks.editorMounted).toHaveBeenCalledOnce()
  expect(mocks.editorUnmounted).not.toHaveBeenCalled()
  await savedEditor.get('[data-save-draft]').trigger('click')
  await flushPromises()
  expect(wrapper.getComponent(Editor).vm).toBe(session)
  expect(mocks.editorMounted).toHaveBeenCalledOnce()
})

it('路由移除 edit 参数后关闭编辑器，保留浏览筛选并归还稳定焦点', async () => {
  const wrapper = await setup('/prompts?edit=7&tag=光影')
  await vi.waitFor(() => expect(wrapper.findComponent(Editor).exists()).toBe(true))
  await router.replace({ path: '/prompts', query: { ...router.currentRoute.value.query, edit: undefined } })
  await vi.waitFor(() => expect(wrapper.findComponent(Editor).exists()).toBe(false))
  expect(router.currentRoute.value.query).toEqual({ tag: '光影' })
  expect(mocks.editorUnmounted).toHaveBeenCalledOnce()
  await vi.waitFor(() => expect(document.activeElement).toBe(wrapper.get('.prompts-views button').element))
  expect(document.activeElement).not.toBe(document.body)
})

it.each(['new', '7'])('未登录的 edit=%s 显示登录意图，不挂载编辑器或请求管理详情', async (token) => {
  mocks.auth.currentUser.value = null
  mocks.auth.isLoggedIn.value = false
  mocks.auth.restore.mockResolvedValue(false)
  const wrapper = await setup(`/prompts?edit=${token}&prompt=7&model=Flux`)
  const banner = wrapper.get('.prompts-auth[role="status"]')
  expect(banner.text()).toContain('博主登录后可继续编辑')
  expect(banner.text()).toContain('浏览和复制公开提示词无需登录')
  expect(wrapper.findComponent(Editor).exists()).toBe(false)
  expect(mocks.editorMounted).not.toHaveBeenCalled()
  expect(mocks.adminDetail).not.toHaveBeenCalled()
  expect(mocks.detail).not.toHaveBeenCalled()
  expect(mocks.draftFeed.mock.calls[0]![1].value).toBe(false)
  await banner.get('button').trigger('click')
  expect(mocks.openLogin).toHaveBeenCalledExactlyOnceWith('login', true)
  expect(router.currentRoute.value.query).toEqual({ edit: token, prompt: '7', model: 'Flux' })
  // 登录态确认后再兑现原编辑意图，不能提前读管理数据或丢失目标编号。
  mocks.auth.currentUser.value = { id: 'owner' }
  mocks.auth.isLoggedIn.value = true
  await vi.waitFor(() => expect(wrapper.findComponent(Editor).exists()).toBe(true))
  expect(wrapper.getComponent(Editor).props('id')).toBe(token === 'new' ? null : 7)
  expect(wrapper.find('.prompts-auth').exists()).toBe(false)
})

it('未认证的草稿与编辑深链显示登录提示，不显示空白详情或发起详情请求', async () => {
  mocks.auth.currentUser.value = null
  mocks.auth.isLoggedIn.value = false
  mocks.auth.restore.mockResolvedValue(false)
  const wrapper = await setup('/prompts?view=drafts&prompt=7')
  for (const path of ['/prompts?view=drafts&prompt=7', '/prompts?prompt=7&edit=7']) {
    await router.replace(path)
    await flushPromises()
    expect(wrapper.get('.prompts-auth[role="status"]').text()).toContain('博主登录后可继续编辑')
    expect(wrapper.getComponent(Detail).props('visible')).toBe(false)
    expect(wrapper.find('[data-detail]').exists()).toBe(false)
    expect(wrapper.findComponent(Editor).exists()).toBe(false)
    expect(mocks.adminDetail).not.toHaveBeenCalled()
    expect(mocks.detail).not.toHaveBeenCalled()
    expect(mocks.draftFeed.mock.calls[0]![1].value).toBe(false)
  }
})

it('同一编辑令牌失去登录态时保留会话实例与局部标记，显式移除 edit 后才关闭', async () => {
  const wrapper = await setup('/prompts?edit=7&model=Flux')
  await vi.waitFor(() => expect(wrapper.findComponent(Editor).exists()).toBe(true))
  const editor = wrapper.getComponent(Editor)
  const session = editor.vm
  const root = editor.element
  await editor.get('[data-editor-session-input]').setValue('登录恢复前保留的本地会话标记')
  mocks.auth.isLoggedIn.value = false
  mocks.auth.currentUser.value = null
  await flushPromises()
  // 此处只验证父页面保留实例；敏感表单遮蔽与写入锁由真实 Editor 自己的测试负责。
  const retained = wrapper.getComponent(Editor)
  expect(retained.vm).toBe(session)
  expect(retained.element).toBe(root)
  expect(retained.get<HTMLInputElement>('[data-editor-session-input]').element.value).toBe(
    '登录恢复前保留的本地会话标记',
  )
  expect(mocks.editorMounted).toHaveBeenCalledOnce()
  expect(mocks.editorUnmounted).not.toHaveBeenCalled()
  expect(router.currentRoute.value.query).toEqual({ edit: '7', model: 'Flux' })
  await router.replace({ path: '/prompts', query: { ...router.currentRoute.value.query, edit: undefined } })
  await vi.waitFor(() => expect(wrapper.findComponent(Editor).exists()).toBe(false))
  expect(mocks.editorUnmounted).toHaveBeenCalledOnce()
  expect(mocks.editorMounted).toHaveBeenCalledOnce()
  expect(router.currentRoute.value.query).toEqual({ model: 'Flux' })
})
