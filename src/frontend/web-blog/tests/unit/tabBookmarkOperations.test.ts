/** @file tabBookmarkOperations.test.ts @description 标签页页面操作：未登录打开登录、弹窗开关、保存成功才关闭、失败提示、删除分类确认、排序与拖放转发 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useTabBookmarkOperations } from '../../app/features/tab/useTabBookmarkOperations'
import type { Bookmark } from '../../app/features/tab/types'

const toast = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }))
mockNuxtImport('useToast', () => () => toast)

const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  toast.error.mockReset()
  toast.info.mockReset()
})

it('操作流程与转发', async () => {
  const isLoggedIn = ref(false)
  const calls: unknown[] = []
  const record =
    (name: string, result: unknown) =>
    async (...args: unknown[]) => {
      calls.push([name, ...args])
      if (result instanceof Error) throw result
      return result
    }
  const options = {
    isLoggedIn,
    openLoginDrawer: (...args: unknown[]) => calls.push(['login', ...args]),
    bookmarks: ref<Bookmark[]>([
      { id: 'b1', userId: 'u', name: 'A', url: 'https://a.example/', categoryId: 'c1', sortOrder: 0 },
    ]),
    addBookmark: vi.fn(record('addBookmark', null)),
    updateBookmark: vi.fn(record('updateBookmark', { id: 'b1' })),
    removeBookmark: vi.fn(record('removeBookmark', true)),
    addCategory: vi.fn(record('addCategory', null)),
    removeCategory: vi.fn(record('removeCategory', true)),
    reorderBookmarks: vi.fn(record('reorderBookmarks', true)),
    reorderCategories: vi.fn(record('reorderCategories', true)),
  }
  let ops!: ReturnType<typeof useTabBookmarkOperations>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          ops = useTabBookmarkOperations(options as never)
          return () => h('div')
        },
      }),
    ),
  )
  const state = () => [
    ops.addBookmarkVisible.value,
    ops.addCategoryVisible.value,
    ops.settingsOpen.value,
    ops.importOpen.value,
  ]
  const trace: unknown[] = [Object.keys(ops), state()]
  ops.onAddBookmarkClick()
  ops.onAddCategoryClick()
  trace.push(state())
  isLoggedIn.value = true
  ops.onAddBookmarkClick()
  ops.onAddCategoryClick()
  trace.push(state())
  await ops.onSubmitBookmark({ name: 'N', url: 'https://n.example/', categoryId: 'c1' } as never)
  trace.push(state())
  options.addBookmark.mockImplementationOnce(record('addBookmark', { id: 'new' }))
  await ops.onSubmitBookmark({ name: 'N', url: 'https://n.example/', categoryId: 'c1' } as never)
  trace.push(state())
  ops.onAddBookmarkClick()
  options.updateBookmark.mockImplementationOnce(record('updateBookmark', new Error('网络中断')))
  await ops.onUpdateBookmarkFromDialog({ id: 'b1', patch: { name: 'X' } as never })
  options.addBookmark.mockImplementationOnce(async () => {
    throw 'not-an-error'
  })
  await ops.onSubmitBookmark({ name: 'N' } as never)
  await ops.onUpdateBookmarkFromDialog({ id: 'b1', patch: { name: 'Y' } as never })
  trace.push(state(), toast.error.mock.calls)
  await ops.onRemoveBookmark('b1')
  await ops.onSubmitCategory({ name: '新分类' } as never)
  window.confirm = vi.fn(() => false)
  await ops.onRemoveCategory('c1')
  window.confirm = vi.fn(() => true)
  await ops.onRemoveCategory('c2')
  await ops.onReorder([{ id: 'b1', categoryId: 'c1', sortOrder: 100 }])
  await ops.onReorderCategories([{ id: 'c1', sortOrder: 100 }])
  ops.onReadOnlyBlocked()
  ops.onDonate()
  await ops.onBookmarkDropped({ bookmarkId: 'missing', targetCategoryId: 'c2' })
  await ops.onBookmarkDropped({ bookmarkId: 'b1', targetCategoryId: 'c1' })
  await ops.onBookmarkDropped({ bookmarkId: 'b1', targetCategoryId: 'c2' })
  trace.push(calls, toast.info.mock.calls)
  expect(trace).toMatchSnapshot()
})
