/** @file livePresence.test.ts @description 博主在线状态展示规则、心跳循环（首次计浏览、定时、后台暂停、跳转、令牌、离开上报、往返缓存恢复）、正在阅读规则与站点统计卡访问统计行 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import { lastSeenLabel, resolveOwnerPresence } from '../../app/features/presence/ownerPresence'
import { HEARTBEAT_MS, startLivePresence, useLivePresenceState } from '../../app/composables/useLivePresence'
import type { LivePresence } from '../../app/features/presence/types'
import { readersOnPage } from '../../app/features/presence/readers'
import SiteStatsCard from '../../app/components/sidebar/SiteStatsCard.vue'

const zh: Record<string, string> = {
  'layout.presence.online': '在线',
  'layout.presence.idle': '离开',
  'layout.presence.busy': '忙碌',
  'layout.presence.lastSeenJustNow': '刚刚在线',
  'layout.presence.lastSeenMinutes': '{count} 分钟前在线',
  'layout.presence.lastSeenHours': '{count} 小时前在线',
  'layout.presence.lastSeenDays': '{count} 天前在线',
  'layout.presence.lastSeenLongAgo': '超过 {days} 天没在线',
}
const t = (key: string, params: Record<string, unknown> = {}) =>
  (zh[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name]))
const NOW = Date.parse('2026-11-05T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('博主在线状态展示规则', () => {
  it('手动状态类型优先，文案留空时显示状态名', () => {
    expect(resolveOwnerPresence({ presenceStatus: 'busy' }, { status: 'online', lastSeenAt: ago(0) }, NOW, t)).toEqual({
      status: 'busy',
      label: '忙碌',
      signature: '',
      since: '',
    })
    expect(resolveOwnerPresence({ presenceStatus: 'online', presenceLabel: '摸鱼中' }, null, NOW, t).label).toBe(
      '摸鱼中',
    )
  })

  it('状态类型为自动时按心跳：在线显示文案或“在线”，离开显示多久前在线', () => {
    const online = { status: 'online' as const, lastSeenAt: ago(10_000) }
    expect(resolveOwnerPresence({ presenceStatus: '' }, online, NOW, t)).toMatchObject({
      status: 'online',
      label: '在线',
    })
    expect(resolveOwnerPresence({ presenceLabel: '写代码', presenceSignature: '勿扰' }, online, NOW, t)).toMatchObject({
      status: 'online',
      label: '写代码',
      signature: '勿扰',
    })
    const away = { status: 'away' as const, lastSeenAt: ago(3 * 3600_000 + 60_000) }
    expect(resolveOwnerPresence({}, away, NOW, t)).toMatchObject({ status: 'offline', label: '3 小时前在线' })
  })

  it('还没有心跳结果时：有手动文案按在线展示，否则文案为空由界面隐藏', () => {
    expect(resolveOwnerPresence({ presenceSignature: '今天不想写代码' }, null, NOW, t)).toMatchObject({
      status: 'online',
      label: '在线',
      signature: '今天不想写代码',
    })
    expect(resolveOwnerPresence({}, null, NOW, t)).toEqual({ status: 'offline', label: '', signature: '', since: '' })
    expect(resolveOwnerPresence({}, { status: 'away', lastSeenAt: null }, NOW, t).label).toBe('')
  })

  it('最后在线时间分档：刚刚、分钟、小时、天，超过 30 天不再给出具体天数', () => {
    expect(lastSeenLabel(ago(30_000), NOW, t)).toBe('刚刚在线')
    expect(lastSeenLabel(ago(5 * 60_000), NOW, t)).toBe('5 分钟前在线')
    expect(lastSeenLabel(ago(23 * 3600_000), NOW, t)).toBe('23 小时前在线')
    expect(lastSeenLabel(ago(30 * 86400_000), NOW, t)).toBe('30 天前在线')
    expect(lastSeenLabel(ago(31 * 86400_000), NOW, t)).toBe('超过 30 天没在线')
    expect(lastSeenLabel('not-a-date', NOW, t)).toBe('')
    expect(lastSeenLabel(ago(-60_000), NOW, t)).toBe('刚刚在线')
  })
})

describe('心跳循环', () => {
  let visibility: DocumentVisibilityState = 'visible'
  const result: LivePresence = { online: 2, owner: null, stats: { visitors: 1, todayViews: 3, totalViews: 9 } }

  beforeEach(() => {
    vi.useFakeTimers()
    visibility = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    sessionStorage.clear()
    localStorage.removeItem('blog-reader-id')
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function setup(token: string | null = null) {
    const fetcher = vi.fn().mockResolvedValue({ data: result })
    const state = ref<LivePresence | null>(null)
    let path = '/'
    const handle = startLivePresence(state, {
      apiBase: '/api/v1',
      path: () => path,
      token: () => token,
      fetcher: fetcher as unknown as typeof $fetch,
    })
    return { fetcher, state, handle, go: (next: string) => (path = next) }
  }
  const bodies = (fetcher: ReturnType<typeof vi.fn>) => fetcher.mock.calls.map(([, options]) => options.body)

  it('启动即发送并计浏览；之后每 30 秒定时心跳不计浏览，结果写入状态', async () => {
    const { fetcher, state, handle } = setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]![0]).toBe('/api/v1/presence')
    expect(bodies(fetcher)[0]).toMatchObject({ path: '/', view: true })
    expect(bodies(fetcher)[0].session).toMatch(/^[a-f0-9]{32}$/)
    expect(state.value).toEqual({ ...result, path: '/' })
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(bodies(fetcher)[1]).toMatchObject({ view: false })
    // 会话与访客标识在同一标签页内保持不变；访客标识不写入互动用的 blog-visitor-id。
    expect(bodies(fetcher)[1].session).toBe(bodies(fetcher)[0].session)
    expect(localStorage.getItem('blog-reader-id')).toMatch(/^[a-f0-9]{32}$/)
    handle.stop()
  })

  it('页面加载后的第一次浏览附带站外来源域名，之后的心跳与站内跳转不再携带；本站来源不计', async () => {
    const referrer = vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://www.google.com/search?q=blog')
    const { fetcher, handle, go } = setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(bodies(fetcher)[0]).toMatchObject({ view: true, referrer: 'www.google.com' })
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS)
    go('/links')
    handle.pageView()
    await vi.advanceTimersByTimeAsync(0)
    expect(
      bodies(fetcher)
        .slice(1)
        .every((body) => !('referrer' in body)),
    ).toBe(true)
    handle.stop()
    referrer.mockReturnValue(`${window.location.origin}/articles/1`)
    const internal = setup()
    await vi.advanceTimersByTimeAsync(0)
    expect('referrer' in bodies(internal.fetcher)[0]).toBe(false)
    internal.handle.stop()
    referrer.mockReturnValue('')
    const direct = setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(bodies(direct.fetcher)[0]).toMatchObject({ referrer: '' })
    direct.handle.stop()
  })

  it('页面隐藏时暂停，回到前台立即补发并恢复定时', async () => {
    const { fetcher, handle } = setup()
    await vi.advanceTimersByTimeAsync(0)
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 3)
    expect(fetcher).toHaveBeenCalledTimes(1)
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS)
    expect(fetcher).toHaveBeenCalledTimes(3)
    handle.stop()
  })

  it('站内跳转立即发送并计浏览；携带博主令牌；停止后不再请求', async () => {
    const { fetcher, handle, go } = setup('owner-token')
    await vi.advanceTimersByTimeAsync(0)
    go('/articles/1')
    handle.pageView()
    await vi.advanceTimersByTimeAsync(0)
    expect(bodies(fetcher)[1]).toMatchObject({ path: '/articles/1', view: true })
    expect(fetcher.mock.calls[1]![1].headers.Authorization).toBe('Bearer owner-token')
    handle.stop()
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('请求失败保留上一次结果，下一次心跳照常发送', async () => {
    const { fetcher, state, handle } = setup()
    await vi.advanceTimersByTimeAsync(0)
    fetcher.mockRejectedValueOnce(new Error('network'))
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS)
    expect(state.value).toEqual({ ...result, path: '/' })
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS)
    expect(fetcher).toHaveBeenCalledTimes(3)
    handle.stop()
  })

  it('页面关闭时用 sendBeacon 上报离开并停止定时；从往返缓存恢复时立即重新上线', async () => {
    const beacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
    const { fetcher, handle } = setup()
    await vi.advanceTimersByTimeAsync(0)
    const session = bodies(fetcher)[0].session
    window.dispatchEvent(new Event('pagehide'))
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(beacon.mock.calls[0]![0]).toBe('/api/v1/presence/leave')
    expect(JSON.parse(await (beacon.mock.calls[0]![1] as Blob).text())).toEqual({ session })
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const restored = new Event('pageshow') as PageTransitionEvent
    Object.defineProperty(restored, 'persisted', { value: true })
    window.dispatchEvent(restored)
    // 恢复时 visibilitychange 往往紧接着触发，1 秒内不重复补发
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(bodies(fetcher)[1].session).toBe(session)
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS)
    expect(fetcher).toHaveBeenCalledTimes(3)
    handle.stop()
    window.dispatchEvent(new Event('pagehide'))
    expect(beacon).toHaveBeenCalledTimes(1)
  })
})

describe('正在阅读', () => {
  const live = (readers: number | null, path = '/articles/1'): LivePresence => ({
    online: 3,
    owner: null,
    stats: null,
    readers,
    path,
  })

  it('结果属于当前页面且至少两人时显示人数，只有自己、关闭统计或换页后的旧结果不显示', () => {
    expect(readersOnPage(live(3), '/articles/1')).toBe(3)
    expect(readersOnPage(live(2, '/articles/1/'), '/articles/1')).toBe(2)
    expect(readersOnPage(live(1), '/articles/1')).toBeNull()
    expect(readersOnPage(live(null), '/articles/1')).toBeNull()
    expect(readersOnPage(live(3), '/articles/2')).toBeNull()
    expect(readersOnPage({ online: 1, owner: null, stats: null }, '/articles/1')).toBeNull()
    expect(readersOnPage(null, '/articles/1')).toBeNull()
  })
})

describe('站点统计卡访问统计行', () => {
  const stats = { siteAgeDays: 10, articles: 1, views: 2, comments: 3, tags: 4, activity: [] }

  it('心跳结果到达前显示占位，到达后显示数字，关闭公开统计后隐藏', async () => {
    const wrapper = await mountSuspended(SiteStatsCard, { props: { stats }, global: { stubs: { Icon: true } } })
    const live = useLivePresenceState()
    live.value = null
    await nextTick()
    expect(wrapper.find('.stats-card__grid--live').text()).toContain('—')
    live.value = { online: 1, owner: null, stats: { visitors: 12, todayViews: 34, totalViews: 5678 } }
    await nextTick()
    const text = wrapper.find('.stats-card__grid--live').text()
    expect(text).toContain('12')
    expect(text).toContain('34')
    expect(text).toContain('5,678')
    live.value = { online: null, owner: null, stats: null }
    await nextTick()
    expect(wrapper.find('.stats-card__grid--live').exists()).toBe(false)
    live.value = null
    wrapper.unmount()
  })
})
