/**
 * @file adminOverviewMetrics.test.ts
 * @description 管理概览统计卡片：六域总数与六类待办按真实计数求和，趋势合计与读屏摘要来自按日数据，
 *              分区不可用时显示占位而不是 0
 * @author TixXin
 * @since 2026-10-20
 */
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import OverviewMetrics from '../../app/components/admin/OverviewMetrics.vue'
import type { AdminOverview } from '../../app/features/admin/types'

const counts = {
  posts: 10,
  flashes: 2,
  moments: 3,
  gallery: 4,
  projects: 1,
  links: 5,
  views: 12345,
  pendingComments: 1,
  pendingMomentComments: 0,
  pendingFlashComments: 2,
  pendingGuestbook: 0,
  unanswered: 3,
  unansweredGuestbook: 0,
}
const trends = [
  { date: '2026-10-18', content: 1, interactions: 4 },
  { date: '2026-10-19', content: 0, interactions: 9 },
  { date: '2026-10-20', content: 2, interactions: 0 },
]
const overview = (patch: Partial<AdminOverview> = {}): AdminOverview => ({
  counts,
  recentContent: [],
  trends,
  unavailable: [],
  generatedAt: '2026-10-20T00:00:00.000Z',
  ...patch,
})
const values = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) =>
  wrapper.findAll('.overview-metric__value').map((node) => node.text())

describe('管理概览统计卡片', () => {
  it('内容总数、近 30 天互动、累计浏览与待处理均按真实计数求和', async () => {
    const wrapper = await mountSuspended(OverviewMetrics, { props: { overview: overview() } })
    expect(values(wrapper)).toEqual(['25', '13', '12,345', '6'])
    expect(wrapper.text()).toContain('近 30 天新增 3 项')
    // 只有内容与互动有按日数据；浏览量没有按日记录，不画趋势
    expect(wrapper.findAll('.trend-bars')).toHaveLength(2)
    expect(wrapper.findAll('.trend-bars')[1]!.find('svg').attributes('aria-label')).toBe(
      '近 30 天互动：近 30 天共 13，单日最高 9（10月19日）',
    )
  })

  it('统计或趋势分区不可用时显示占位，不伪装为 0', async () => {
    const wrapper = await mountSuspended(OverviewMetrics, {
      props: { overview: overview({ counts: null, trends: null, unavailable: ['counts', 'trends'] }) },
    })
    expect(values(wrapper)).toEqual(['—', '—', '—', '—'])
    expect(wrapper.findAll('.trend-bars')).toHaveLength(0)
    expect(wrapper.text()).toContain('趋势暂不可用')
  })

  it('近 30 天没有记录时趋势摘要说明为空，柱子保留基线', async () => {
    const empty = trends.map((day) => ({ ...day, content: 0 }))
    const wrapper = await mountSuspended(OverviewMetrics, { props: { overview: overview({ trends: empty }) } })
    const bars = wrapper.findAll('.trend-bars')[0]!
    expect(bars.find('svg').attributes('aria-label')).toBe('内容总数：近 30 天没有记录')
    expect(bars.findAll('.trend-bars__bar').map((bar) => bar.attributes('height'))).toEqual(['1', '1', '1'])
    expect(bars.findAll('.trend-bars__bar').at(-1)!.classes()).toContain('is-latest')
  })
})
