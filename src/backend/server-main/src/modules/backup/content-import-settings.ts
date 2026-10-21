/**
 * @file content-import-settings.ts
 * @description 迁入事务中的站点资料、评论策略、图库器材与友链规则设置应用。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { ConflictException } from '@nestjs/common'
import { GallerySettings } from '../../entities/gallery-settings.entity'
import { LinkSettings } from '../../entities/link-settings.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import type { SiteSettingsService } from '../site/site-settings.service'
import type { CommentModerationService } from '../comment/comment-moderation.service'
import { msg, zh } from '../../common/i18n'

export async function importSiteAndPolicySettings(
  em: EntityManager,
  sites: SiteSettingsService,
  comments: CommentModerationService,
  current: ContentImportPlan,
  payload: ContentPackage,
  result: ContentImportResult,
): Promise<void> {
  await sites.save({ ...payload.site, revision: current.siteRevision }, zh('site.reasonImport'))
  await comments.savePolicy({
    requireApproval: payload.requireCommentApproval,
    revision: current.policyRevision,
  })
  if (payload.gallerySettings) {
    const settings = await em.findOneOrFail(GallerySettings, { id: 'default' }, { refresh: true })
    if (settings.revision !== current.gallerySettingsRevision)
      throw new ConflictException(msg('backup.gallerySettingsChanged'))
    settings.gear = payload.gallerySettings.gear
    settings.revision += 1
    settings.updatedAt = new Date()
  }
  if (payload.linkSettings) {
    const settings = await em.findOneOrFail(LinkSettings, { id: 'default' }, { refresh: true })
    if (settings.revision !== current.linkSettingsRevision)
      throw new ConflictException(msg('backup.linkSettingsChanged'))
    settings.rules = payload.linkSettings.rules
    settings.revision += 1
    settings.updatedAt = new Date()
  }
  result.settings = true
}
