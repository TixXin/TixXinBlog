/** @file link.test.ts @description 友链查询、编辑恢复与本站资料来源，不擅自改写路径或复制回退配置 */
import { describe, expect, it } from 'vitest'
import { linkQuery } from '../../app/features/link/query'
import { linkForm, parseLinkRecovery } from '../../app/features/link/editor'
import { linkSiteInfo, siteInfoText } from '../../app/features/link/siteInfo'
import { defaultSiteSettings } from '../../app/features/site/settings'
describe('友链字段和本站资料', () => {
  it('推荐条件区分全部和false，并规范分页', () => {
    expect(linkQuery({ featured: 'false', q: ' 文档 ', page: '2' })).toEqual({
      featured: 'false',
      q: '文档',
      page: 2,
      pageSize: 12,
    })
    expect(linkQuery({ featured: 'yes', page: '1.5' })).toMatchObject({ featured: undefined, page: 1 })
  })
  it('恢复完整原地址与Logo输入，仅剥离未知字段', () => {
    const url = 'https://example.com/Docs/?a=2&a=1#KeepCase'
    const value = {
      version: 1,
      context: 'old-library',
      id: null,
      revision: null,
      requestId: '12345678-1234-4123-a123-123456789abc',
      savedAt: '2026-09-10',
      pendingCreate: null,
      form: {
        ...linkForm(),
        name: '文档笔记',
        url,
        logoUrl: 'https://example.com/Logo.PNG',
        isFeatured: true,
        extra: '不恢复',
      },
    }
    const parsed = parseLinkRecovery(JSON.stringify(value))!
    expect(parsed.form.url).toBe(url)
    expect(parsed.form.logoUrl).toBe(value.form.logoUrl)
    expect('extra' in parsed.form).toBe(false)
    expect(parseLinkRecovery(JSON.stringify({ ...value, form: { ...value.form, status: 'enabled' } }))).toBeNull()
  })
  it('站点设置不可用时不复制defaults，真实资料和相对头像转绝对地址', () => {
    expect(linkSiteInfo(defaultSiteSettings, false, 'https://example.com')).toBeNull()
    const actual = {
      ...defaultSiteSettings,
      name: '数据库中的站点',
      description: '当前站点说明',
      avatar: '/media/avatar.webp',
    }
    const info = linkSiteInfo(actual, true, 'https://site.example/blog')!
    expect(siteInfoText(info)).toContain('名称：数据库中的站点')
    expect(siteInfoText(info)).toContain('头像：https://site.example/media/avatar.webp')
    expect(siteInfoText(info)).toContain('地址：https://site.example/blog')
    expect(linkSiteInfo(actual, true, 'not-a-url')).toBeNull()
  })
})
