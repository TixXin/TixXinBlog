/** @file galleryReadiness.test.ts @description 图库SSR卡片明确禁用，页面挂载后才开放选择，图片重试不触发灯箱 */
import { expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted, ref } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import GalleryItem from '../../app/components/gallery/GalleryItem.vue'
import GalleryGrid from '../../app/components/gallery/GalleryGrid.vue'
const photo = {
  id: 1,
  title: '窗边光影',
  description: '',
  src: '/photo.webp',
  srcLarge: '/photo.webp',
  width: 800,
  height: 600,
  category: '',
  date: '',
  location: '',
}
it('SSR使用的未接管状态保留照片，但不进入Tab序列且不发出选择事件', async () => {
  const wrapper = await mountSuspended(GalleryItem, { props: { photo, ready: false } })
  expect(wrapper.attributes('aria-disabled')).toBe('true')
  expect(wrapper.attributes('tabindex')).toBe('-1')
  expect(wrapper.get('img').attributes('src')).toBe('/photo.webp')
  await wrapper.trigger('click')
  await wrapper.trigger('keydown', { key: 'Enter' })
  await wrapper.trigger('keydown', { key: ' ' })
  expect(wrapper.emitted('click')).toBeUndefined()
  wrapper.unmount()
})
it('页面宣布接管前点击和Enter不选择，挂载开放后点击、Enter、空格均可选择', async () => {
  const selected = vi.fn(),
    beforeReady: { disabled: string | null; tabindex: string | null; calls: number }[] = []
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        const ready = ref(false),
          root = ref<HTMLElement | null>(null)
        onMounted(() => {
          const item = root.value!.querySelector<HTMLElement>('.gallery-item')!
          item.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
          beforeReady.push({
            disabled: item.getAttribute('aria-disabled'),
            tabindex: item.getAttribute('tabindex'),
            calls: selected.mock.calls.length,
          })
          ready.value = true
        })
        return () =>
          h('section', { ref: root }, [h(GalleryGrid, { photos: [photo], ready: ready.value, onSelect: selected })])
      },
    }),
  )
  expect(beforeReady).toEqual([{ disabled: 'true', tabindex: '-1', calls: 0 }])
  const item = wrapper.get('.gallery-item')
  expect(item.attributes('aria-disabled')).toBe('false')
  expect(item.attributes('tabindex')).toBe('0')
  await item.trigger('click')
  await item.trigger('keydown', { key: 'Enter' })
  await item.trigger('keydown', { key: ' ' })
  expect(selected).toHaveBeenCalledTimes(3)
  expect(selected).toHaveBeenLastCalledWith(photo)
  wrapper.unmount()
})
it('已接管卡片内图片重试保持独立，不向父卡片发出选择', async () => {
  const wrapper = await mountSuspended(GalleryItem, { props: { photo, ready: true } })
  await wrapper.get('img').trigger('error')
  const retry = wrapper.get('button')
  await retry.trigger('keydown', { key: 'Enter' })
  await retry.trigger('click')
  expect(wrapper.emitted('click')).toBeUndefined()
  wrapper.unmount()
})
