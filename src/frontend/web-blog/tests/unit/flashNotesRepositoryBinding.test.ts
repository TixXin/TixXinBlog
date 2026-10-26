/** @file flashNotesRepositoryBinding.test.ts @description 闪念公开分页经仓储对象调用：基于类的仓储依赖 this，首屏读取与加载更多都不能丢失方法绑定 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { FlashNote } from '../../app/features/flash/types'
import { useFlashNotes } from '../../app/composables/useFlashNotes'
import { FLASH_PUBLIC_PAGE_SIZE, invalidateFlashNotes } from '../../app/features/flash/state'

const note = (id: string): FlashNote => ({
  id,
  userId: 'owner',
  content: id,
  isDraft: false,
  images: [],
  tags: [],
  type: 'memo',
  comments: [],
  likes: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
})

class PagedRepository {
  private readonly items = Array.from({ length: FLASH_PUBLIC_PAGE_SIZE + 1 }, (_, index) => note(`n${index}`))
  private request(page: number) {
    const start = (page - 1) * FLASH_PUBLIC_PAGE_SIZE
    return { items: this.items.slice(start, start + FLASH_PUBLIC_PAGE_SIZE), total: this.items.length }
  }
  async listPublicPage(query: { page: number }) {
    return this.request(query.page)
  }
  async list() {
    return []
  }
  async overview() {
    return null
  }
}
const repository = new PagedRepository()
mockNuxtImport('useCurrentUser', () => () => ({ currentUser: ref(null), isLoggedIn: ref(false) }))
mockNuxtImport('useFlashRepository', () => () => repository)
mockNuxtImport('useLoginDrawer', () => () => ({ open: vi.fn() }))

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

it('首屏公开分页与加载更多经仓储对象调用', async () => {
  let state!: ReturnType<typeof useFlashNotes>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useFlashNotes()
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  invalidateFlashNotes(useNuxtApp(), { clear: true })
  await state.load(true)
  await flushPromises()
  expect(state.error.value).toBeNull()
  expect(state.notes.value).toHaveLength(FLASH_PUBLIC_PAGE_SIZE)
  expect(state.hasMore.value).toBe(true)
  await state.loadMore()
  expect(state.moreError.value).toBeNull()
  expect(state.notes.value).toHaveLength(FLASH_PUBLIC_PAGE_SIZE + 1)
})
