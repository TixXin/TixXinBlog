/**
 * @file content-package-version-gate.spec.ts
 * @description 内容包版本门禁回归：v11 专属字段不能被 v1–v10 旧包夹带，v12 专属字段不能被 v1–v11 旧包夹带，
 *   v13 的闪念评论审核状态不能被 v1–v12 旧包夹带，旧包闪念评论按已发布读取
 *   v14 的搜索引擎收录开关不能被 v1–v13 旧包夹带，旧包按允许收录读取
 */
import 'reflect-metadata'
import { parseContentPackage } from '../content-package'

const guestbookMessage = () => ({
  sourceId: 1,
  createdAt: '2026-10-10T08:00:00.000Z',
  deleted: false,
  author: 'Luna',
  avatar: '',
  content: '留言内容',
  isOwner: false,
  status: 'published',
  isPinned: false,
  replyToId: null,
})

/** v13 起闪念评论带审核状态 */
const flashNote = () => ({
  sourceId: 'flash-1',
  createdAt: '2026-10-10T08:00:00.000Z',
  values: { content: '一条闪念' },
  comments: [
    {
      author: '小林',
      avatar: '',
      content: '待审的评论',
      status: 'pending',
      createdAt: '2026-10-10T09:00:00.000Z',
    },
  ],
})

const base = () => ({
  format: 'tixxin-content',
  version: 14,
  omittedRelations: 0,
  exportedAt: '2026-10-16T12:00:00.000Z',
  mediaIncluded: false,
  posts: [],
  flashes: [flashNote()],
  moments: [],
  guestbook: [guestbookMessage()],
  gallery: [],
  projects: [],
  links: [],
  prompts: [],
  subscriptions: [],
  linkSettings: { rules: [] },
  gallerySettings: { gear: [] },
  folders: [],
  tags: [],
  media: [],
  requireCommentApproval: false,
  site: {
    name: '山间札记',
    description: '',
    ownerName: 'tixxin',
    ownerTitle: '',
    avatar: '',
    avatarAlt: '',
    seoTitle: '',
    seoDescription: '',
    announcement: '',
    socials: [],
    about: { visible: false, introduction: '', sections: [] },
    presenceLabel: '在线',
    presenceSignature: '写点东西',
    presenceStatus: 'online',
    launchedAt: '2020-01-01',
    ...v12Site(),
    searchIndexing: false,
  },
})

/** v12 引入的站点字段：导航、页脚链接、每日一言、备案号与版权文案 */
function v12Site() {
  return {
    navigation: [
      { type: 'route', key: 'home', visible: true },
      { type: 'route', key: 'subscriptions', visible: false },
      { type: 'external', label: '旧博客', url: 'https://old.example.com/', newTab: true, visible: true },
    ],
    footerLinks: [{ label: '关于本站', url: '/about', newTab: false }],
    quotes: ['一句话'],
    icpNumber: '京ICP备00000000号',
    icpUrl: '',
    copyright: '© {year} 山间札记',
  }
}
const V12_SITE_KEYS = Object.keys(v12Site())

/** 构造指定旧版本的合法包：删除该版本不支持的字段，保留基础内容。 */
function legacy(version: number) {
  const input = base() as unknown as Record<string, unknown>
  const site = input.site as Record<string, unknown>
  input.version = version
  if (version >= 14) return input
  delete site.searchIndexing
  if (version >= 13) return input
  for (const flash of input.flashes as ReturnType<typeof flashNote>[])
    for (const comment of flash.comments) delete (comment as Partial<typeof comment>).status
  if (version >= 12) return input
  for (const key of V12_SITE_KEYS) delete site[key]
  if (version >= 11) return input
  delete input.subscriptions
  if (version < 10) delete input.prompts
  if (version < 9) delete input.omittedRelations
  if (version < 8) delete site.about
  if (version < 6) {
    delete input.links
    delete input.linkSettings
  }
  if (version < 5) delete input.projects
  if (version < 4) {
    delete input.gallery
    delete input.gallerySettings
  }
  if (version < 3) delete input.guestbook
  if (version < 2) delete input.moments
  delete site.presenceLabel
  delete site.presenceSignature
  delete site.presenceStatus
  delete site.launchedAt
  return input
}

const parse = (value: unknown) => parseContentPackage(Buffer.from(JSON.stringify(value)))

describe('内容包版本门禁', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('v%i 拒绝站点 v11 专属字段', async (version) => {
    const input = legacy(version)
    ;(input.site as Record<string, unknown>).presenceLabel = '在线'
    await expect(parse(input)).rejects.toThrow('内容包字段不合法')
  })

  it.each([3, 4, 5, 6, 7, 8, 9, 10])('v%i 拒绝留言 v11 专属字段', async (version) => {
    const input = legacy(version)
    ;(input.guestbook as Record<string, unknown>[])[0]!.browser = 'Chrome 121'
    await expect(parse(input)).rejects.toThrow('内容包字段不合法')
  })

  it('v10 不带 v11 字段仍可导入', async () => {
    const parsed = await parse(legacy(10))
    expect(parsed.version).toBe(14)
    expect(parsed.site.presenceLabel).toBeUndefined()
    expect(parsed.guestbook[0]?.browser).toBeUndefined()
  })

  it('v11 及以后仍接受这些字段', async () => {
    const input = legacy(11)
    ;(input.guestbook as Record<string, unknown>[])[0]!.browser = 'Chrome 121'
    const parsed = await parse(input)
    expect(parsed.site).toMatchObject({ presenceLabel: '在线', presenceStatus: 'online', launchedAt: '2020-01-01' })
    expect(parsed.guestbook[0]?.browser).toBe('Chrome 121')
  })
})

