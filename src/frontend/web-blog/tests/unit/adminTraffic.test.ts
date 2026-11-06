/** @file adminTraffic.test.ts @description 后台访问统计：排行比例与占比规则、排行卡片的标签与空状态、国家与地区名称、近期访问开关与明细 */
import { afterEach, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import TrafficRanking from '../../app/components/admin/TrafficRanking.vue'
import TrafficRecentVisits from '../../app/components/admin/TrafficRecentVisits.vue'
import { countryName, regionLabel, trafficRows, visitPlace } from '../../app/features/presence/traffic'

const api = vi.hoisted(() => ({ calls: [] as { path: string; options?: Record<string, unknown> }[], enabled: false }))
mockNuxtImport('useAdminApi', () => () => async (path: string, options?: Record<string, unknown>) => {
  api.calls.push({ path, options })
  if (path === '/admin/presence') {
    if (options?.method === 'PATCH') api.enabled = (options.body as { recentVisits: boolean }).recentVisits
    return { recentVisits: api.enabled }
  }
  return {
    items: api.enabled
      ? [
          {
            visitedAt: '2026-11-06T07:00:00.000Z',
            maskedIp: '2408:8456:a1::*',
            country: 'CN',
            region: '北京市',
            city: '北京市',
            device: 'mobile/safari',
            path: '/about',
            referrer: null,
          },
        ]
      : [],
    total: api.enabled ? 1 : 0,
    page: 1,
    pageSize: 50,
  }
})

mockNuxtImport('useCurrentUser', () => () => ({ currentUser: ref({ id: 'owner' }), restore: async () => true }))

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

it('国家名称随语言，省份键在国内只显示名称，地点去掉重复的城市', () => {
  expect(countryName('CN', 'zh-CN')).toBe('中国')
  expect(countryName('US', 'en')).toBe('United States')
  expect(countryName('', 'zh-CN')).toBe('')
  expect(regionLabel('CN/广东省', 'zh-CN')).toBe('广东省')
  expect(regionLabel('US/California', 'zh-CN')).toBe('美国 · California')
  expect(regionLabel('CN/', 'zh-CN', '省份未知')).toBe('中国 · 省份未知')
  expect(visitPlace({ country: 'CN', region: '北京市', city: '北京市' }, 'zh-CN')).toBe('中国 · 北京市')
  expect(visitPlace({ country: '', region: '', city: '' }, 'zh-CN')).toBe('')
})

it('近期访问默认关闭不读明细；开启后列出打码地址与地点，关闭前需确认', async () => {
  api.calls.length = 0
  api.enabled = false
  const wrapper = await mountSuspended(TrafficRecentVisits)
  wrappers.push(wrapper)
  await flushPromises()
  expect(api.calls.some((call) => call.path === '/admin/presence/visits')).toBe(false)
  expect(wrapper.find('table').exists()).toBe(false)
  const toggle = wrapper.get('[data-testid="recent-visits-toggle"]')
  await toggle.setValue(true)
  await flushPromises()
  expect(api.calls.find((call) => call.options?.method === 'PATCH')?.options?.body).toEqual({ recentVisits: true })
  const cells = wrapper.findAll('tbody td').map((cell) => cell.text())
  expect(cells).toContain('2408:8456:a1::*')
  expect(cells).toContain('中国 · 北京市')
  expect(cells).toContain('站内跳转')
  const confirm = vi.fn(() => false)
  vi.stubGlobal('confirm', confirm)
  await toggle.setValue(false)
  await flushPromises()
  expect(confirm).toHaveBeenCalled()
  expect((toggle.element as HTMLInputElement).checked).toBe(true)
  expect(api.calls.filter((call) => call.options?.method === 'PATCH')).toHaveLength(1)
  vi.unstubAllGlobals()
})
