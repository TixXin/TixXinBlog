/** @file adminBatchSelection.test.ts @description 后台批量选择：当前页及跨页快照、数量上限、可访问名与播报、评论留言接口和删除确认 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import BatchBar from '../../app/components/admin/BatchBar.vue'
import CommentsPage from '../../app/pages/admin/comments.vue'
import { describeBatchResult, useAdminBatchSelection } from '../../app/composables/useAdminBatchSelection'
import type { AdminBatchSelectionOptions } from '../../app/composables/useAdminBatchSelection'
import { useAdminGuestbook } from '../../app/composables/useAdminGuestbook'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  auth: {} as {
    currentUser: Ref<{ id: string } | null>
    isLoggedIn: Ref<boolean>
    restoringPending: Ref<boolean>
    restore: ReturnType<typeof vi.fn>
  },
  route: {} as { path: string; fullPath: string; query: Record<string, string> },
  repo: { adminList: vi.fn(), adminDetail: vi.fn(), update: vi.fn(), remove: vi.fn() },
  invalidate: vi.fn(),
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useToast', () => () => mocks.toast)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport('useRouter', () => () => ({
  push: vi.fn(),
  replace: vi.fn(),
  resolve: () => ({ fullPath: '' }),
  afterEach: () => () => undefined,
  beforeEach: () => () => undefined,
}))
mockNuxtImport('useGuestbookRepository', () => () => mocks.repo)
mockNuxtImport('useGuestbookCache', () => () => ({ invalidate: mocks.invalidate }))
mockNuxtImport('onBeforeRouteLeave', () => () => undefined)

const wrappers: { unmount(): void }[] = []
/** 测试环境的 window 未实现 confirm，按需补上可控的确认结果 */
function stubConfirm(value: boolean) {
  const confirm = vi.fn().mockReturnValue(value)
  Object.defineProperty(window, 'confirm', { value: confirm, configurable: true, writable: true })
  return confirm
}
beforeEach(() => {
  mocks.api.mockReset()
  mocks.invalidate.mockReset()
  Object.values(mocks.toast).forEach((mock) => mock.mockReset())
  Object.values(mocks.repo).forEach((mock) => mock.mockReset())
  mocks.auth = {
    currentUser: ref({ id: 'owner' }),
    isLoggedIn: ref(true),
    restoringPending: ref(false),
    restore: vi.fn().mockResolvedValue(true),
  }
  mocks.route = reactive({ path: '/admin/comments', fullPath: '/admin/comments', query: {} })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

it('当前页全选与半选；列表刷新后只保留仍在当前页的选中项', async () => {
  const items = ref([{ id: 1 }, { id: 2 }, { id: 3 }])
  let selection!: ReturnType<typeof useAdminBatchSelection<{ id: number }>>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        selection = useAdminBatchSelection(items)
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  selection.toggle(2)
  expect(selection.partiallySelected.value).toBe(true)
  selection.toggleAll(true)
  expect(selection.allSelected.value).toBe(true)
  expect(selection.count.value).toBe(3)
  items.value = [{ id: 3 }, { id: 4 }]
  await nextTick()
  expect(selection.selectedIds.value).toEqual([3])
  selection.toggleAll()
  expect(selection.count.value).toBe(2)
  selection.toggleAll()
  expect(selection.count.value).toBe(0)
})

/** 在组件作用域内创建选择器，卸载时同步释放列表监听。 */
async function mountSelection(items: Ref<{ id: number; revision: number }[]>, options: AdminBatchSelectionOptions) {
  let selection!: ReturnType<typeof useAdminBatchSelection<{ id: number; revision: number }>>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        selection = useAdminBatchSelection(items, options)
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  return selection
}

it('跨页模式保留选择，当前页全选和取消不影响其他页，空页不出现半选', async () => {
  const items = ref([
    { id: 1, revision: 2 },
    { id: 2, revision: 3 },
  ])
  const selection = await mountSelection(items, { preserveAcrossPages: true })
  selection.toggle(1)
  items.value = [
    { id: 3, revision: 4 },
    { id: 4, revision: 5 },
  ]
  await nextTick()
  expect(selection.selectedItems.value).toEqual([{ id: 1, revision: 2 }])
  expect(selection.count.value).toBe(1)
  expect(selection.allSelected.value).toBe(false)
  expect(selection.partiallySelected.value).toBe(false)
  selection.toggle(3)
  expect(selection.partiallySelected.value).toBe(true)
  selection.toggleAll(true)
  expect(selection.selectedIds.value).toEqual([1, 3, 4])
  expect(selection.count.value).toBe(3)
  expect(selection.allSelected.value).toBe(true)
  selection.toggleAll(false)
  expect(selection.selectedIds.value).toEqual([1])
  expect(selection.partiallySelected.value).toBe(false)
  items.value = []
  await nextTick()
  expect(selection.count.value).toBe(1)
  expect(selection.allSelected.value).toBe(false)
  expect(selection.partiallySelected.value).toBe(false)
})

it('跨页快照保留选择时版本，列表原地变更和重新读取不会更新，明确重选后才使用新版本', async () => {
  const items = ref([{ id: 1, revision: 2 }])
  const selection = await mountSelection(items, { preserveAcrossPages: true })
  selection.toggle(1)
  items.value[0]!.revision = 3
  await nextTick()
  expect(selection.selectedItems.value).toEqual([{ id: 1, revision: 2 }])
  items.value = [{ id: 1, revision: 4 }]
  await nextTick()
  selection.toggle(1, true)
  selection.toggleAll(true)
  expect(selection.selectedItems.value).toEqual([{ id: 1, revision: 2 }])
  selection.toggle(1, false)
  selection.toggle(1, true)
  expect(selection.selectedItems.value).toEqual([{ id: 1, revision: 4 }])
  expect(selection.toggle(99)).toBe(false)
  expect(selection.selectedIds.value).toEqual([1])
})

it('跨页选择数量上限同时约束单选、当前页全选与全部替换，超限不部分写入', async () => {
  const items = ref([{ id: 1, revision: 1 }])
  const selection = await mountSelection(items, { preserveAcrossPages: true, limit: 2 })
  expect(selection.toggle(1)).toBe(true)
  items.value = [
    { id: 2, revision: 2 },
    { id: 3, revision: 3 },
  ]
  await nextTick()
  expect(selection.toggleAll(true)).toBe(false)
  expect(selection.selectedIds.value).toEqual([1])
  expect(selection.selectedItems.value).toEqual([{ id: 1, revision: 1 }])
  expect(selection.toggle(2)).toBe(true)
  expect(selection.toggle(3)).toBe(false)
  expect(selection.replaceSelection([{ id: 4, revision: 4 }, ...items.value])).toBe(false)
  expect(selection.selectedItems.value).toEqual([
    { id: 1, revision: 1 },
    { id: 2, revision: 2 },
  ])
  expect(selection.toggle(2, true)).toBe(true)
  selection.remove([1])
  expect(selection.toggle(3)).toBe(true)
  expect(selection.count.value).toBe(2)
})

it('全部替换按编号去重并创建快照，移除与清空释放旧快照，重新选择使用当前版本', async () => {
  const items = ref([{ id: 1, revision: 7 }])
  const selection = await mountSelection(items, { preserveAcrossPages: true, limit: 2 })
  selection.toggle(1)
  const rows = [
    { id: 2, revision: 2 },
    { id: 2, revision: 3 },
    { id: 3, revision: 4 },
  ]
  expect(selection.replaceSelection(rows)).toBe(true)
  rows[0]!.revision = 5
  expect(selection.selectedItems.value).toEqual([
    { id: 2, revision: 2 },
    { id: 3, revision: 4 },
  ])
  selection.remove([2, 99])
  expect(selection.selectedIds.value).toEqual([3])
  expect(selection.selectedItems.value).toEqual([{ id: 3, revision: 4 }])
  selection.clear()
  expect(selection.count.value).toBe(0)
  expect(selection.selectedIds.value).toEqual([])
  items.value = [{ id: 3, revision: 8 }]
  await nextTick()
  selection.toggleAll(true)
  expect(selection.selectedItems.value).toEqual([{ id: 3, revision: 8 }])
  expect(selection.replaceSelection([])).toBe(true)
  expect(selection.count.value).toBe(0)
})

it('默认当前页模式仍读取当前版本，并在配置上限时原子拒绝超限全选', async () => {
  const items = ref([
    { id: 1, revision: 1 },
    { id: 2, revision: 1 },
  ])
  const selection = await mountSelection(items, { limit: 1 })
  selection.toggle(1)
  items.value = [
    { id: 1, revision: 2 },
    { id: 2, revision: 1 },
  ]
  await nextTick()
  expect(selection.selectedItems.value).toEqual([{ id: 1, revision: 2 }])
  expect(selection.toggleAll(true)).toBe(false)
  expect(selection.toggle(2)).toBe(false)
  expect(selection.selectedIds.value).toEqual([1])
})

it('批量结果文案区分成功、已不存在与已被修改', () => {
  expect(
    describeBatchResult(
      {
        successCount: 2,
        failedCount: 2,
        results: [
          { id: 1, ok: true },
          { id: 2, ok: true },
          { id: 3, ok: false, reason: 'not_found' },
          { id: 4, ok: false, reason: 'conflict' },
        ],
      },
      '已隐藏',
      '评论',
    ),
  ).toBe('已隐藏 2 条评论；1 条已不存在；1 条已被修改，请刷新后重新选择')
  expect(describeBatchResult({ successCount: 0, failedCount: 0, results: [] }, '已删除', '留言')).toBe('没有留言被修改')
})

it('批量操作栏：全选复选框有可访问名并同步半选，数量在礼貌播报区更新，未选择时动作禁用', async () => {
  const wrapper = await mountSuspended(BatchBar, {
    props: {
      noun: '评论',
      count: 0,
      pageCount: 3,
      allSelected: false,
      partiallySelected: false,
      actions: [{ key: 'delete', label: '批量删除', icon: 'lucide:trash-2', danger: true }],
    },
  })
  wrappers.push(wrapper)
  const all = wrapper.get<HTMLInputElement>('input[type="checkbox"]')
  expect(all.element.closest('label')?.textContent).toContain('选择当前页全部评论')
  expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
  expect(wrapper.get('[role="status"]').text()).toBe('未选择评论')
  expect(wrapper.get('button.admin-batch-bar__danger').attributes('disabled')).toBeDefined()
  await wrapper.setProps({ count: 2, partiallySelected: true })
  expect(all.element.indeterminate).toBe(true)
  expect(wrapper.get('[role="status"]').text()).toBe('已选择 2 条评论')
  await wrapper.get('button.admin-batch-bar__danger').trigger('click')
  expect(wrapper.emitted('action')).toEqual([['delete']])
  all.element.checked = true
  await all.trigger('change')
  expect(wrapper.emitted('toggle-all')).toEqual([[true]])
  await wrapper.setProps({ count: 3, partiallySelected: false, allSelected: true })
  expect(all.element.indeterminate).toBe(false)
  expect(all.element.checked).toBe(true)
})

const comment = (id: number, revision: number) => ({
  id,
  revision,
  status: 'pending',
  visible: false,
  author: `访客${id}`,
  content: `评论正文${id}`,
  postId: 1,
  postTitle: '文章',
  postStatus: 'published',
  parentId: null,
  depth: 0,
  isOwner: false,
  createdAt: '2026-10-01T00:00:00.000Z',
})

it('评论页：勾选后批量隐藏提交编号与版本；跳过项保留提示；批量删除需确认', async () => {
  let rows = [comment(1, 2), comment(2, 5), comment(3, 0)]
  mocks.api.mockImplementation(async (path: string) => {
    if (path === '/admin/comments') return { items: rows, total: rows.length }
    if (path === '/admin/comments/articles') return []
    if (path === '/admin/comments/policy') return { requireApproval: false, revision: 1 }
    if (path === '/admin/comments/batch/moderation')
      return {
        ok: true,
        status: 'hidden',
        successCount: 1,
        failedCount: 1,
        results: [
          { id: 1, ok: true, revision: 3 },
          { id: 2, ok: false, reason: 'conflict', revision: 6 },
        ],
      }
    if (path === '/admin/comments/batch/delete')
      return { ok: true, deleted: 4, successCount: 1, failedCount: 0, results: [{ id: 3, ok: true }] }
    throw new Error(path)
  })
  const wrapper = await mountSuspended(CommentsPage, { attachTo: document.body })
  wrappers.push(wrapper)
  await flushPromises()
  const boxes = () => wrapper.findAll<HTMLInputElement>('.admin-comments__select input')
  expect(boxes()).toHaveLength(3)
  expect(boxes()[0]!.attributes('aria-label')).toBe('选择 访客1 的评论：评论正文1')
  await boxes()[0]!.setValue(true)
  await boxes()[1]!.setValue(true)
  expect(wrapper.get('.admin-batch-bar [role="status"]').text()).toBe('已选择 2 条评论')
  expect(wrapper.get<HTMLInputElement>('.admin-batch-bar__all input').element.indeterminate).toBe(true)
  rows = [comment(1, 3), comment(2, 6), comment(3, 0)]
  const hide = wrapper.findAll('.admin-batch-bar button').find((button) => button.text() === '批量隐藏')!
  await hide.trigger('click')
  await flushPromises()
  expect(mocks.api).toHaveBeenCalledWith('/admin/comments/batch/moderation', {
    method: 'POST',
    body: {
      status: 'hidden',
      items: [
        { id: 1, revision: 2 },
        { id: 2, revision: 5 },
      ],
    },
  })
  expect(wrapper.get('[role="alert"]').text()).toContain('已设为已隐藏 1 条评论；1 条已被修改，请刷新后重新选择')
  expect(wrapper.get('.admin-batch-bar [role="status"]').text()).toBe('未选择评论')

  const confirm = stubConfirm(false)
  await boxes()[2]!.setValue(true)
  const remove = wrapper.findAll('.admin-batch-bar button').find((button) => button.text() === '批量删除')!
  await remove.trigger('click')
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('选中的 1 条评论及其所有层级回复'))
  expect(mocks.api).not.toHaveBeenCalledWith('/admin/comments/batch/delete', expect.anything())
  confirm.mockReturnValue(true)
  await remove.trigger('click')
  await flushPromises()
  expect(mocks.api).toHaveBeenCalledWith('/admin/comments/batch/delete', {
    method: 'POST',
    body: { items: [{ id: 3, revision: 0 }] },
  })
  expect(mocks.toast.success).toHaveBeenCalledWith('已删除 1 条评论（含回复共 4 条）')
})

it('留言管理：批量公开与删除走批量接口，删除需确认并失效对应缓存', async () => {
  mocks.route = reactive({ path: '/admin/guestbook', fullPath: '/admin/guestbook', query: {} })
  const notes = [
    { id: 7, revision: 1, author: '甲', content: '留言甲' },
    { id: 8, revision: 4, author: '乙', content: '留言乙' },
  ]
  mocks.repo.adminList.mockResolvedValue({ items: notes, total: 2 })
  mocks.api.mockResolvedValue({ ok: true, successCount: 2, failedCount: 0, results: [] })
  let state!: ReturnType<typeof useAdminGuestbook>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useAdminGuestbook()
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  await flushPromises()
  state.selection.toggleAll(true)
  await state.batch('published')
  expect(mocks.api).toHaveBeenCalledWith('/admin/guestbook/batch', {
    method: 'PATCH',
    body: {
      status: 'published',
      items: [
        { id: 7, revision: 1 },
        { id: 8, revision: 4 },
      ],
    },
  })
  expect(mocks.invalidate.mock.calls.map((call) => call[0])).toEqual([7, 8])
  expect(mocks.toast.success).toHaveBeenCalledWith('已公开 2 条留言')
  expect(state.selection.count.value).toBe(0)

  const confirm = stubConfirm(false)
  state.selection.toggle(8)
  await state.batch('delete')
  expect(mocks.api).toHaveBeenCalledTimes(1)
  confirm.mockReturnValue(true)
  mocks.api.mockResolvedValue({
    ok: true,
    successCount: 0,
    failedCount: 1,
    results: [{ id: 8, ok: false, reason: 'not_found' }],
  })
  await state.batch('delete')
  expect(mocks.api).toHaveBeenLastCalledWith('/admin/guestbook/batch', {
    method: 'DELETE',
    body: { items: [{ id: 8, revision: 4 }] },
  })
  expect(state.error.value).toBe('1 条已不存在')
  expect(state.busy.value).toEqual([])
})
