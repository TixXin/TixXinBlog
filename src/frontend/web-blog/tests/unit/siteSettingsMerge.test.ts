/** @file siteSettingsMerge.test.ts @description 站点资料冲突合并保留独立配置，并识别同字段竞争 */
import { describe, expect, it } from 'vitest'
import { defaultSiteSettings } from '../../app/features/site/settings'
import { mergeSiteSettings, parseSiteSettingsRecovery } from '../../app/features/site/editor'
import { emptyAbout, publicAbout } from '../../app/features/about/settings'

describe('站点资料三方合并', () => {
  it('关于页编辑不会覆盖另一标签页保存的公告、SEO或联系方式', () => {
    const base = { ...structuredClone(defaultSiteSettings), about: emptyAbout() }
    const local = { ...structuredClone(base), about: { ...emptyAbout(), introduction: '技术笔记' } }
    const server = {
      ...structuredClone(base),
      announcement: '新公告',
      seoTitle: '新标题',
      revision: 3,
      socials: [{ label: '主页', icon: 'lucide:globe', href: 'https://example.test' }],
    }
    const result = mergeSiteSettings(base, local, server)
    expect(result.conflicts).toEqual([])
    expect(result.merged).toEqual({ ...server, about: local.about })
    expect(base.about.introduction).toBe('')
  })
  it('只报告发生竞争的当前编辑字段', () => {
    const base = structuredClone(defaultSiteSettings)
    const result = mergeSiteSettings(
      base,
      { ...base, ownerName: '本页姓名' },
      { ...base, ownerName: '另一页姓名', revision: 2 },
    )
    expect(result.conflicts).toEqual(['ownerName'])
    expect(result.merged.revision).toBe(2)
  })
  it('管理员配置的隐藏正文不会进入前台共享设置', () => {
    expect(publicAbout({ visible: false, introduction: '不公开', sections: [] })).toEqual(emptyAbout())
  })
  it('不同关于栏目及介绍分别保留，不用数组索引拼接同一栏目条目', () => {
    const base = {
      ...structuredClone(defaultSiteSettings),
      about: {
        ...emptyAbout(),
        sections: [
          { kind: 'skill' as const, visible: false, items: [] },
          { kind: 'reading' as const, visible: false, items: [] },
        ],
      },
    }
    const local = structuredClone(base),
      server = structuredClone(base)
    local.about.sections[0]!.visible = true
    server.about.sections[1]!.visible = true
    server.about.introduction = '最新介绍'
    const result = mergeSiteSettings(base, local, server)
    expect(result.conflicts).toEqual([])
    expect(result.merged.about?.sections.map((item) => item.visible)).toEqual([true, true])
    expect(result.merged.about?.introduction).toBe('最新介绍')
    server.about.sections[0]!.items.push({ title: '服务器条目', detail: '', period: '', visible: false } as never)
    expect(mergeSiteSettings(base, local, server).conflicts).toEqual(['about.skill'])
  })
  it('丢失基线或损坏栏目恢复副本拒绝载入，旧副本格式仍兼容', () => {
    const base = structuredClone(defaultSiteSettings)
    expect(
      parseSiteSettingsRecovery(JSON.stringify({ draft: base, baseline: JSON.stringify(base) }))?.draft.about,
    ).toEqual(emptyAbout())
    expect(parseSiteSettingsRecovery(JSON.stringify({ draft: base, baseline: '{}' }))).toBeNull()
    expect(
      parseSiteSettingsRecovery(
        JSON.stringify({
          draft: { ...base, about: { visible: true, introduction: '', sections: [null] } },
          baseline: base,
        }),
      ),
    ).toBeNull()
  })
})
