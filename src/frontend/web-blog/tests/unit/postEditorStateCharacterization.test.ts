/** @file postEditorStateCharacterization.test.ts @description 文章编辑组合函数的行为表征：读取、保存与新建跳转、版本冲突三种处理、历史载入与恢复、自动保存和离开保护，以请求与状态轨迹快照固定，拆分前后必须一致 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { usePostEditor } from '../../app/composables/usePostEditor'
import type { AdminPostDraft } from '../../app/features/post/adminTypes'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  leave: undefined as (() => boolean) | undefined,
  navigate: vi.fn(),
  success: vi.fn(),
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => ({ currentUser: ref({ id: 'post-owner' }), restore: async () => true }))
mockNuxtImport('useToast', () => () => ({ success: mocks.success }))
mockNuxtImport('navigateTo', () => mocks.navigate)
mockNuxtImport('onBeforeRouteLeave', () => (guard: () => boolean) => {
  mocks.leave = guard
})

const post = (patch: Partial<AdminPostDraft> = {}): AdminPostDraft => ({
  id: 7,
  revision: 3,
  savedAt: '2026-10-20T08:00:00Z',
  relatedContent: [{ type: 'gallery', id: 2 }],
  title: '旅行记录',
  slug: 'travel',
  summary: '山间',
  cover: '/cover.webp',
  coverAlt: '山路',
  seoTitle: '',
  seoDescription: '',
  seoNoindex: false,
  folder: '生活',
  category: 'life',
  status: 'draft',
  contentRaw: '# 出发\n\n正文',
  pinned: false,
  readTimeMinutes: 4,
  tags: ['旅行', '摄影'],
  ...patch,
})
const failure = (statusCode: number) =>
  Object.assign(new Error('请求失败'), { statusCode, data: { message: '版本已变化' } })

type Route = (path: string, options?: { method?: string; body?: unknown }) => unknown
let routes: Route
const calls: unknown[] = []
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  calls.length = 0
  routes = (path) => (path === '/admin/posts/filters' ? { folders: ['生活'], tags: ['旅行'] } : post())
  mocks.api.mockReset().mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
    calls.push(options ? [path, JSON.parse(JSON.stringify(options))] : [path])
    const value = routes(path, options)
    if (value instanceof Error) throw value
    return JSON.parse(JSON.stringify(value))
  })
  window.confirm = vi.fn(() => true)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  localStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function mountEditor(id: string | null = '7') {
  let editor!: ReturnType<typeof usePostEditor>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          editor = usePostEditor(id)
          return () => h('div')
        },
      }),
    ),
  )
  await flushPromises()
  return editor
}
const view = (editor: ReturnType<typeof usePostEditor>) => ({
  draft: JSON.parse(JSON.stringify(editor.draft.value)),
  tags: editor.tags.value,
  options: editor.options.value,
  pending: editor.pending.value,
  ready: editor.ready.value,
  error: editor.error.value,
  dirty: editor.dirty.value,
  conflict: editor.conflict.value?.revision ?? null,
  preservedLocal: editor.preservedLocal.value?.title ?? null,
  autoSavePaused: editor.autoSavePaused.value,
  automaticSaving: editor.automaticSaving.value,
})

it('读取文章与筛选项；筛选项失败与回收站文章各自提示', async () => {
  const loaded = await mountEditor()
  const trace: unknown[] = [view(loaded), [...calls]]
  routes = (path) => (path === '/admin/posts/filters' ? failure(500) : post())
  trace.push(view(await mountEditor()))
  routes = () => post({ deletedAt: '2026-10-21T00:00:00Z' })
  trace.push(view(await mountEditor()))
  expect(trace).toMatchSnapshot()
})

it('保存：提交体去掉服务器字段并拆分标签，成功后基线更新；新建文章保存后跳到编辑地址', async () => {
  const editor = await mountEditor()
  editor.serverAutoSave.value = false
  editor.tags.value = '旅行，摄影, 读书 ,'
  editor.draft.value.title = '旅行记录（修订）'
  routes = (path, options) =>
    options?.method === 'PATCH' ? { ...post(), ...(options.body as object), revision: 4 } : post()
  await editor.save('published')
  const trace: unknown[] = [calls.slice(2), view(editor), mocks.success.mock.calls]
  calls.length = 0
  routes = (path) => (path === '/admin/posts/filters' ? { folders: ['生活'], tags: ['旅行'] } : post())
  const created = await mountEditor(null)
  created.serverAutoSave.value = false
  created.draft.value.title = '新文章'
  created.draft.value.contentRaw = '正文'
  routes = (path, options) =>
    options?.method === 'POST' ? post({ id: 9, title: '新文章', contentRaw: '正文' }) : post()
  await created.save('draft')
  trace.push(calls, mocks.navigate.mock.calls, view(created))
  expect(trace).toMatchSnapshot()
})

it('版本冲突：读取最新版本；保留本地、采用服务器版本并找回、读取最新失败', async () => {
  const editor = await mountEditor()
  editor.serverAutoSave.value = false
  editor.draft.value.title = '本地修改'
  let latest = 4
  routes = (path, options) =>
    options?.method === 'PATCH' ? failure(409) : post({ revision: ++latest, title: `服务器版本 ${latest}` })
  await editor.save('draft')
  const trace: unknown[] = [view(editor)]
  editor.keepLocalVersion()
  trace.push(view(editor))
  editor.draft.value.title = '再次修改'
  await editor.save('draft')
  editor.useServerVersion()
  trace.push(view(editor))
  editor.recoverPreservedLocal()
  trace.push(view(editor))
  routes = (path, options) => (options?.method === 'PATCH' ? failure(428) : failure(500))
  await editor.save('draft')
  trace.push(view(editor))
  expect(trace).toMatchSnapshot()
})

it('历史版本：载入为编辑内容；恢复需确认，成功更新基线，409 读取最新版本', async () => {
  const editor = await mountEditor()
  editor.serverAutoSave.value = false
  editor.loadHistorical(post({ title: '历史标题', slug: undefined, tags: ['旧标签'], relatedContent: [] }))
  const trace: unknown[] = [view(editor)]
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  await editor.restoreHistorical(2)
  trace.push(calls.length)
  routes = (path) => (path.endsWith('/restore') ? post({ revision: 6, title: '恢复的标题' }) : post())
  await editor.restoreHistorical(2)
  trace.push(calls.at(-1), view(editor))
  routes = (path) => (path.endsWith('/restore') ? failure(409) : post({ revision: 8 }))
  await editor.restoreHistorical(1)
  trace.push(view(editor))
  expect(trace).toMatchSnapshot()
})

it('自动保存：本机副本 400ms、草稿 15s 写服务器；发布状态或审阅发布时不写服务器；离开与卸载保护', async () => {
  vi.useFakeTimers()
  const editor = await mountEditor()
  editor.draft.value.title = '自动保存的标题'
  await flushPromises()
  await vi.advanceTimersByTimeAsync(400)
  const keys = Object.keys(localStorage)
  const trace: unknown[] = [keys.length, mocks.leave?.()]
  await vi.advanceTimersByTimeAsync(15000)
  trace.push(calls.slice(2), view(editor))
  editor.reviewingPublication.value = true
  editor.draft.value.title = '审阅中'
  await flushPromises()
  await vi.advanceTimersByTimeAsync(16000)
  editor.reviewingPublication.value = false
  editor.draft.value.status = 'published'
  editor.draft.value.title = '已发布'
  await flushPromises()
  await vi.advanceTimersByTimeAsync(16000)
  trace.push(calls.length, editor.dirty.value)
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  trace.push(mocks.leave?.())
  expect(trace).toMatchSnapshot()
})
