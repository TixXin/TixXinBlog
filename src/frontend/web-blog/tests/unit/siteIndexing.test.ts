// @vitest-environment node
/**
 * @file siteIndexing.test.ts
 * @description 搜索引擎收录开关：服务端读取缓存与失效、站点配置与站点地图钩子、页面 robots 指令
 * @author TixXin
 * @since 2026-10-20
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSiteIndexingLookup,
  searchIndexingOf,
  skipsSiteIndexing,
  SITE_INDEXING_RETRY_MS,
  SITE_INDEXING_TTL_MS,
} from '../../server/utils/siteIndexing'
import { defaultSiteSettings, siteRobotsDirective } from '../../app/features/site/settings'

// 公开内容工具在模块顶层定义 Nitro 缓存函数；这里只测试读取器本身，上游读取由各用例注入。
vi.mock('../../server/utils/publicContent', () => ({ publicSiteSettings: vi.fn() }))
const indexing = vi.hoisted(() => ({ value: true, calls: [] as string[] }))
vi.mock('../../server/utils/siteIndexing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../server/utils/siteIndexing')>()),
  siteSearchIndexing: vi.fn(async (event: { path: string }) => {
    indexing.calls.push(event.path)
    return indexing.value
  }),
}))

describe('收录开关取值', () => {
  it('只有明确关闭才视为不允许收录，旧接口缺字段按允许', () => {
    expect(searchIndexingOf({ searchIndexing: false })).toBe(false)
    expect(searchIndexingOf({ searchIndexing: true })).toBe(true)
    expect(searchIndexingOf({})).toBe(true)
    expect(searchIndexingOf(null)).toBe(true)
  })
  it('页面 robots 指令：关闭时全站 noindex, nofollow，允许时不覆盖模块与页面指令', () => {
    expect(siteRobotsDirective({ searchIndexing: false })).toBe('noindex, nofollow')
    expect(siteRobotsDirective({ searchIndexing: true })).toBeUndefined()
    expect(siteRobotsDirective({} as { searchIndexing: boolean })).toBeUndefined()
    expect(defaultSiteSettings.searchIndexing).toBe(true)
  })
  it('接口转发、构建产物与模块调试路由不读取开关，页面、robots.txt 与站点地图读取', () => {
    for (const path of ['/api/v1/site', '/_nuxt/app.js', '/_ipx/w_100/a.png', '/__sitemap__/style.xsl'])
      expect(skipsSiteIndexing(path)).toBe(true)
    for (const path of ['/', '/robots.txt', '/sitemap.xml', '/articles/hello?ref=api/', '/apidocs'])
      expect(skipsSiteIndexing(path)).toBe(false)
  })
})

describe('收录开关读取缓存', () => {
  let clock = 0
  const now = () => clock
  beforeEach(() => {
    clock = 1_000
  })

  it('缓存期内复用结果，并发读取合并为一次请求', async () => {
    const fetchValue = vi.fn(async () => false)
    const lookup = createSiteIndexingLookup(fetchValue, { now })
    expect(await Promise.all([lookup.get('a'), lookup.get('b')])).toEqual([false, false])
    expect(await lookup.get('c')).toBe(false)
    expect(fetchValue).toHaveBeenCalledTimes(1)
    expect(fetchValue).toHaveBeenCalledWith('a')
    clock += SITE_INDEXING_TTL_MS
    fetchValue.mockResolvedValueOnce(true)
    expect(await lookup.get('d')).toBe(true)
    expect(fetchValue).toHaveBeenCalledTimes(2)
  })

  it('站点设置写入后立即失效，下次读取拿到新值', async () => {
    const fetchValue = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const lookup = createSiteIndexingLookup(fetchValue, { now })
    expect(await lookup.get(null)).toBe(true)
    lookup.invalidate()
    expect(await lookup.get(null)).toBe(false)
    expect(fetchValue).toHaveBeenCalledTimes(2)
  })

  it('读取期间发生写入时，旧结果不进入缓存', async () => {
    let resolveFirst!: (value: boolean) => void
    const fetchValue = vi
      .fn<(context: null) => Promise<boolean>>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(false)
    const lookup = createSiteIndexingLookup(fetchValue, { now })
    const stale = lookup.get(null)
    lookup.invalidate()
    resolveFirst(true)
    expect(await stale).toBe(true)
    expect(await lookup.get(null)).toBe(false)
    expect(fetchValue).toHaveBeenCalledTimes(2)
  })

  it('读取失败时沿用最近一次成功的值，从未成功时按允许收录，并在重试间隔内不再请求', async () => {
    const fetchValue = vi.fn().mockResolvedValueOnce(false).mockRejectedValue(new Error('后端不可用'))
    const lookup = createSiteIndexingLookup(fetchValue, { now })
    expect(await lookup.get(null)).toBe(false)
    lookup.invalidate()
    expect(await lookup.get(null)).toBe(false)
    expect(await lookup.get(null)).toBe(false)
    expect(fetchValue).toHaveBeenCalledTimes(2)
    clock += SITE_INDEXING_RETRY_MS
    expect(await lookup.get(null)).toBe(false)
    expect(fetchValue).toHaveBeenCalledTimes(3)

    const fresh = createSiteIndexingLookup(vi.fn().mockRejectedValue(new Error('后端不可用')), { now })
    expect(await fresh.get(null)).toBe(true)
  })
})

describe('站点配置与站点地图钩子', () => {
  type Hook = (ctx: never) => Promise<void>
  const hooks = new Map<string, Hook>()
  beforeEach(async () => {
    hooks.clear()
    indexing.calls.length = 0
    vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)
    vi.resetModules()
    const plugin = (await import('../../server/plugins/site-indexing')).default as unknown as (app: unknown) => void
    plugin({ hooks: { hook: (name: string, handler: Hook) => hooks.set(name, handler) } })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    indexing.value = true
  })
  const siteConfigInit = async (path: string) => {
    const pushed: Record<string, unknown>[] = []
    await hooks.get('site-config:init')!({
      event: { path },
      siteConfig: { push: (entry) => pushed.push(entry) },
    } as never)
    return pushed
  }

  it('关闭收录时把站点标记为不可索引，并以高于运行时配置的优先级覆盖', async () => {
    indexing.value = false
    expect(await siteConfigInit('/robots.txt')).toEqual([
      { _context: 'site-settings:searchIndexing', _priority: 1, indexable: false },
    ])
    expect(await siteConfigInit('/')).toHaveLength(1)
  })

  it('允许收录时不改写部署环境的站点配置', async () => {
    expect(await siteConfigInit('/')).toEqual([])
  })

  it('接口转发等请求不读取开关', async () => {
    indexing.value = false
    expect(await siteConfigInit('/api/v1/site')).toEqual([])
    expect(indexing.calls).toEqual([])
  })

  it('关闭收录时清空站点地图，允许时保留', async () => {
    const urls = [{ loc: '/' }, { loc: '/articles/hello' }]
    await hooks.get('sitemap:resolved')!({ urls, event: { path: '/sitemap.xml' } } as never)
    expect(urls).toHaveLength(2)
    indexing.value = false
    await hooks.get('sitemap:resolved')!({ urls, event: { path: '/sitemap.xml' } } as never)
    expect(urls).toEqual([])
  })
})
