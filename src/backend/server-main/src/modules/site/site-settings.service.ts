/**
 * @file site-settings.service.ts
 * @description 站点资料保存与恢复产生新版本，媒体引用覆盖当前值及历史配置。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { msg, translateStored, zh, type ApiLocale } from '../../common/i18n'
import { LockMode } from '@mikro-orm/core'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { SiteSettings, SiteSettingsRevision } from '../../entities/site-settings.entity'
import type { SiteSettingsValues } from '../../entities/site-settings.entity'
import type { SaveSiteSettingsDto } from './site-settings.dto'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'
import { ContentContext } from '../../entities/content-context.entity'
import { emptyAbout, publicAbout } from './about-settings'
import {
  normalizeSiteExtrasInput,
  publicSiteNavigation,
  SiteExtrasError,
  withSiteExtrasDefaults,
} from './site-navigation'
/** 后加字段在历史记录中可能缺失，读取时统一补空串；导航与页脚等按缺省值补齐 */
export function withPresenceDefaults(values: SiteSettingsValues) {
  return withSiteExtrasDefaults({
    ...values,
    presenceLabel: values.presenceLabel ?? '',
    presenceSignature: values.presenceSignature ?? '',
    launchedAt: values.launchedAt ?? '',
    presenceStatus: values.presenceStatus ?? '',
    // 旧记录与旧内容包没有收录开关，等同于此前一直允许搜索引擎收录
    searchIndexing: values.searchIndexing ?? true,
  })
}
/** 校验导航、页脚、每日一言与备案字段；内容包解析与后台保存共用同一规则 */
export function validateSiteExtras(input: Parameters<typeof normalizeSiteExtrasInput>[0]) {
  try {
    return normalizeSiteExtrasInput(input)
  } catch (error) {
    if (error instanceof SiteExtrasError) throw new BadRequestException(error.localized)
    throw error
  }
}
@Injectable()
export class SiteSettingsService {
  constructor(private readonly em: EntityManager) {}
  async context() {
    return this.em.findOneOrFail(ContentContext, { id: 'default' }, { refresh: true })
  }
  async get(publicView = false) {
    const settings = await this.em.findOneOrFail(SiteSettings, { id: 'default' }, { refresh: true })
    const values = withPresenceDefaults(settings.values)
    return {
      ...values,
      ...(publicView ? { navigation: publicSiteNavigation(values.navigation) } : {}),
      about: publicView ? publicAbout(settings.values.about) : (settings.values.about ?? emptyAbout()),
      ...(publicView ? {} : { revision: settings.revision }),
      updatedAt: settings.updatedAt.toISOString(),
    }
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
      throw new BadRequestException(msg('site.avatarUrlInvalid'))
    for (const link of input.socials) {
      if (!http(link.href) && !/^mailto:[^\s?@]+@[^\s?@]+\.[^\s?@]+$/.test(link.href))
        throw new BadRequestException(msg('site.socialLinkInvalid'))
    }
  }
  async save(input: SaveSiteSettingsDto, reason = zh('site.reasonUpdate')) {
    this.validateUrls(input)
    const extras = validateSiteExtras(input)
    if (
      input.about &&
      new Set(input.about.sections.map((section) => section.kind)).size !== input.about.sections.length
    )
      throw new BadRequestException(msg('site.aboutSectionDuplicate'))
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      const settings = await em.findOneOrFail(
        SiteSettings,
        { id: 'default' },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      if (settings.revision !== input.revision) throw new ConflictException(msg('site.revisionConflict'))
      const current = withSiteExtrasDefaults(settings.values)
      const values = {
        about: input.about ?? settings.values.about ?? emptyAbout(),
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
        // 未提交的后加字段沿用当前值，不把旧客户端的缺省当作清空
        presenceLabel: input.presenceLabel ?? settings.values.presenceLabel ?? '',
        presenceSignature: input.presenceSignature ?? settings.values.presenceSignature ?? '',
        launchedAt: input.launchedAt ?? settings.values.launchedAt ?? '',
        presenceStatus: input.presenceStatus ?? settings.values.presenceStatus ?? '',
        searchIndexing: input.searchIndexing ?? settings.values.searchIndexing ?? true,
        navigation: extras.navigation ?? current.navigation,
        footerLinks: extras.footerLinks ?? current.footerLinks,
        quotes: extras.quotes ?? current.quotes,
        icpNumber: extras.icpNumber ?? current.icpNumber,
        icpUrl: extras.icpUrl ?? current.icpUrl,
        copyright: extras.copyright ?? current.copyright,
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
  async history(page: number, locale: ApiLocale = 'zh-CN') {
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
        reason: translateStored(locale, item.reason),
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize: 20,
    }
  }
  async historical(revision: number) {
    const history = await this.em.findOne(SiteSettingsRevision, { revision })
    if (!history) throw new NotFoundException(msg('site.historyNotFound'))
    return {
      ...withPresenceDefaults(history.values),
      about: history.values.about ?? emptyAbout(),
      revision: history.revision,
      updatedAt: history.createdAt.toISOString(),
    }
  }
  async restore(historical: number, current: number) {
    const previous = await this.historical(historical)
    return this.save({ ...previous, revision: current }, zh('site.reasonRestore', { revision: historical }))
  }
}
