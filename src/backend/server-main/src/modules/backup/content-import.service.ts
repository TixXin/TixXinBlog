/**
 * @file content-import.service.ts
 * @description 内容迁入以新草稿保留原数据，完整事务回滚，票据重试不重复创建。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { IsolationLevel, LockMode } from '@mikro-orm/core'
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import { ContentImport } from '../../entities/content-import.entity'
import type { ContentImportResult } from '../../entities/content-import.entity'
import { Post } from '../../entities/post.entity'
import { Comment } from '../../entities/comment.entity'
import { FlashNote } from '../../entities/flash-note.entity'
import { FlashComment } from '../../entities/flash-comment.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { PostFolder } from '../../entities/post-folder.entity'
import { PostTag } from '../../entities/post-tag.entity'
import { AdminSession } from '../../entities/admin-session.entity'
import { GallerySettings } from '../../entities/gallery-settings.entity'
import { MediaStorage } from '../media/media-storage'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'
import { lockTaxonomy } from '../post/taxonomy-lock'
import { canonicalTaxonomyLabel } from '../post/taxonomy-aliases'
import { AdminPostService } from '../post/admin-post.service'
import { AdminFlashService } from '../flash/admin-flash.service'
import { SiteSettingsService } from '../site/site-settings.service'
import { CommentModerationService } from '../comment/comment-moderation.service'
import { visibleCommentWhere } from '../comment/comment-visibility'
import { ContentExportService } from './content-export.service'
import { packageHash, parseContentPackage } from './content-package'
import { makeContentPlan, normalizedPost } from './content-import-plan'
import { importMoments } from './content-import-moments'
import { importGuestbook } from './content-import-guestbook'
import { importGallery } from './content-import-gallery'
import { importProjects } from './content-import-projects'
import { lockGuestbook } from '../guestbook/guestbook-write.service'
type Admin = { id: string; sessionVersion: number; sessionId: string }
type Options = { requestId: string; strategy: 'skip' | 'copy'; includeSettings: boolean }
@Injectable()
export class ContentImportService {
  constructor(
    private readonly em: EntityManager,
    private readonly storage: MediaStorage,
    private readonly exporter: ContentExportService,
    private readonly posts: AdminPostService,
    private readonly flashes: AdminFlashService,
    private readonly sites: SiteSettingsService,
    private readonly comments: CommentModerationService,
  ) {}
  private dto(job: ContentImport) {
    const { basis: ignoredBasis, ...plan } = job.plan
    void ignoredBasis
    return {
      ticket: job.id,
      confirmation: packageHash(job.plan),
      settingsPreview: job.includeSettings ? job.payload?.site : undefined,
      gallerySettingsPreview: job.includeSettings ? job.payload?.gallerySettings : undefined,
      strategy: job.strategy,
      includeSettings: job.includeSettings,
      plan,
      createdAt: job.createdAt.toISOString(),
      expiresAt: job.expiresAt.toISOString(),
      started: !!job.startedAt,
      completed: !!job.completedAt,
      expired: !job.completedAt && job.expiresAt <= new Date(),
      result: job.result,
      error: job.lastError,
    }
  }
  private async cleanup() {
    await this.em.execute(
      `with expired as (select id from content_import where expires_at < now() and completed_at is null and payload is not null for update skip locked limit 10) update content_import set payload=null,last_error='预览已过期，请重新选择文件' where id in (select id from expired)`,
    )
  }
  async get(id: string, admin: Admin) {
    await this.cleanup()
    const job = await this.em.findOne(ContentImport, { id, actorId: admin.id }, { refresh: true })
    if (!job) throw new NotFoundException('导入票据不存在')
    return this.dto(job)
  }
  async recent(admin: Admin) {
    await this.cleanup()
    const jobs = await this.em.find(
      ContentImport,
      { actorId: admin.id },
      {
        fields: ['id', 'createdAt', 'expiresAt', 'completedAt', 'startedAt', 'lastError'],
        orderBy: { createdAt: 'desc' },
        limit: 10,
      },
    )
    return jobs.map((job) => ({
      ticket: job.id,
      createdAt: job.createdAt.toISOString(),
      completed: !!job.completedAt,
      expired: !job.completedAt && job.expiresAt <= new Date(),
    }))
  }
  async preview(file: { buffer: Buffer; originalname: string } | undefined, input: Options, admin: Admin) {
    if (
      !file?.buffer?.length ||
      !file.originalname.toLowerCase().endsWith('.json') ||
      /[\\/]/.test(file.originalname) ||
      [...file.originalname].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    )
      throw new BadRequestException('请选择 JSON 内容包，文件名不能包含路径')
    const fileHash = createHash('sha256').update(file.buffer).digest('hex')
    const existing = await this.em.findOne(ContentImport, { id: input.requestId })
    if (existing) {
      if (
        existing.actorId !== admin.id ||
        existing.fileHash !== fileHash ||
        existing.strategy !== input.strategy ||
        existing.includeSettings !== input.includeSettings
      )
        throw new ConflictException('上传标识已经使用，请重新选择文件')
      return this.get(existing.id, admin)
    }
    const payload = await parseContentPackage(file.buffer)
    return this.em.transactional(
      async (em) => {
        await em.execute('select pg_advisory_xact_lock(742915)')
        const duplicate = await em.findOne(ContentImport, { id: input.requestId }, { refresh: true })
        if (duplicate) {
          if (
            duplicate.actorId !== admin.id ||
            duplicate.fileHash !== fileHash ||
            duplicate.strategy !== input.strategy ||
            duplicate.includeSettings !== input.includeSettings
          )
            throw new ConflictException('上传标识冲突')
          return this.dto(duplicate)
        }
        const plan = await makeContentPlan(
          em,
          this.exporter,
          this.storage,
          payload,
          input.strategy,
          input.includeSettings,
          input.requestId,
        )
        const job = em.create(ContentImport, {
          id: input.requestId,
          actorId: admin.id,
          sessionVersion: admin.sessionVersion,
          strategy: input.strategy,
          includeSettings: input.includeSettings,
          fileHash,
          payload,
          plan,
          expiresAt: new Date(Date.now() + 15 * 60000),
        })
        await em.flush()
        return this.dto(job)
      },
      { isolationLevel: IsolationLevel.REPEATABLE_READ },
    )
  }
  async repreview(id: string, admin: Admin) {
    return this.em.transactional(async (em) => {
      const job = await em.findOne(
        ContentImport,
        { id, actorId: admin.id },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      if (!job) throw new NotFoundException('导入票据不存在')
      if (job.completedAt) return this.dto(job)
      if (!job.payload || job.expiresAt <= new Date()) throw new BadRequestException('内容包已过期，请重新选择文件')
      job.plan = await makeContentPlan(
        em,
        this.exporter,
        this.storage,
        job.payload,
        job.strategy,
        job.includeSettings,
        id,
      )
      job.expiresAt = new Date(Date.now() + 15 * 60000)
      job.sessionVersion = admin.sessionVersion
      job.lastError = undefined
      job.startedAt = undefined
      await em.flush()
      return this.dto(job)
    })
  }
  async execute(id: string, acknowledgement: string, confirmation: string, admin: Admin) {
    if (acknowledgement !== '导入为新草稿') throw new BadRequestException('请确认以新草稿迁入内容')
    const initial = await this.em.findOne(ContentImport, { id, actorId: admin.id })
    if (!initial) throw new NotFoundException('导入票据不存在')
    if (initial.completedAt) return this.dto(initial)
    await this.em.nativeUpdate(
      ContentImport,
      { id, actorId: admin.id, completedAt: null },
      { startedAt: new Date(), lastError: null },
    )
    const written: string[] = []
    try {
      return await this.em.transactional(async (em) => {
        await lockTaxonomy(em)
        await lockMedia(em)
        await lockGuestbook(em)
        const job = await em.findOneOrFail(
          ContentImport,
          { id, actorId: admin.id },
          { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
        )
        if (job.completedAt) return this.dto(job)
        if (confirmation !== packageHash(job.plan)) throw new ConflictException('预览已更新，请重新读取后确认')
        if (!job.payload || job.expiresAt <= new Date() || job.sessionVersion !== admin.sessionVersion)
          throw new BadRequestException('预览已失效，请重新预览')
        if (
          !(await em.count(AdminSession, {
            id: admin.sessionId,
            adminUser: admin.id,
            revokedAt: null,
            expiresAt: { $gt: new Date() },
          }))
        )
          throw new ConflictException('会话已经失效，未开始导入')
        const current = await makeContentPlan(
          em,
          this.exporter,
          this.storage,
          job.payload,
          job.strategy,
          job.includeSettings,
          id,
        )
        if (!current.ready) throw new ConflictException(current.errors[0] ?? '媒体或引用条件不满足')
        if (!job.plan.ready || current.basis !== job.plan.basis)
          throw new ConflictException('目标内容或配置已变化，请重新预览后确认')
        const payload = job.payload
        const result: ContentImportResult = {
          posts: [],
          flashes: [],
          moments: [],
          guestbook: [],
          gallery: [],
          projects: [],
          comments: 0,
          media: 0,
          files: 0,
          settings: false,
        }
        try {
          for (const plan of current.media) {
            if (plan.skip) continue
            const source = payload.media.find((asset) => asset.id === plan.id)
            if (!source) continue
            if (plan.writeFile && source.base64) {
              await this.storage.put(`${source.id}.webp`, Buffer.from(source.base64, 'base64'))
              written.push(`${source.id}.webp`)
              result.files += 1
            }
            if (plan.create) {
              em.create(MediaAsset, {
                id: source.id,
                originalName: source.name,
                storageKey: `${source.id}.webp`,
                mimeType: 'image/webp',
                byteSize: source.byteSize,
                width: source.width,
                height: source.height,
                sha256: source.sha256,
                alt: source.alt,
                createdAt: new Date(source.createdAt),
                deletedAt: source.deleted ? new Date() : undefined,
              })
              result.media += 1
            }
          }
          await em.flush()
          for (const folder of payload.folders) {
            const label = await canonicalTaxonomyLabel(em, 'folders', folder)
            if (!(await em.findOne(PostFolder, { label }))) em.create(PostFolder, { label })
          }
          for (const tag of payload.tags) {
            const label = await canonicalTaxonomyLabel(em, 'tags', tag.label)
            if (!(await em.findOne(PostTag, { label })))
              em.create(PostTag, { label, slug: label, color: tag.color, count: 0 })
          }
          await em.flush()
          for (const source of payload.posts) {
            const plan = current.posts.find((post) => post.sourceId === source.sourceId)!
            if (plan.skip) continue
            const saved = await this.posts.save(
              null,
              { ...(await normalizedPost(em, source.values)), slug: plan.slug, status: 'draft' },
              '从内容包迁入草稿',
            )
            const post = await em.findOneOrFail(Post, { id: saved.id })
            post.createdAt = new Date(source.createdAt)
            post.publishedAt = new Date(source.publishedAt)
            const map = new Map<number, Comment>()
            const sourceComments = new Map(source.comments.map((comment) => [comment.sourceId, comment]))
            const depth = (comment: (typeof source.comments)[number]) =>
              comment.parentId === null ? 0 : sourceComments.get(comment.parentId)?.parentId === null ? 1 : 2
            const ordered = [...source.comments].sort((a, b) => depth(a) - depth(b) || a.sourceId - b.sourceId)
            for (const comment of ordered) {
              const parent = comment.parentId === null ? undefined : map.get(comment.parentId)
              const created = em.create(Comment, {
                post,
                parent,
                depth: parent ? parent.depth + 1 : 0,
                authorSnapshot: { name: comment.author, avatar: comment.avatar || '/avatar.svg' },
                content: comment.content,
                isOwner: comment.isOwner,
                status: comment.status,
                likes: 0,
                createdAt: new Date(comment.createdAt),
              })
              map.set(comment.sourceId, created)
              result.comments += 1
            }
            await em.flush()
            for (const comment of map.values())
              await synchronizeMediaReferences(
                em,
                `comment:${comment.id}`,
                'comment',
                [comment.authorSnapshot.avatar],
                { post, comment },
              )
            post.commentCount = await em.count(Comment, { post, ...visibleCommentWhere() })
            await em.flush()
            result.posts.push({ sourceId: source.sourceId, id: post.id })
          }
          for (const source of payload.flashes) {
            if (current.flashes.find((flash) => flash.sourceId === source.sourceId)!.skip) continue
            const saved = await this.flashes.save(null, { ...source.values, isDraft: true, isArchived: false })
            const note = await em.findOneOrFail(FlashNote, { id: saved.id })
            note.createdAt = new Date(source.createdAt)
            for (const comment of source.comments) {
              const created = em.create(FlashComment, {
                flashNote: note,
                authorId: createHash('sha256').update(randomUUID()).digest('hex'),
                authorName: comment.author,
                authorAvatar: comment.avatar || '/avatar.svg',
                content: comment.content,
                createdAt: new Date(comment.createdAt),
              })
              await em.flush()
              await synchronizeMediaReferences(
                em,
                `flash-comment:${created.id}`,
                'flash-comment',
                [created.authorAvatar],
                { flashNote: note, flashComment: created },
              )
              result.comments += 1
            }
            result.flashes.push({ sourceId: source.sourceId, id: saved.id })
          }
          await importMoments(em, payload, current, result)
          await importGuestbook(em, payload, current, result)
          await importGallery(em, payload, current, result)
          await importProjects(em, payload, current, result)
          if (job.includeSettings) {
            await this.sites.save({ ...payload.site, revision: current.siteRevision }, '从内容包迁入站点资料')
            await this.comments.savePolicy({
              requireApproval: payload.requireCommentApproval,
              revision: current.policyRevision,
            })
            if (payload.gallerySettings) {
              const settings = await em.findOneOrFail(GallerySettings, { id: 'default' }, { refresh: true })
              if (settings.revision !== current.gallerySettingsRevision)
                throw new ConflictException('图库器材配置已变化，请重新预览')
              settings.gear = payload.gallerySettings.gear
              settings.revision += 1
              settings.updatedAt = new Date()
            }
            result.settings = true
          }
          job.result = result
          job.completedAt = new Date()
          job.payload = undefined
          job.lastError = undefined
          await em.flush()
          return this.dto(job)
        } catch (error) {
          // 事务仍持有媒体锁，只清理本次新写入的文件，不触碰已有文件。
          for (const key of written.splice(0)) await this.storage.remove(key).catch(() => undefined)
          throw error
        }
      })
    } catch (error) {
      // 提交结果不确定时先核对持久化结果；不能删除可能已经提交并被引用的文件。
      try {
        const job = await this.em.fork().findOne(ContentImport, { id, actorId: admin.id })
        if (job?.completedAt) return this.dto(job)
        for (const key of written)
          await this.em
            .fork()
            .transactional(async (em) => {
              await lockMedia(em)
              if (!(await em.findOne(MediaAsset, { id: key.slice(0, -5) }))) await this.storage.remove(key)
            })
            .catch(() => undefined)
        await this.em.fork().nativeUpdate(
          ContentImport,
          { id, completedAt: null },
          {
            startedAt: null,
            lastError:
              error instanceof HttpException ? error.message : '导入未完成，数据库变更已回滚，可重新预览后重试',
          },
        )
      } catch {
        throw new ServiceUnavailableException('导入结果暂时无法确认，请通过票据查询，原文件仍保留')
      }
      if (error instanceof HttpException) throw error
      throw new ServiceUnavailableException('导入未完成，数据库变更已回滚，可重新预览后重试')
    }
  }
}
