/** @file momentLocationCard.test.ts @description 朋友圈足迹卡：无地点不显示，点击地点筛选，再点或“全部”取消 */
import { afterEach, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MomentLocationCard from '../../app/components/sidebar/MomentLocationCard.vue'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

it('列出地点与动态数，点击筛选、再次点击或点“全部”取消；没有地点时不渲染', async () => {
  const locations = [
    { name: '杭州', count: 3 },
    { name: '大理', count: 1 },
  ]
  const wrapper = await mountSuspended(MomentLocationCard, {
    props: { locations, activeLocation: null },
    global: { stubs: { Icon: true } },
  })
  wrappers.push(wrapper)
  const items = wrapper.findAll('.moment-location-card__item')
  expect(items.map((item) => item.text())).toEqual(['杭州3 条', '大理1 条'])
  await items[0]!.trigger('click')
  await wrapper.setProps({ activeLocation: '杭州' })
  expect(items[0]!.attributes('aria-pressed')).toBe('true')
  await items[0]!.trigger('click')
  await wrapper.get('.moment-location-card__all').trigger('click')
  expect(wrapper.emitted('select')).toEqual([['杭州'], [null], [null]])
  await wrapper.setProps({ locations: [] })
  expect(wrapper.find('.moment-location-card').exists()).toBe(false)
})
