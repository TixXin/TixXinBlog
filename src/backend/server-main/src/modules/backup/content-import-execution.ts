/**
 * @file content-import-execution.ts
 * @description 迁入执行流水线、领域编排与失败后的媒体补偿清理。
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { BadRequestException, HttpException, ServiceUnavailableException } from '@nestjs/common'
import { ContentImport } from '../../entities/content-import.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import type { ContentImportPlan, ContentImportResult } from '../../entities/content-import.entity'
import type { ContentPackage } from './content-package'
import type { MediaStorage } from '../media/media-storage'
import { lockMedia } from '../media/media-references'
import type { AdminPostService } from '../post/admin-post.service'
import type { AdminFlashService } from '../flash/admin-flash.service'
import type { SiteSettingsService } from '../site/site-settings.service'
import type { CommentModerationService } from '../comment/comment-moderation.service'
import { msg, zh, type ApiLocale } from '../../common/i18n'
import { formatImportJobDto } from './content-import-dto'
import { importMediaAssets, importTaxonomies } from './content-import-media'
import { importPosts } from './content-import-posts'
import { importFlashes } from './content-import-flashes'
import { importMoments } from './content-import-moments'
import { importGuestbook } from './content-import-guestbook'
import { importGallery } from './content-import-gallery'
import { importProjects } from './content-import-projects'
import { importContentRelations } from './content-import-relations'
import { importLinks } from './content-import-links'
import { importPrompts } from './content-import-prompts'
import { importSubscriptions } from './content-import-subscriptions'
import { importSiteAndPolicySettings } from './content-import-settings'

export function assertUploadFileValid(file: { buffer: Buffer; originalname: string } | undefined): void {
  if (
    !file?.buffer?.length ||
    !file.originalname.toLowerCase().endsWith('.json') ||
    /[\\/]/.test(file.originalname) ||
    [...file.originalname].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    throw new BadRequestException(msg('backup.invalidPackageFile'))
}

export async function applyImportPayload(params: {
  em: EntityManager
  storage: MediaStorage
  posts: AdminPostService
  flashes: AdminFlashService
  sites: SiteSettingsService
  comments: CommentModerationService
  current: ContentImportPlan
  payload: ContentPackage
  written: string[]
  includeSettings: boolean
}): Promise<ContentImportResult> {
  const { em, storage, posts, flashes, sites, comments, current, payload, written, includeSettings } = params
  const result: ContentImportResult = {
    posts: [],
    flashes: [],
    moments: [],
    guestbook: [],
    gallery: [],
    projects: [],
    links: [],
    prompts: [],
    subscriptions: [],
    comments: 0,
    media: 0,
    files: 0,
    settings: false,
  }
  await importMediaAssets(em, storage, current, payload, written, result)
  await importTaxonomies(em, payload)
  await importPosts(em, posts, current, payload, result)
  await importFlashes(em, flashes, current, payload, result)
  await importMoments(em, payload, current, result)
  await importGuestbook(em, payload, current, result)
  await importGallery(em, payload, current, result)
  await importProjects(em, payload, current, result)
  await importContentRelations(em, payload, current, result)
  await importLinks(em, payload, current, result)
  await importPrompts(em, payload, current, result)
  await importSubscriptions(em, payload, current, result)
  if (includeSettings) {
    await importSiteAndPolicySettings(em, sites, comments, current, payload, result)
  }
  return result
}

export async function handleImportFailure(params: {
  em: EntityManager
  storage: MediaStorage
  id: string
  actorId: string
  written: string[]
  error: unknown
  locale: ApiLocale
}): Promise<ReturnType<typeof formatImportJobDto>> {
  const { em, storage, id, actorId, written, error, locale } = params
  try {
    const job = await em.fork().findOne(ContentImport, { id, actorId })
    if (job?.completedAt) return formatImportJobDto(job, locale)
    for (const key of written)
      await em
        .fork()
        .transactional(async (tx) => {
          await lockMedia(tx)
          if (!(await tx.findOne(MediaAsset, { id: key.slice(0, -5) }))) await storage.remove(key)
        })
        .catch(() => undefined)
    await em.fork().nativeUpdate(
      ContentImport,
      { id, completedAt: null },
      {
        startedAt: null,
        // 异常 message 是字典中文渲染结果，持久化后可在 dto() 中反查翻译。
        lastError: error instanceof HttpException ? error.message : zh('backup.importRolledBack'),
      },
    )
  } catch {
    throw new ServiceUnavailableException(msg('backup.importResultUnknown'))
  }
  if (error instanceof HttpException) throw error
  throw new ServiceUnavailableException(msg('backup.importRolledBack'))
}
