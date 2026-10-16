/** @file profile-package.spec.ts @description 站点资料的在线状态/签名/上线日期与留言的浏览器/地区在内容包中可选携带、往返保留，旧包缺省兼容。 */
import 'reflect-metadata'
import { parseContentPackage } from '../content-package'
const bundle = () => ({
  format: 'tixxin-content',
  version: 11,
  omittedRelations: 0,
  exportedAt: '2026-10-16T12:00:00.000Z',
  mediaIncluded: false,
  posts: [],
  flashes: [],
  moments: [],
  guestbook: [
    {
      sourceId: 1,
      createdAt: '2026-10-10T08:00:00.000Z',
      deleted: false,
      author: 'Luna',
      avatar: '',
      content: '友链页做得好精致，已经提交申请了。',
      isOwner: false,
      status: 'published',
      isPinned: false,
      replyToId: null,
      browser: 'Chrome 121',
      region: '广东深圳',
    },
    {
      sourceId: 2,
      createdAt: '2026-10-11T08:00:00.000Z',
      deleted: false,
      author: 'tixxin',
      avatar: '',
      content: '谢谢，已通过。',
      isOwner: true,
      status: 'published',
      isPinned: false,
      replyToId: 1,
    },
  ],
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
    name: 'TixXin Blog',
    description: '',
    ownerName: 'TixXin',
    ownerTitle: '前端开发工程师',
    avatar: '',
    avatarAlt: '',
    seoTitle: '',
    seoDescription: '',
    announcement: '',
    socials: [],
    about: { visible: false, introduction: '', sections: [] },
    presenceLabel: '摆烂中',
    presenceSignature: '今天不想写代码',
    launchedAt: '2021-08-16',
    presenceStatus: 'idle',
  },
})
const parse = (value: unknown) => parseContentPackage(Buffer.from(JSON.stringify(value)))
describe('站点资料与留言来源字段', () => {
  it('新包往返保留在线状态、签名、上线日期与留言来源', async () => {
    const parsed = await parse(bundle())
    expect(parsed.site).toMatchObject({
      presenceLabel: '摆烂中',
      presenceSignature: '今天不想写代码',
      launchedAt: '2021-08-16',
      presenceStatus: 'idle',
    })
    expect(parsed.guestbook[0]).toMatchObject({ browser: 'Chrome 121', region: '广东深圳' })
    expect(parsed.guestbook[1]).not.toHaveProperty('browser')
  })
  it('旧包缺省这些字段仍可导入', async () => {
    const input = bundle()
    const { presenceLabel, presenceSignature, launchedAt, presenceStatus, ...site } = input.site
    void presenceStatus
    void presenceLabel
    void presenceSignature
    void launchedAt
    const parsed = await parse({
      ...input,
      site,
      guestbook: input.guestbook.map(({ browser: _browser, region: _region, ...rest }) => rest),
    })
    expect(parsed.site.presenceLabel).toBeUndefined()
    expect(parsed.site.launchedAt).toBeUndefined()
    expect(parsed.guestbook[0]?.region).toBeUndefined()
  })
  it('上线日期格式与来源文案长度受校验', async () => {
    await expect(parse({ ...bundle(), site: { ...bundle().site, launchedAt: '2021/08/16' } })).rejects.toThrow()
    await expect(parse({ ...bundle(), site: { ...bundle().site, presenceStatus: 'away' } })).rejects.toThrow()
    const long = bundle()
    long.guestbook[0]!.region = '地'.repeat(41)
    await expect(parse(long)).rejects.toThrow()
  })
})
