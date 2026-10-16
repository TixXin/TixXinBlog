/** @file flashNotesState.test.ts @description 闪念实体复用、公开时效、私有集合保留与写后迟到响应隔离。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { CurrentUser } from '../../app/features/auth/types'
import type { FlashNote } from '../../app/features/flash/types'
import { useFlashNotes } from '../../app/composables/useFlashNotes'
import { invalidateFlashNotes } from '../../app/features/flash/state'
import { invalidatePublicReads, invalidatePublicWrite } from '../../app/utils/invalidatePublicReads'
import { publicReadCache } from '../../app/utils/publicReadCache'

const mocks = vi.hoisted(() => ({
  auth: {} as { currentUser: Ref<CurrentUser | null>; isLoggedIn: Ref<boolean> },
  repo: {
    list: vi.fn(),
    listPublic: vi.fn(),
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
