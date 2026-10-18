/** @file flashAiSearchFeedback.test.ts @description 闪念演示搜索失败使用统一反馈，重试沿用原关键词且加载中不重复请求。 */
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FlashAISearchModal from '../../app/components/flash/FlashAISearchModal.vue'

const mocks = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('~/features/flash/ai-search.mock', () => ({ mockFlashAISearch: mocks.search }))

const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  mocks.search.mockReset()
})

it('失败后用原关键词重试，加载期间不能再次提交', async () => {
  mocks.search.mockRejectedValueOnce(new Error('演示搜索中断'))
  const wrapper = await mountSuspended(FlashAISearchModal, {
    props: { visible: true, notes: [] },
    global: { stubs: { Teleport: true, Transition: false, Icon: true } },
  })
  wrappers.push(wrapper)
  await wrapper.get('input').setValue('窗边的光')
  await wrapper.get('input').trigger('keydown.enter')
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('闪念搜索失败')
  expect(wrapper.get('[role="alert"]').text()).toContain('演示搜索中断')
  expect(mocks.search).toHaveBeenCalledTimes(1)

  let finish!: (value: { answer: string; citedNoteIds: string[]; latencyMs: number }) => void
  mocks.search.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  await wrapper.get('.request-feedback button').trigger('click')
  expect(wrapper.find('.request-feedback button').exists()).toBe(false)
  expect(wrapper.get('.flash-ai-modal__loading').text()).toContain('AI 正在翻阅')
  expect(mocks.search).toHaveBeenCalledTimes(2)
  expect(mocks.search).toHaveBeenLastCalledWith('窗边的光', [], expect.any(AbortSignal))
  finish({ answer: '和窗边有关的一条闪念。', citedNoteIds: [], latencyMs: 12 })
  await flushPromises()
  expect(wrapper.find('.request-feedback').exists()).toBe(false)
  expect(wrapper.text()).toContain('和窗边有关的一条闪念。')
  expect(wrapper.get('input').element.value).toBe('窗边的光')
})
