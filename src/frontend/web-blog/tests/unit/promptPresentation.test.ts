/** @file promptPresentation.test.ts @description 提示词图片比例、文本复制失败和异步反馈归属 */
import { afterEach, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PromptCard from '../../app/components/prompt/Card.vue'
import PromptDetail from '../../app/components/prompt/Detail.vue'
import type { ImagePrompt } from '../../app/features/prompt/types'
const item: ImagePrompt = {
  id: 9,
  title: '湖边光影',
  description: '观察光线与留白。',
  prompt: 'A quiet lake\nSoft morning light',
  negativePrompt: 'No text',
  model: '',
  tags: ['风景'],
  imageUrl: 'https://images.example.com/wide.jpg',
  imageAlt: '湖面与远山',
  width: null,
  height: null,
  sourceUrl: '',
  publishedAt: '2026-10-03T12:00:00Z',
}
const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const imageStub = {
  props: ['width', 'height'],
  template: '<div data-test="image" :data-width="width" :data-height="height" />',
}
async function detail() {
  const wrapper = await mountSuspended(PromptDetail, {
    attachTo: document.body,
    props: { visible: true, item, pending: false, error: '', editable: false, draft: false },
    global: { stubs: { Teleport: true, CommonImageFrame: imageStub } },
  })
  wrappers.push(wrapper)
  return wrapper
}
it('未知尺寸外链由图片容器读取自然比例，已知尺寸按原始值显示', async () => {
  const wrapper = await mountSuspended(PromptCard, {
    props: { item, ready: true },
    global: { stubs: { CommonImageFrame: imageStub } },
  })
  wrappers.push(wrapper)
  expect(wrapper.find('[data-test="image"]').attributes('data-width')).toBeUndefined()
  expect(wrapper.find('[data-test="image"]').attributes('data-height')).toBeUndefined()
  await wrapper.setProps({ item: { ...item, width: 1800, height: 900 } })
  expect(wrapper.find('[data-test="image"]').attributes('data-width')).toBe('1800')
  expect(wrapper.find('[data-test="image"]').attributes('data-height')).toBe('900')
})
it('分享复制失败提供实际可选择链接，不让读者误复制提示词正文', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
  const wrapper = await detail()
  await wrapper
    .findAll('footer button')
    .find((button) => button.text().includes('分享灵感'))!
    .trigger('click')
  await vi.waitFor(() => expect(wrapper.find('.prompt-detail__copy-status').text()).toContain('下方链接'))
  const input = wrapper.get<HTMLInputElement>('.prompt-detail__manual-link input')
  expect(input.element.value).toBe(`${window.location.origin}/prompts?prompt=9`)
  expect(input.attributes('readonly')).toBeDefined()
  expect(wrapper.find('.prompt-detail__content .prompt-detail__copy-status').exists()).toBe(false)
  expect(wrapper.get('.prompt-detail__notice').text()).toContain('手动复制')
  expect(wrapper.get('.prompt-detail__text p').text()).toBe(item.prompt)
})
it('较早复制成功的计时器不能清除后续失败提示', async () => {
  const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'))
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const wrapper = await detail()
  vi.useFakeTimers()
  await wrapper.get('.prompt-detail__text button').trigger('click')
  await vi.advanceTimersByTimeAsync(2000)
  await wrapper.get('.prompt-detail__text--negative button').trigger('click')
  await vi.advanceTimersByTimeAsync(600)
  expect(wrapper.get('.prompt-detail__copy-status').text()).toContain('复制失败')
})
it('原图入口保留实际地址，更新同一作品后清除旧复制反馈', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  const wrapper = await detail()
  const original = wrapper.get('.prompt-detail__original')
  expect(original.attributes('href')).toBe(item.imageUrl)
  expect(original.attributes('target')).toBe('_blank')
  expect(original.attributes('rel')).toBe('noopener noreferrer')
  await wrapper.get('.prompt-detail__text button').trigger('click')
  await vi.waitFor(() => expect(wrapper.get('.prompt-detail__copy-status').text()).toContain('已复制'))
  await wrapper.setProps({ item: { ...item, prompt: '更新后的画面描述' } })
  expect(wrapper.find('.prompt-detail__copy-status').exists()).toBe(false)
  expect(wrapper.get('.prompt-detail__text p').text()).toBe('更新后的画面描述')
})
it('关闭或切换作品后，迟到的剪贴板结果不能污染下一张作品反馈', async () => {
  let finish!: () => void
  vi.stubGlobal('navigator', {
    clipboard: {
      writeText: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          }),
      ),
    },
  })
  const wrapper = await detail()
  await wrapper.get('.prompt-detail__text button').trigger('click')
  await wrapper.setProps({ visible: false })
  await wrapper.setProps({ visible: true, item: { ...item, id: 10, title: '另一幅山色' } })
  finish()
  await Promise.resolve()
  await nextTick()
  expect(wrapper.find('.prompt-detail__copy-status').exists()).toBe(false)
  expect(wrapper.find('.prompt-detail__manual-link').exists()).toBe(false)
  expect(wrapper.get('.prompt-detail__text button').attributes('disabled')).toBeUndefined()
  expect(wrapper.get('.prompt-detail__text button').text()).toContain('复制提示词')
})
it('关闭入口独立于长文本滚动区，完整提示词和负面词可分别复制', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const wrapper = await detail()
  expect(wrapper.get('.prompt-detail__toolbar button').attributes('aria-label')).toBe('关闭提示词详情')
  expect(wrapper.find('.prompt-detail__content .prompt-detail__close').exists()).toBe(false)
  await wrapper.get('.prompt-detail__text button').trigger('click')
  await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(item.prompt))
  await wrapper.get('.prompt-detail__text--negative button').trigger('click')
  await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(item.negativePrompt))
})
