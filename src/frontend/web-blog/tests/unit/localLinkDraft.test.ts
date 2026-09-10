/** @file localLinkDraft.test.ts @description 公开友链整理不提交，复制失败和同应用重挂保留当前输入 */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useLocalLinkDraft } from '../../app/composables/useLocalLinkDraft'
const wrappers: { unmount(): void }[] = []
const write = vi.fn()
let clipboard: PropertyDescriptor | undefined
beforeEach(() => {
  sessionStorage.clear()
  write.mockReset().mockResolvedValue(undefined)
  clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})
async function setup(reset = true) {
  let draft!: ReturnType<typeof useLocalLinkDraft>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          if (reset) clearNuxtState(['local-link-draft', 'local-link-draft-initialized'])
          draft = useLocalLinkDraft()
          return () => h('div')
        },
      }),
    ),
  )
  return draft
}
it('复制失败保留所有字段，成功只报告复制而非提交', async () => {
  const state = await setup()
  state.change({ name: '散步笔记', url: 'https://example.com/Notes?b=2&b=1', avatar: '', description: '记录生活' })
  write.mockRejectedValueOnce(new Error('denied'))
  await state.copy()
  expect(state.error.value).toContain('复制失败')
  expect(state.draft.value.description).toBe('记录生活')
  await state.copy()
  expect(state.notice.value).toBe('友链资料已复制，尚未提交申请')
  expect(write.mock.calls[1]?.[0]).toContain('?b=2&b=1')
})
it('主题重挂不能用旧存储覆盖当前内存输入', async () => {
  const first = await setup()
  first.change({ name: '当前输入', url: 'https://example.com' })
  wrappers.pop()!.unmount()
  sessionStorage.setItem(
    'tixxin-local-link-draft',
    JSON.stringify({ name: '旧副本', url: '', avatar: '', description: '' }),
  )
  const second = await setup(false)
  expect(second.draft.value.name).toBe('当前输入')
})
