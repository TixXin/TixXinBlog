/**
 * @file site-settings.service.ts
 * @description 站点资料保存与恢复产生新版本，媒体引用覆盖当前值及历史配置。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { SiteSettings, SiteSettingsRevision } from '../../entities/site-settings.entity'
import type { SiteSettingsValues } from '../../entities/site-settings.entity'
import type { SaveSiteSettingsDto } from './site-settings.dto'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'
import { ContentContext } from '../../entities/content-context.entity'
@Injectable()
export class SiteSettingsService {
  constructor(private readonly em: EntityManager) {}
  async context() {
    return this.em.findOneOrFail(ContentContext, { id: 'default' }, { refresh: true })
  }
  async get() {
    const settings = await this.em.findOneOrFail(SiteSettings, { id: 'default' }, { refresh: true })
    return { ...settings.values, revision: settings.revision, updatedAt: settings.updatedAt.toISOString() }
  }
  private validateUrls(input: Pick<SiteSettingsValues, 'avatar' | 'socials'>) {
    const http = (value: string) => {
      try {
        const url = new URL(value)
        return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      } catch {
        return false
      }
    }
    if (input.avatar && !/^\/(?!\/)[^\\\s]*$/.test(input.avatar) && !http(input.avatar))
      throw new BadRequestException('头像需要 HTTP(S) 地址或站内图片路径')
    for (const link of input.socials) {
      if (!http(link.href) && !/^mailto:[^\s?@]+@[^\s?@]+\.[^\s?@]+$/.test(link.href))
        throw new BadRequestException('社交链接仅支持 HTTP(S) 或 mailto 邮箱')
    }
  }
  async save(input: SaveSiteSettingsDto, reason = '更新站点资料') {
    this.validateUrls(input)
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const settings = await em.findOneOrFail(
        SiteSettings,
        { id: 'default' },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      if (settings.revision !== input.revision)
        throw new ConflictException('站点资料已更新，请读取最新版本并比较；当前输入未保存')
      const values = {
        name: input.name,
        description: input.description,
        ownerName: input.ownerName,
        ownerTitle: input.ownerTitle,
        avatar: input.avatar,
        avatarAlt: input.avatarAlt,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        announcement: input.announcement,
        socials: input.socials,
      }
      const now = new Date()
      settings.values = {
        ...values,
        announcementUpdatedAt:
          values.announcement === settings.values.announcement
            ? settings.values.announcementUpdatedAt
            : now.toISOString(),
      }
      settings.revision += 1
      settings.updatedAt = now
      em.create(SiteSettingsRevision, { revision: settings.revision, values: settings.values, reason, createdAt: now })
      await synchronizeMediaReferences(em, 'site:default', 'site', [settings.values.avatar], {})
      await synchronizeMediaReferences(
        em,
        `site-revision:${settings.revision}`,
        'site-revision',
        [settings.values.avatar],
        { revision: settings.revision },
      )
      await em.flush()
      return { ...settings.values, revision: settings.revision, updatedAt: now.toISOString() }
    })
  }
  async history(page: number) {
    const [items, total] = await this.em.findAndCount(
      SiteSettingsRevision,
      {},
      {
        fields: ['revision', 'reason', 'createdAt'],
        orderBy: { revision: 'desc' },
        offset: (page - 1) * 20,
        limit: 20,
      },
    )
    return {
      items: items.map((item) => ({
        revision: item.revision,
        reason: item.reason,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize: 20,
    }
  }
  async historical(revision: number) {
    const history = await this.em.findOne(SiteSettingsRevision, { revision })
    if (!history) throw new NotFoundException('站点历史版本不存在')
    return { ...history.values, revision: history.revision, updatedAt: history.createdAt.toISOString() }
  }
  async restore(historical: number, current: number) {
    const previous = await this.historical(historical)
    return this.save({ ...previous, revision: current }, `恢复站点版本 ${historical}`)
  }
}