describe('内容包 v12 站点导航与页脚门禁', () => {
  const versions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  it.each(versions.flatMap((version) => V12_SITE_KEYS.map((key) => [version, key] as const)))(
    'v%i 拒绝 v12 站点字段 %s',
    async (version, key) => {
      const input = legacy(version)
      ;(input.site as Record<string, unknown>)[key] = v12Site()[key as keyof ReturnType<typeof v12Site>]
      await expect(parse(input)).rejects.toThrow('内容包字段不合法')
    },
  )

  it('v11 不带 v12 字段仍可导入，新字段留空由目标站沿用现值', async () => {
    const parsed = await parse(legacy(11))
    expect(parsed.version).toBe(14)
    expect(parsed.site.navigation).toBeUndefined()
    expect(parsed.site.quotes).toBeUndefined()
    expect(parsed.subscriptions).toEqual([])
  })

  it('v12 接受并规范化这些字段，缺失的内置模块按显示追加', async () => {
    const parsed = await parse(base())
    expect(parsed.site.navigation).toHaveLength(12)
    expect(parsed.site.navigation?.[1]).toEqual({ type: 'route', key: 'subscriptions', visible: false })
    expect(parsed.site.navigation?.[2]).toMatchObject({ type: 'external', url: 'https://old.example.com/' })
    expect(parsed.site.navigation?.at(-1)).toEqual({ type: 'route', key: 'tabs', visible: true })
    expect(parsed.site).toMatchObject({
      quotes: ['一句话'],
      icpNumber: '京ICP备00000000号',
      copyright: '© {year} 山间札记',
    })
  })

  it.each([
    ['首页隐藏', { navigation: [{ type: 'route', key: 'home', visible: false }] }],
    ['未知模块', { navigation: [{ type: 'route', key: 'admin', visible: true }] }],
    [
      '重复模块',
      {
        navigation: [
          { type: 'route', key: 'home', visible: true },
          { type: 'route', key: 'home', visible: true },
        ],
      },
    ],
    [
      '外链脚本协议',
      { navigation: [{ type: 'external', label: 'x', url: 'javascript:alert(1)', newTab: false, visible: true }] },
    ],
    ['内置项夹带地址', { navigation: [{ type: 'route', key: 'home', url: 'https://a.example', visible: true }] }],
    ['页脚协议相对地址', { footerLinks: [{ label: 'x', url: '//evil.example', newTab: false }] }],
    ['页脚未知字段', { footerLinks: [{ label: 'x', url: '/about', newTab: false, icon: 'lucide:link' }] }],
    ['重复一言', { quotes: ['同一句', '同一句'] }],
    ['空白一言', { quotes: ['  '] }],
    ['备案链接非 http', { icpUrl: 'ftp://beian.example' }],
    ['版权换行', { copyright: '第一行\n第二行' }],
  ])('v12 拒绝非法值：%s', async (_name, patch) => {
    const input = base()
    Object.assign(input.site, patch)
    await expect(parse(input)).rejects.toThrow('内容包字段不合法')
  })
})

describe('内容包 v13 闪念评论审核状态门禁', () => {
  const versions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  it.each(versions)('v%i 拒绝夹带闪念评论 status', async (version) => {
    const input = legacy(version)
    ;(input.flashes as ReturnType<typeof flashNote>[])[0]!.comments[0]!.status = 'published'
    await expect(parse(input)).rejects.toThrow('内容包字段不合法')
  })

  it.each(versions)('v%i 不带 status 仍可导入，闪念评论按已发布处理', async (version) => {
    const parsed = await parse(legacy(version))
    expect(parsed.version).toBe(14)
    expect(parsed.flashes[0]?.comments).toEqual([
      { author: '小林', avatar: '', content: '待审的评论', status: 'published', createdAt: '2026-10-10T09:00:00.000Z' },
    ])
  })

  it('v13 保留闪念评论的审核状态', async () => {
    const parsed = await parse(base())
    expect(parsed.flashes[0]?.comments[0]?.status).toBe('pending')
  })

  it.each([undefined, 'spam', 'deleted', '', null])('v13 拒绝缺失或非法的闪念评论状态：%j', async (status) => {
    const input = base()
    const comment = input.flashes[0]!.comments[0]! as Record<string, unknown>
    if (status === undefined) delete comment.status
    else comment.status = status
    await expect(parse(input)).rejects.toThrow('内容包字段不合法')
  })
})

describe('内容包 v14 搜索引擎收录开关门禁', () => {
  const versions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  it.each(versions)('v%i 拒绝夹带收录开关', async (version) => {
    const input = legacy(version)
    ;(input.site as Record<string, unknown>).searchIndexing = false
    await expect(parse(input)).rejects.toThrow('内容包字段不合法')
  })

  it.each(versions)('v%i 不带收录开关仍可导入，字段保持缺省以沿用目标站现值', async (version) => {
    const parsed = await parse(legacy(version))
    expect(parsed.version).toBe(14)
    expect(parsed.site.searchIndexing).toBeUndefined()
  })

  it('v14 保留博主关闭的收录开关', async () => {
    expect((await parse(base())).site.searchIndexing).toBe(false)
  })

  it('v14 缺省收录开关时字段保持缺省，迁入设置沿用目标站现值', async () => {
    const input = base()
    delete (input.site as Record<string, unknown>).searchIndexing
    expect((await parse(input)).site.searchIndexing).toBeUndefined()
  })

  it.each(['false', 0, null, 'no'])('v14 拒绝非布尔的收录开关：%j', async (value) => {
    const input = base()
    ;(input.site as Record<string, unknown>).searchIndexing = value
    await expect(parse(input)).rejects.toThrow('内容包字段不合法')
  })
})
