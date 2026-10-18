/** @file galleryRequestFeedback.test.ts @description 图库灯箱读取失败提供统一重试，加载中阻止重复触发并保留已读作品。 */
import { afterEach, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LightBox from '../../app/components/gallery/LightBox.vue'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

it('灯箱失败显示可读错误与重试，恢复后继续展示作品', async () => {
  const wrapper = await mountSuspended(LightBox, {
    props: { photo: null, visible: true, error: '作品读取中断' },
    global: { stubs: { Teleport: true, Icon: true, CommonImageFrame: true, CommonRelatedContent: true } },
  })
  wrappers.push(wrapper)
  expect(wrapper.get('[role="alert"]').text()).toContain('照片加载失败')
  expect(wrapper.get('[role="alert"]').text()).toContain('作品读取中断')
  const retry = wrapper.get('.request-feedback button')
  expect(retry.text()).toBe('重试')
  await retry.trigger('click')
  expect(wrapper.emitted('retry')).toHaveLength(1)

  await wrapper.setProps({ pending: true })
  expect(wrapper.get('.request-feedback button').attributes('aria-disabled')).toBe('true')
  await wrapper.get('.request-feedback button').trigger('click')
  expect(wrapper.emitted('retry')).toHaveLength(1)
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.get('[role="status"]').text()).toContain('正在加载')

  await wrapper.setProps({
    pending: false,
    error: '',
    photo: {
      id: 1,
      title: '窗边光影',
      description: '午后的光落在窗台上',
      src: '/photo.webp',
      srcLarge: '/photo.webp',
      category: '',
      date: '',
      location: '',
    },
  })
  expect(wrapper.find('.request-feedback').exists()).toBe(false)
  expect(wrapper.get('.lightbox__title').text()).toBe('窗边光影')
})
