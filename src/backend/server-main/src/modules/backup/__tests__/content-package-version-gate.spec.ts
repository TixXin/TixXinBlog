/**
 * @file content-package-version-gate.spec.ts
 * @description 内容包版本门禁回归：v11 专属字段不能被 v1–v10 旧包夹带
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

const base = () => ({
  format: 'tixxin-content',
  version: 11,
  omittedRelations: 0,
  exportedAt: '2026-10-16T12:00:00.000Z',
  mediaIncluded: false,
  posts: [],
  flashes: [],
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
  },
})

/** 构造指定旧版本的合法包：删除该版本不支持的字段，保留基础内容。 */
function legacy(version: number) {
  const input = base() as unknown as Record<string, unknown>
  const site = input.site as Record<string, unknown>
  input.version = version
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
    expect(parsed.version).toBe(11)
    expect(parsed.site.presenceLabel).toBeUndefined()
    expect(parsed.guestbook[0]?.browser).toBeUndefined()
  })

  it('v11 仍接受这些字段', async () => {
    const input = base() as unknown as Record<string, unknown>
    ;(input.guestbook as Record<string, unknown>[])[0]!.browser = 'Chrome 121'
    const parsed = await parse(input)
    expect(parsed.site).toMatchObject({ presenceLabel: '在线', presenceStatus: 'online', launchedAt: '2020-01-01' })
    expect(parsed.guestbook[0]?.browser).toBe('Chrome 121')
  })
})
