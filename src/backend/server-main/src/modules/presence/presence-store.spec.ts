/** @file presence-store.spec.ts @description 在线会话过期、浏览去重窗口、博主在线判定、容量上限与北京时间切日 */
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { ONLINE_WINDOW_MS, OWNER_ONLINE_WINDOW_MS, PresenceStore, VIEW_DEDUPE_MS } from './presence-store'
import { beijingDay } from './presence-time'
import { countablePath, isAutomatedClient, PresenceHeartbeatDto } from './presence.dto'

const session = (n: number) => n.toString(16).padStart(32, '0')

describe('PresenceStore', () => {
  it('会话在窗口内计为在线，最后一次心跳超过窗口后移出', () => {
    const store = new PresenceStore()
    store.heartbeat(session(1), 0)
    store.heartbeat(session(2), 1000)
    expect(store.online(1000)).toBe(2)
    store.heartbeat(session(1), 60_000)
    expect(store.online(ONLINE_WINDOW_MS + 999)).toBe(2)
    expect(store.online(ONLINE_WINDOW_MS + 1000)).toBe(1)
    expect(store.online(60_000 + ONLINE_WINDOW_MS)).toBe(0)
  })

  it('同一访客同一页面在去重窗口内只计一次，窗口不因重复进入顺延；不同页面或访客分别计', () => {
    const store = new PresenceStore()
    expect(store.claimView('a', '/', 0)).toBe(true)
    expect(store.claimView('a', '/', VIEW_DEDUPE_MS - 1)).toBe(false)
    expect(store.claimView('a', '/articles/1', 10)).toBe(true)
    expect(store.claimView('b', '/', 10)).toBe(true)
    expect(store.claimView('a', '/', VIEW_DEDUPE_MS)).toBe(true)
  })

  it('博主心跳后两分钟内为在线，之后保留最后时间', () => {
    const store = new PresenceStore()
    expect(store.ownerOnline(0)).toBe(false)
    expect(store.ownerLastSeen()).toBeNull()
    store.ownerHeartbeat(5000)
    expect(store.ownerOnline(5000 + OWNER_ONLINE_WINDOW_MS - 1)).toBe(true)
    expect(store.ownerOnline(5000 + OWNER_ONLINE_WINDOW_MS)).toBe(false)
    expect(store.ownerLastSeen()).toBe(5000)
  })

  it('达到容量后不登记新会话，已有会话照常刷新，过期后腾出空间', () => {
    const store = new PresenceStore(2)
    store.heartbeat(session(1), 0)
    store.heartbeat(session(2), 0)
    store.heartbeat(session(3), 0)
    expect(store.online(0)).toBe(2)
    store.heartbeat(session(1), 50_000)
    store.heartbeat(session(3), ONLINE_WINDOW_MS)
    expect(store.online(ONLINE_WINDOW_MS)).toBe(2)
  })
})

describe('北京时间切日', () => {
  it('UTC 16:00 是北京时间次日 00:00', () => {
    expect(beijingDay(new Date('2026-11-04T15:59:59Z'))).toBe('2026-11-04')
    expect(beijingDay(new Date('2026-11-04T16:00:00Z'))).toBe('2026-11-05')
    expect(beijingDay(new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-01')
  })
})

describe('心跳输入', () => {
  it('会话 ID 必须是 32 位小写十六进制，路径与浏览标记可选', () => {
    expectDtoValid(PresenceHeartbeatDto, { session: session(1) })
    expectDtoValid(PresenceHeartbeatDto, { session: session(1), path: '/articles/1', view: true })
    expectDtoInvalid(PresenceHeartbeatDto, { session: 'ABC' }, 'session', 'matches')
    expectDtoInvalid(PresenceHeartbeatDto, { session: session(1), view: 'yes' }, 'view', 'isBoolean')
    expectDtoInvalid(PresenceHeartbeatDto, { session: session(1), path: '/' + 'a'.repeat(512) }, 'path', 'maxLength')
  })

  it('只计站内公开页面：去掉查询与末尾斜杠，排除后台、初始化、接口与预览', () => {
    expect(countablePath('/')).toBe('/')
    expect(countablePath('/articles/12/?from=rss#top')).toBe('/articles/12')
    expect(countablePath(undefined)).toBeNull()
    expect(countablePath('https://evil.example/')).toBeNull()
    expect(countablePath('//evil.example/')).toBeNull()
    expect(countablePath('/a\nb')).toBeNull()
    for (const path of ['/admin', '/admin/posts', '/setup', '/api/v1/posts', '/posts/preview'])
      expect(countablePath(path)).toBeNull()
    expect(countablePath('/administrator')).toBe('/administrator')
  })

  it('缺少 User-Agent 或命中常见爬虫与脚本客户端时视为自动化访问', () => {
    expect(isAutomatedClient(undefined)).toBe(true)
    expect(isAutomatedClient('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    expect(isAutomatedClient('curl/8.5.0')).toBe(true)
    expect(isAutomatedClient('Uptime-Kuma/2.0.0')).toBe(true)
    expect(
      isAutomatedClient(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
      ),
    ).toBe(false)
  })
})
