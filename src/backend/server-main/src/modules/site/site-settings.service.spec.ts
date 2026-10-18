/** @file site-settings.service.spec.ts @description 站点资料保存：新字段缺省沿用当前值、校验失败不写入、读取与历史补齐缺省值 */
import 'reflect-metadata'
import { BadRequestException } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import { SiteSettings, SiteSettingsRevision } from '../../entities/site-settings.entity'
import type { SiteSettingsValues } from '../../entities/site-settings.entity'
import { SiteSettingsService } from './site-settings.service'
import type { SaveSiteSettingsDto } from './site-settings.dto'

jest.mock('../media/media-references', () => ({
  lockMedia: jest.fn(),
  synchronizeMediaReferences: jest.fn(),
}))

const base: SiteSettingsValues = {
  name: '山间札记',
  description: '',
  ownerName: '博主',
  ownerTitle: '',
  avatar: '/avatar.svg',
  avatarAlt: '',
  seoTitle: '',
  seoDescription: '',
  announcement: '',
  announcementUpdatedAt: '',
  socials: [],
}

function setup(values: SiteSettingsValues) {
  const settings = Object.assign(new SiteSettings(), { id: 'default', revision: 2, values, updatedAt: new Date() })
  const created: { entity: unknown; data: { values: SiteSettingsValues } }[] = []
  const em: Record<string, jest.Mock> = {
    findOneOrFail: jest.fn(async () => settings),
    findOne: jest.fn(async (entity: unknown) =>
      entity === SiteSettingsRevision ? { revision: 1, values: base, createdAt: new Date(), reason: '旧版' } : null,
    ),
    create: jest.fn((entity: unknown, data: { values: SiteSettingsValues }) => created.push({ entity, data })),
    flush: jest.fn(),
    transactional: jest.fn(async (work: (manager: unknown) => unknown): Promise<unknown> => work(em)),
  }
  return { service: new SiteSettingsService(em as unknown as EntityManager), settings, created, em }
}
const input = (patch: Partial<SaveSiteSettingsDto> = {}): SaveSiteSettingsDto =>
  ({ ...base, revision: 2, ...patch }) as SaveSiteSettingsDto

describe('站点资料导航与页脚字段', () => {
  it('读取旧记录时补齐与此前写死效果一致的缺省值', async () => {
    const { service } = setup({ ...base })
    const value = await service.get(true)
    expect(value.navigation).toHaveLength(11)
    expect(value.footerLinks.map((link) => link.label)).toEqual(['关于本站', 'RSS 订阅', '站点地图'])
    expect(value.quotes).toHaveLength(5)
    expect(value.icpNumber).toBe('')
  })

  it('旧客户端不提交新字段时沿用当前值，不当作清空', async () => {
    const { service, settings } = setup({
      ...base,
      quotes: ['已有一言'],
      icpNumber: '京ICP备1号',
      footerLinks: [],
      navigation: [{ type: 'route', key: 'home', visible: true }],
    })
    const saved = await service.save(input({ name: '新名称' }))
    expect(saved.name).toBe('新名称')
    expect(saved.quotes).toEqual(['已有一言'])
    expect(saved.icpNumber).toBe('京ICP备1号')
    expect(saved.footerLinks).toEqual([])
    expect(settings.values.navigation).toHaveLength(11)
    expect(settings.revision).toBe(3)
  })

  it('提交的新字段规范化后写入当前值与历史', async () => {
    const { service, settings, created } = setup({ ...base })
    await service.save(
      input({
        navigation: [
          { type: 'route', key: 'home', visible: true },
          { type: 'route', key: 'subscriptions', visible: false },
        ],
        quotes: [' 新一言 '],
        copyright: '版权所有',
      }),
    )
    expect(settings.values.navigation?.[1]).toEqual({ type: 'route', key: 'subscriptions', visible: false })
    expect(settings.values.quotes).toEqual(['新一言'])
    expect(settings.values.copyright).toBe('版权所有')
    expect(created[0]?.data.values).toBe(settings.values)
  })

  it('语义校验失败时返回 400 且不进入事务', async () => {
    const { service, em, settings } = setup({ ...base })
    await expect(service.save(input({ navigation: [{ type: 'route', key: 'home', visible: false }] }))).rejects.toThrow(
      BadRequestException,
    )
    await expect(service.save(input({ quotes: ['重复', '重复'] }))).rejects.toThrow('每日一言不能重复')
    expect(em.transactional).not.toHaveBeenCalled()
    expect(settings.revision).toBe(2)
  })

  it('历史版本缺失新字段时按缺省值展示', async () => {
    const { service } = setup({ ...base })
    const value = await service.historical(1)
    expect(value.navigation).toHaveLength(11)
    expect(value.quotes).toHaveLength(5)
  })
})
