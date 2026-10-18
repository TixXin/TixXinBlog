/** @file site-public-response.spec.ts @description 公开站点资料与嵌套关于资料的 JSON 字段白名单 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import { SiteSettings } from '../../entities/site-settings.entity'
import { SiteSettingsService } from './site-settings.service'

const publicValues = {
  name: '山间笔记',
  description: '记录日常与技术',
  ownerName: '小林',
  ownerTitle: '开发者',
  avatar: '/avatar.svg',
  avatarAlt: '博主头像',
  seoTitle: '山间笔记',
  seoDescription: '技术实践',
  announcement: '欢迎来访',
  announcementUpdatedAt: '2026-10-01T00:00:00.000Z',
  // 博主主动公开的联系邮箱属于社交链接，不等同于访客私有邮箱。
  socials: [{ label: '联系', href: 'mailto:hello@example.test', icon: 'lucide:mail' }],
  presenceLabel: '记录中',
  presenceSignature: '今天也有新发现',
  presenceStatus: 'idle' as const,
  launchedAt: '2026-01-01',
}
const publicAbout = {
  visible: true,
  introduction: '分享可以公开的经历',
  sections: [
    {
      kind: 'skill' as const,
      visible: true,
      items: [{ title: 'TypeScript', detail: '日常实践', period: '2026', visible: true }],
    },
  ],
}

function fixture() {
  const settings: SiteSettings = Object.assign(new SiteSettings(), {
    id: 'default',
    revision: 17,
    updatedAt: new Date('2026-10-02T00:00:00.000Z'),
    values: {
      ...structuredClone(publicValues),
      about: {
        ...structuredClone(publicAbout),
        sections: [
          {
            ...structuredClone(publicAbout.sections[0]!),
            items: [
              ...structuredClone(publicAbout.sections[0]!.items),
              { title: '私人经历', detail: 'private@example.test', period: '未公开日期', visible: false },
              { title: '  ', detail: '空标题的私密内容', period: '', visible: true },
            ],
          },
          {
            kind: 'experience' as const,
            visible: false,
            items: [{ title: '隐藏栏目', detail: '内部说明', period: '', visible: true }],
          },
          { kind: 'reading' as const, visible: true, items: [] },
        ],
      },
    },
    reason: '内部修订原因',
    visitorHash: 'private-visitor-hash',
    ip: '192.0.2.48',
    email: 'private@example.test',
  })
  const em = { findOneOrFail: jest.fn().mockResolvedValue(settings) }
  return { settings, em, service: new SiteSettingsService(em as unknown as EntityManager) }
}

describe('GET /site 公开响应白名单', () => {
  it('仅返回公开资料及显示时间，排除管理版本、身份和隐藏的嵌套个人资料', async () => {
    const { settings, em, service } = fixture()
    const before = JSON.stringify(settings)
    expect(JSON.parse(JSON.stringify(await service.get(true)))).toStrictEqual({
      ...publicValues,
      about: publicAbout,
      updatedAt: '2026-10-02T00:00:00.000Z',
    })
    expect(em.findOneOrFail).toHaveBeenCalledWith(SiteSettings, { id: 'default' }, { refresh: true })
    expect(JSON.stringify(settings)).toBe(before)
  })

  it.each(['隐藏', '旧记录缺省'] as const)('%s的关于资料不得包含正文，历史可选字段补空串', async (scenario) => {
    const { settings, service } = fixture()
    if (scenario === '隐藏') settings.values.about!.visible = false
    else delete settings.values.about
    delete settings.values.presenceLabel
    delete settings.values.presenceSignature
    delete settings.values.presenceStatus
    delete settings.values.launchedAt
    expect(JSON.parse(JSON.stringify(await service.get(true)))).toStrictEqual({
      ...publicValues,
      about: { visible: false, introduction: '', sections: [] },
      presenceLabel: '',
      presenceSignature: '',
      presenceStatus: '',
      launchedAt: '',
      updatedAt: '2026-10-02T00:00:00.000Z',
    })
  })

  it('管理读取仍保留编辑版本与隐藏资料，公开读取不破坏后台数据', async () => {
    const { settings, service } = fixture()
    await service.get(true)
    expect(JSON.parse(JSON.stringify(await service.get()))).toStrictEqual({
      ...settings.values,
      revision: 17,
      updatedAt: '2026-10-02T00:00:00.000Z',
    })
  })
})
