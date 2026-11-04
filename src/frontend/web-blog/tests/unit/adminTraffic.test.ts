/** @file adminTraffic.test.ts @description 后台访问统计：排行比例与占比规则、排行卡片的标签与空状态 */
import { afterEach, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TrafficRanking from '../../app/components/admin/TrafficRanking.vue'
import { trafficRows } from '../../app/features/presence/traffic'

const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

it('条形长度相对最大值，占比相对合计并取整；空列表与全零不除以零', () => {
  expect(
    trafficRows([
      { key: '/', count: 6 },
      { key: '/links', count: 3 },
      { key: '/about', count: 1 },
    ]),
  ).toEqual([
    { key: '/', count: 6, ratio: 1, percent: 60 },
    { key: '/links', count: 3, ratio: 0.5, percent: 30 },
    { key: '/about', count: 1, ratio: 1 / 6, percent: 10 },
  ])
  expect(trafficRows([])).toEqual([])
  expect(trafficRows([{ key: '', count: 0 }])).toEqual([{ key: '', count: 0, ratio: 0, percent: 0 }])
})

it('排行卡片按标签函数显示键，并显示数量与占比；没有条目时显示空状态', async () => {
  const wrapper = await mountSuspended(TrafficRanking, {
    props: {
      title: '来源',
      entries: [
        { key: 'google.com', count: 3 },
        { key: '', count: 1 },
      ],
      label: (key: string) => (key === '' ? '直接访问' : key),
    },
  })
  wrappers.push(wrapper)
  const rows = wrapper.findAll('.traffic-ranking__row')
  expect(rows.map((row) => row.find('.traffic-ranking__label').text())).toEqual(['google.com', '直接访问'])
  expect(rows[0]!.find('.traffic-ranking__count').text()).toContain('3')
  expect(rows[0]!.find('.traffic-ranking__count').text()).toContain('75')
  const empty = await mountSuspended(TrafficRanking, { props: { title: '设备', entries: [] } })
  wrappers.push(empty)
  expect(empty.find('.traffic-ranking__list').exists()).toBe(false)
  expect(empty.find('.traffic-ranking__empty').exists()).toBe(true)
})
