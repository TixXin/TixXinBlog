/** @file flashNotesState.test.ts @description 闪念实体复用、公开时效、私有集合保留、写后迟到响应隔离、服务端筛选与概览接口。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { CurrentUser } from '../../app/features/auth/types'
import type { FlashNote, FlashOverview } from '../../app/features/flash/types'
import { useFlashNotes } from '../../app/composables/useFlashNotes'
import { invalidateFlashNotes } from '../../app/features/flash/state'
import { invalidatePublicReads, invalidatePublicWrite } from '../../app/utils/invalidatePublicReads'
import { publicReadCache } from '../../app/utils/publicReadCache'

const mocks = vi.hoisted(() => ({
  auth: {} as { currentUser: Ref<CurrentUser | null>; isLoggedIn: Ref<boolean> },
  repo: {
    list: vi.fn(),
    listPublic: vi.fn(),
    overview: vi.fn(),
    listArchived: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    search: vi.fn(),
    toggleLike: vi.fn(),
    setPinned: vi.fn(),
    setArchived: vi.fn(),
    addComment: vi.fn(),
    removeComment: vi.fn(),
  },
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useFlashRepository', () => () => mocks.repo)
mockNuxtImport('useLoginDrawer', () => () => ({ open: vi.fn() }))

const wrappers: { unmount(): void }[] = []
let now = 1_000_000
function note(id: string, content = id, isDraft = false): FlashNote {
  return {
    id,
    userId: 'owner-a',
    content,
    isDraft,
    images: [],
    tags: [],
    type: 'memo',
    comments: [],
    likes: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: Error) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
function actor(id = 'owner-a', role: CurrentUser['role'] = 'owner') {
  mocks.auth.currentUser.value = { id, role, nickname: id, avatar: '/avatar.svg', email: '' }
  mocks.auth.isLoggedIn.value = true
}
async function setup() {
  let state!: ReturnType<typeof useFlashNotes>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useFlashNotes()
        return () => h('div', state.notes.value.map((item) => item.content).join('|'))
      },
    }),
  )
  wrappers.push(wrapper)
  return { state, wrapper }
}
async function leave() {
  wrappers.pop()?.unmount()
  await nextTick()
}
beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  for (const mock of Object.values(mocks.repo)) mock.mockReset()
  mocks.repo.list.mockResolvedValue([note('public')])
  mocks.auth = { currentUser: ref(null), isLoggedIn: ref(false) }
  const app = useNuxtApp()
  for (const key of Object.keys(app.payload.state))
    if (key.startsWith('$sflash-')) Reflect.deleteProperty(app.payload.state, key)
  app.payload.state['$spage-content-context'] = 'library-a'
  useRuntimeConfig().public.useMockRepo = false
  publicReadCache(app).invalidate()
})
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await nextTick()
  vi.restoreAllMocks()
})

describe('闪念公开读取时效', () => {
  it('跨挂载 30 秒内复用实体，30 秒后先显示旧结果再刷新', async () => {
    const first = await setup()
    await first.state.load()
    await leave()
    now += 29_999
    const second = await setup()
    await second.state.load()
    expect(mocks.repo.list).toHaveBeenCalledTimes(1)
    now += 1
    const pending = deferred<FlashNote[]>()
    mocks.repo.list.mockReturnValueOnce(pending.promise)
    const loading = second.state.load()
    expect(second.state.notes.value[0]?.id).toBe('public')
    expect(second.state.loading.value).toBe(true)
    pending.resolve([note('updated')])
    await loading
    expect(second.state.notes.value[0]?.id).toBe('updated')
    expect(publicReadCache(useNuxtApp()).size().entries).toBe(0)
  })

  it('五分钟内刷新失败保留内容和错误，超过五分钟冷加载不保留旧条目', async () => {
    const { state } = await setup()
    await state.load()
    now += 300_000
    mocks.repo.list.mockRejectedValueOnce(new Error('暂时离线'))
    await state.load()
    expect(state.notes.value[0]?.id).toBe('public')
    expect(state.error.value).toBe('暂时离线')
    now += 1
    const pending = deferred<FlashNote[]>()
    mocks.repo.list.mockReturnValueOnce(pending.promise)
    const loading = state.load()
    expect(state.notes.value).toEqual([])
    expect(state.loaded.value).toBe(false)
    pending.reject(new Error('仍未恢复'))
    await loading
    expect(state.error.value).toBe('仍未恢复')
    expect(state.notes.value).toEqual([])
  })

  it('手动刷新始终读取，公开结果拒绝草稿和归档记录', async () => {
    mocks.repo.list.mockResolvedValue([
      note('public'),
      note('draft', '私有', true),
      { ...note('archive'), isArchived: true },
    ])
    const { state } = await setup()
    await state.load()
    await state.load(true)
    expect(mocks.repo.list).toHaveBeenCalledTimes(2)
    expect(state.notes.value.map((item) => item.id)).toEqual(['public'])
  })

  it('登录态真实列表也重新验证，但超时或失败不会按公开冷加载策略清空私有草稿', async () => {
    actor()
    mocks.repo.list.mockResolvedValue([note('private', '已保存草稿', true)])
    const { state } = await setup()
    await state.load()
    const retained = state.notes.value
    now += 300_001
    const pending = deferred<FlashNote[]>()
    mocks.repo.list.mockReturnValueOnce(pending.promise)
    const loading = state.load()
    expect(state.notes.value).toBe(retained)
    expect(state.loading.value).toBe(true)
    pending.reject(new Error('暂时离线'))
    await loading
    expect(state.notes.value).toBe(retained)
    expect(state.error.value).toBe('暂时离线')
  })
})

describe('闪念写后失效', () => {
  it('首次列表未完成时保存会重读完整集合，旧读取不能覆盖已确认的新记录', async () => {
    actor()
    const pending = deferred<FlashNote[]>()
    mocks.repo.list.mockReturnValueOnce(pending.promise)
    const { state } = await setup()
    const loading = state.load()
    const created = note('new', '新保存草稿', true)
    mocks.repo.create.mockResolvedValue(created)
    mocks.repo.list.mockResolvedValue([created, note('kept', '以前保存的草稿', true)])
    await state.add({ content: created.content, tags: [], isDraft: true })
    await flushPromises()
    pending.resolve([note('kept', '以前保存的草稿', true)])
    await loading
    expect(state.loaded.value).toBe(true)
    expect(state.loading.value).toBe(false)
    expect(state.notes.value.map((item) => item.id)).toEqual(['new', 'kept'])
    expect(mocks.repo.list).toHaveBeenCalledTimes(2)
  })

  it('保存草稿不会清空其他私有记录，旧列表响应不能覆盖已确认新增', async () => {
    actor()
    const existing = [note('draft-a', '已有私有草稿', true), note('published')]
    mocks.repo.list.mockResolvedValue(existing)
    const { state } = await setup()
    await state.load()
    const pending = deferred<FlashNote[]>()
    mocks.repo.list.mockReturnValueOnce(pending.promise)
    const loading = state.load(true)
    const created = note('draft-b', '新保存草稿', true)
    mocks.repo.create.mockImplementation(async () => {
      invalidatePublicWrite(useNuxtApp(), '/admin/flashes')
      return created
    })
    await state.add({ content: created.content, tags: [], isDraft: true })
    expect(state.notes.value.map((item) => item.id)).toEqual(['draft-b', 'draft-a', 'published'])
    expect(state.loading.value).toBe(false)
    pending.resolve(existing)
    await loading
    expect(state.notes.value.map((item) => item.id)).toEqual(['draft-b', 'draft-a', 'published'])
    mocks.repo.list.mockResolvedValue([created, ...existing])
    await state.load()
    expect(mocks.repo.list).toHaveBeenCalledTimes(3)
    expect(publicReadCache(useNuxtApp()).size().entries).toBe(0)
  })

  it.each(['update', 'remove', 'restore'] as const)('%s 接纳本地结果并拒绝之前开始的旧读取', async (operation) => {
    actor()
    const existing = [note('target'), note('private', '保留的草稿', true)]
    mocks.repo.list.mockResolvedValue(existing)
    const { state } = await setup()
    await state.load()
    const pending = deferred<FlashNote[]>()
    mocks.repo.list.mockReturnValueOnce(pending.promise)
    const loading = state.load(true)
    if (operation === 'update') {
      mocks.repo.update.mockResolvedValue(note('target', '修改后的正文'))
      await state.update('target', { content: '修改后的正文' })
    } else if (operation === 'remove') {
      mocks.repo.remove.mockResolvedValue(undefined)
      await state.remove('target')
    } else {
      mocks.repo.setArchived.mockResolvedValue(note('restored', '恢复的草稿', true))
      await state.setArchived('restored', false)
    }
    const accepted = state.notes.value.map((item) => ({ ...item }))
    pending.resolve(existing)
    await loading
    expect(state.notes.value).toEqual(accepted)
    expect(state.notes.value.some((item) => item.id === 'private')).toBe(true)
    if (operation === 'remove') expect(state.notes.value.some((item) => item.id === 'target')).toBe(false)
    if (operation === 'update')
      expect(state.notes.value.find((item) => item.id === 'target')?.content).toBe('修改后的正文')
    if (operation === 'restore') expect(state.notes.value[0]?.id).toBe('restored')
  })

  it.each(['管理编辑', '管理删除', '管理恢复', '内容导入'])(
    '%s 保留现有私有集合但使下次回访真实读取',
    async (operation) => {
      actor()
      const first = await setup()
      await first.state.load()
      const retained = first.state.notes.value
      await leave()
      if (operation === '内容导入') invalidatePublicReads(useNuxtApp())
      else invalidatePublicWrite(useNuxtApp(), '/admin/flashes/target')
      expect(first.state.notes.value).toBe(retained)
      const changed =
        operation === '管理删除'
          ? []
          : [note('latest', operation, operation === '管理恢复' || operation === '内容导入')]
      mocks.repo.list.mockResolvedValue(changed)
      const returned = await setup()
      await returned.state.load()
      expect(mocks.repo.list).toHaveBeenCalledTimes(2)
      expect(returned.state.notes.value).toEqual(changed)
    },
  )

  it('全域恢复撤销在途读取，已撤销的公开结果不能继续用于回访', async () => {
    const { state } = await setup()
    await state.load()
    const pending = deferred<FlashNote[]>()
    mocks.repo.list.mockReturnValueOnce(pending.promise)
    const loading = state.load(true)
    invalidatePublicReads(useNuxtApp())
    pending.resolve([note('old-import')])
    await loading
    expect(state.notes.value[0]?.id).toBe('public')
    const next = deferred<FlashNote[]>()
    mocks.repo.list.mockReturnValueOnce(next.promise)
    const fresh = state.load()
    expect(state.notes.value).toEqual([])
    next.resolve([note('restored-library')])
    await fresh
    expect(state.notes.value[0]?.id).toBe('restored-library')
  })
})

describe('闪念读取所有权', () => {
  it.each(['actor', 'scope', 'contentOwner', 'context'] as const)(
    '%s 变化同步隐藏旧集合并拒绝迟到读取',
    async (change) => {
      actor()
      mocks.repo.list.mockResolvedValue([note('private', '上一个身份的草稿', true)])
      const { state } = await setup()
      await state.load()
      const pending = deferred<FlashNote[]>()
      mocks.repo.list.mockReturnValueOnce(pending.promise)
      const loading = state.load(true)
      if (change === 'actor') actor('owner-b')
      else if (change === 'scope') mocks.auth.isLoggedIn.value = false
      else if (change === 'contentOwner') actor('owner-a', 'visitor')
      else useNuxtApp().payload.state['$spage-content-context'] = 'library-b'
      expect(state.notes.value).toEqual([])
      pending.resolve([note('old-private', '迟到草稿', true)])
      await loading
      expect(state.notes.value).toEqual([])
      mocks.repo.list.mockResolvedValue([note('current')])
      await state.load()
      expect(state.notes.value[0]?.id).toBe('current')
    },
  )

  it('离开页面期间切换身份，重新挂载的首次渲染不显示旧草稿', async () => {
    actor()
    mocks.repo.list.mockResolvedValue([note('private', '旧草稿', true)])
    const first = await setup()
    await first.state.load()
    await leave()
    actor('owner-b')
    const next = await setup()
    expect(next.state.notes.value).toEqual([])
    expect(next.wrapper.text()).not.toContain('旧草稿')
  })

  it('切换身份后的迟到写入不会混入新身份集合', async () => {
    actor()
    const { state } = await setup()
    await state.load()
    const pending = deferred<FlashNote>()
    mocks.repo.update.mockReturnValueOnce(pending.promise)
    const writing = state.update('public', { content: '旧身份输入' })
    const rejected = expect(writing).rejects.toThrow('闪念所属身份或内容库已变化')
    actor('owner-b')
    mocks.repo.list.mockResolvedValue([note('current')])
    await state.load()
    pending.resolve(note('public', '旧身份输入', true))
    await rejected
    expect(state.notes.value.map((item) => item.id)).toEqual(['current'])
  })

  it('专用失效不会清空已保存草稿或额外维护公共缓存', async () => {
    actor()
    mocks.repo.list.mockResolvedValue([note('private', '保留的草稿', true)])
    const { state } = await setup()
    await state.load()
    const retained = state.notes.value
    invalidateFlashNotes(useNuxtApp())
    expect(state.notes.value).toBe(retained)
    expect(state.loaded.value).toBe(true)
    expect(publicReadCache(useNuxtApp()).size().entries).toBe(0)
    await flushPromises()
    expect(state.notes.value).toBe(retained)
  })
})

describe('闪念公开分页', () => {
  type PageQuery = { page: number; pageSize: number; tag?: string; q?: string; type?: string; date?: string }
  const overviewOf = (patch: Partial<FlashOverview> = {}): FlashOverview => ({
    total: 3,
    monthCount: 2,
    dates: [{ date: '2026-10-01', count: 3 }],
    tags: [
      { name: '生活', count: 2 },
      { name: '技术', count: 2 },
    ],
    onThisDay: null,
    recollections: [],
    likedIds: [],
    ...patch,
  })
  const listPublicPage =
    vi.fn<(query: PageQuery) => Promise<{ items: FlashNote[]; total: number; page: number; pageSize: number }>>()
  const pageOf = (ids: string[], total: number, page = 1) => ({
    items: ids.map((id) => note(id)),
    total,
    page,
    pageSize: 20,
  })
  const range = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`)
  beforeEach(() => {
    listPublicPage.mockReset()
    Object.assign(mocks.repo, { listPublicPage })
  })
  afterEach(() => {
    Reflect.deleteProperty(mocks.repo, 'listPublicPage')
  })

  it('首屏只读第一页，加载更多按页追加并按编号去重，读完后不再请求', async () => {
    listPublicPage
      .mockResolvedValueOnce(pageOf(range('a', 20), 25))
      .mockResolvedValueOnce(pageOf(['a20', ...range('b', 4)], 25, 2))
    const { state } = await setup()
    await state.load()
    expect(listPublicPage).toHaveBeenCalledTimes(1)
    expect(listPublicPage).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 })
    expect(mocks.repo.list).not.toHaveBeenCalled()
    expect(state.notes.value).toHaveLength(20)
    expect(state.hasMore.value).toBe(true)
    expect(state.totalCount.value).toBe(25)
    await state.loadMore()
    expect(listPublicPage).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 })
    expect(state.notes.value.map((item) => item.id)).toEqual([...range('a', 20), ...range('b', 4)])
    expect(state.hasMore.value).toBe(false)
    await state.loadMore()
    expect(listPublicPage).toHaveBeenCalledTimes(2)
  })

  it('标签与关键词交给后端分页，二者可以同时作为服务端条件', async () => {
    listPublicPage.mockResolvedValue(pageOf(['all'], 1))
    const { state } = await setup()
    await state.load()
    listPublicPage.mockResolvedValueOnce(pageOf(['tagged'], 1))
    state.setPublicFilter({ tag: '生活', q: '' })
    await flushPromises()
    expect(listPublicPage).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, tag: '生活' })
    expect(state.notes.value.map((item) => item.id)).toEqual(['tagged'])
    // 只有全部条件的总数才计入“博主总数”
    expect(state.totalCount.value).toBe(1)
    listPublicPage.mockResolvedValueOnce(pageOf(['found'], 1))
    state.setPublicFilter({ tag: null, q: '  山顶 ' })
    await flushPromises()
    expect(listPublicPage).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, q: '山顶' })
    expect(state.notes.value.map((item) => item.id)).toEqual(['found'])
    state.setPublicFilter({ tag: null, q: '山顶' })
    expect(listPublicPage).toHaveBeenCalledTimes(3)
    listPublicPage.mockResolvedValueOnce(pageOf(['both'], 1))
    state.setPublicFilter({ tag: '生活', q: '山顶' })
    await flushPromises()
    expect(listPublicPage).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, tag: '生活', q: '山顶' })
    expect(state.notes.value.map((item) => item.id)).toEqual(['both'])
  })

  it('类型与日期筛选同样走后端分页，加载更多沿用同一条件', async () => {
    listPublicPage.mockResolvedValueOnce(pageOf(range('a', 20), 30))
    const { state } = await setup()
    await state.load()
    listPublicPage.mockResolvedValueOnce(pageOf(range('i', 20), 25))
    state.setPublicFilter({ tag: null, q: '', type: 'idea', date: '2026-10-14' })
    await flushPromises()
    expect(listPublicPage).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, type: 'idea', date: '2026-10-14' })
    expect(state.total.value).toBe(25)
    expect(state.hasMore.value).toBe(true)
    // 筛选结果不计入“博主总数”
    expect(state.totalCount.value).toBe(30)
    listPublicPage.mockResolvedValueOnce(pageOf(range('j', 5), 25, 2))
    await state.loadMore()
    expect(listPublicPage).toHaveBeenLastCalledWith({ page: 2, pageSize: 20, type: 'idea', date: '2026-10-14' })
    expect(state.notes.value).toHaveLength(25)
    // 空值与未传等价，不重复请求
    state.setPublicFilter({ tag: '', q: ' ', type: 'idea', date: '2026-10-14' })
    expect(listPublicPage).toHaveBeenCalledTimes(3)
    expect(mocks.repo.listPublic).not.toHaveBeenCalled()
  })

  it('切换条件后迟到的追加页被丢弃，不混入新条件的列表', async () => {
    listPublicPage.mockResolvedValueOnce(pageOf(range('a', 20), 40))
    const { state } = await setup()
    await state.load()
    const late = deferred<ReturnType<typeof pageOf>>()
    listPublicPage.mockReturnValueOnce(late.promise)
    const more = state.loadMore()
    expect(state.moreLoading.value).toBe(true)
    listPublicPage.mockResolvedValueOnce(pageOf(['tagged'], 1))
    state.setPublicFilter({ tag: '技术', q: '' })
    await flushPromises()
    late.resolve(pageOf(range('b', 20), 40, 2))
    await more
    expect(state.notes.value.map((item) => item.id)).toEqual(['tagged'])
    expect(state.moreLoading.value).toBe(false)
    expect(state.hasMore.value).toBe(false)
  })

  it('写后失效撤销在途追加页，加载状态不会卡住', async () => {
    listPublicPage.mockResolvedValueOnce(pageOf(range('a', 20), 40))
    const { state } = await setup()
    await state.load()
    const late = deferred<ReturnType<typeof pageOf>>()
    listPublicPage.mockReturnValueOnce(late.promise)
    const more = state.loadMore()
    invalidatePublicWrite(useNuxtApp(), '/admin/flashes/a1')
    expect(state.moreLoading.value).toBe(false)
    late.resolve(pageOf(range('b', 20), 40, 2))
    await more
    expect(state.notes.value).toHaveLength(20)
  })

  it('追加失败保留已加载内容并给出可重试错误', async () => {
    listPublicPage.mockResolvedValueOnce(pageOf(range('a', 20), 40))
    const { state } = await setup()
    await state.load()
    listPublicPage.mockRejectedValueOnce(new Error('闪念服务暂时不可用，请稍后重试'))
    await state.loadMore()
    expect(state.notes.value).toHaveLength(20)
    expect(state.moreError.value).toBe('闪念服务暂时不可用，请稍后重试')
    expect(state.hasMore.value).toBe(true)
    listPublicPage.mockResolvedValueOnce(pageOf(range('b', 20), 40, 2))
    await state.loadMore()
    expect(state.moreError.value).toBeNull()
    expect(state.notes.value).toHaveLength(40)
  })

  it('30 秒后重新验证核对已展示的全部页，旧内容在刷新期间保留', async () => {
    listPublicPage
      .mockResolvedValueOnce(pageOf(range('a', 20), 45))
      .mockResolvedValueOnce(pageOf(range('b', 20), 45, 2))
    const { state } = await setup()
    await state.load()
    await state.loadMore()
    now += 30_000
    const first = deferred<ReturnType<typeof pageOf>>()
    listPublicPage.mockReturnValueOnce(first.promise).mockResolvedValueOnce(pageOf(['a20', ...range('b', 19)], 46, 2))
    const loading = state.load()
    expect(state.notes.value).toHaveLength(40)
    first.resolve(pageOf(['new', ...range('a', 19)], 46))
    await loading
    expect(listPublicPage.mock.calls.slice(2).map(([query]) => query.page)).toEqual([1, 2])
    expect(state.notes.value[0]?.id).toBe('new')
    expect(state.notes.value).toHaveLength(40)
    expect(state.hasMore.value).toBe(true)
  })

  it('概览就绪前侧栏不出聚合，就绪后用概览接口统计并补齐首屏个人点赞状态，不再全量读取', async () => {
    listPublicPage.mockResolvedValueOnce(pageOf(['a1', 'a2'], 3))
    const { state } = await setup()
    await state.load()
    expect(state.aggregatesReady.value).toBe(false)
    expect(state.tagCloud.value).toEqual([])
    expect(state.totalCount.value).toBe(3)
    mocks.repo.overview.mockResolvedValueOnce(overviewOf({ total: 4, likedIds: ['a1'] }))
    await state.loadOverview()
    expect(state.aggregatesReady.value).toBe(true)
    expect(state.totalCount.value).toBe(4)
    expect(state.monthlyCount.value).toBe(2)
    expect(state.overview.value?.dates).toEqual([{ date: '2026-10-01', count: 3 }])
    expect(state.tagCloud.value).toEqual([
      { name: '生活', count: 2 },
      { name: '技术', count: 2 },
    ])
    expect(state.notes.value.find((item) => item.id === 'a1')?.liked).toBe(true)
    expect(state.notes.value.find((item) => item.id === 'a2')?.liked).toBeFalsy()
    expect(mocks.repo.listPublic).not.toHaveBeenCalled()
    // 30 秒内不重复读取概览
    await state.loadOverview()
    expect(mocks.repo.overview).toHaveBeenCalledTimes(1)
    now += 30_000
    mocks.repo.overview.mockResolvedValueOnce(overviewOf())
    await state.loadOverview()
    expect(mocks.repo.overview).toHaveBeenCalledTimes(2)
  })

  it('概览失败保留错误且侧栏不就绪，强制重试后恢复', async () => {
    listPublicPage.mockResolvedValueOnce(pageOf(['a1'], 1))
    const { state } = await setup()
    await state.load()
    mocks.repo.overview.mockRejectedValueOnce(new Error('闪念服务暂时不可用，请稍后重试'))
    await state.loadOverview()
    expect(state.aggregatesReady.value).toBe(false)
    expect(state.overviewError.value).toBe('闪念服务暂时不可用，请稍后重试')
    mocks.repo.overview.mockResolvedValueOnce(overviewOf())
    await state.loadOverview(true)
    expect(state.aggregatesReady.value).toBe(true)
    expect(state.overviewError.value).toBeNull()
  })

  it('点赞同步列表与概览中的已赞编号，在途概览随写入作废并重新读取', async () => {
    listPublicPage.mockResolvedValueOnce(pageOf(['a1', 'a2'], 2))
    const { state } = await setup()
    await state.load()
    mocks.repo.overview.mockResolvedValueOnce(overviewOf({ likedIds: ['a1'] }))
    await state.loadOverview()
    mocks.repo.toggleLike.mockResolvedValueOnce({ ...note('a2'), liked: true, likes: 1 })
    await state.toggleLike('a2')
    expect(state.overview.value?.likedIds).toEqual(['a1', 'a2'])
    expect(state.notes.value.find((item) => item.id === 'a2')?.liked).toBe(true)
    mocks.repo.toggleLike.mockResolvedValueOnce({ ...note('a1'), liked: false, likes: 0 })
    await state.toggleLike('a1')
    expect(state.overview.value?.likedIds).toEqual(['a2'])

    // 概览尚未取得时写入：旧请求作废，重新读取的结果才生效
    invalidateFlashNotes(useNuxtApp(), { clear: true })
    listPublicPage.mockResolvedValueOnce(pageOf(['a1', 'a2'], 2))
    await state.load()
    const stale = deferred<FlashOverview>()
    mocks.repo.overview.mockReturnValueOnce(stale.promise)
    const pending = state.loadOverview()
    mocks.repo.overview.mockResolvedValueOnce(overviewOf({ likedIds: ['a1', 'a2'] }))
    mocks.repo.toggleLike.mockResolvedValueOnce({ ...note('a1'), liked: true, likes: 1 })
    await state.toggleLike('a1')
    await flushPromises()
    stale.resolve(overviewOf({ likedIds: [] }))
    await pending
    expect(state.overview.value?.likedIds).toEqual(['a1', 'a2'])
    expect(state.notes.value.every((item) => item.liked)).toBe(true)
  })

  it('登录后的私有视图忽略分页接口，仍读取包含草稿的完整集合', async () => {
    actor()
    mocks.repo.list.mockResolvedValue([note('draft', '私有草稿', true), note('public')])
    const { state } = await setup()
    await state.load()
    expect(listPublicPage).not.toHaveBeenCalled()
    expect(state.pagedPublic.value).toBe(false)
    expect(state.hasMore.value).toBe(false)
    expect(state.notes.value.map((item) => item.id)).toEqual(['draft', 'public'])
    await state.loadOverview()
    expect(mocks.repo.listPublic).not.toHaveBeenCalled()
    expect(mocks.repo.overview).not.toHaveBeenCalled()
    // 私有视图的侧栏由已持有的完整集合计算
    expect(state.aggregatesReady.value).toBe(true)
    expect(state.totalCount.value).toBe(2)
    expect(state.overview.value?.dates).toEqual([{ date: '2026-10-01', count: 2 }])
  })
})
