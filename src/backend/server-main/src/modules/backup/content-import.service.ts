/**
 * @file content-import.service.ts
 * @description 内容迁入以新草稿保留原数据，完整事务回滚，票据重试不重复创建。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import { IsolationLevel, LockMode } from '@mikro-orm/core'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { ContentImport } from '../../entities/content-import.entity'
import { AdminSession } from '../../entities/admin-session.entity'
import { MediaStorage } from '../media/media-storage'
import { lockMedia } from '../media/media-references'
import { lockTaxonomy } from '../post/taxonomy-lock'
import { AdminPostService } from '../post/admin-post.service'
import { AdminFlashService } from '../flash/admin-flash.service'
import { SiteSettingsService } from '../site/site-settings.service'
import { CommentModerationService } from '../comment/comment-moderation.service'
import { ContentExportService } from './content-export.service'
import { packageHash, parseContentPackage } from './content-package'
import { makeContentPlan } from './content-import-plan'
import { lockGuestbook } from '../guestbook/guestbook-write.service'
import { DEFAULT_API_LOCALE, msg, rethrowable, type ApiLocale } from '../../common/i18n'
import { formatImportJobDto } from './content-import-dto'
import { applyImportPayload, assertUploadFileValid, handleImportFailure } from './content-import-execution'

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

  private dto(job: ContentImport, locale: ApiLocale = DEFAULT_API_LOCALE) {
    return formatImportJobDto(job, locale)
  }

  private async cleanup() {
    // last_error 写入 backup.previewExpiredReselect 的中文原文，读取时由 dto() 反查翻译。
    await this.em.execute(
      `with expired as (select id from content_import where expires_at < now() and completed_at is null and payload is not null for update skip locked limit 10) update content_import set payload=null,last_error='预览已过期，请重新选择文件' where id in (select id from expired)`,
    )
  }

  async get(id: string, admin: Admin, locale: ApiLocale = DEFAULT_API_LOCALE) {
    await this.cleanup()
    const job = await this.em.findOne(ContentImport, { id, actorId: admin.id }, { refresh: true })
    if (!job) throw new NotFoundException(msg('backup.importTicketNotFound'))
    return this.dto(job, locale)
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

  async preview(
    file: { buffer: Buffer; originalname: string } | undefined,
    input: Options,
    admin: Admin,
    locale: ApiLocale = DEFAULT_API_LOCALE,
  ) {
    assertUploadFileValid(file)
    const fileHash = createHash('sha256').update(file!.buffer).digest('hex')
    const existing = await this.em.findOne(ContentImport, { id: input.requestId })
    if (existing) {
      if (
        existing.actorId !== admin.id ||
        existing.fileHash !== fileHash ||
        existing.strategy !== input.strategy ||
        existing.includeSettings !== input.includeSettings
      )
        throw new ConflictException(msg('backup.uploadIdUsed'))
      return this.get(existing.id, admin, locale)
    }
    const payload = await parseContentPackage(file!.buffer)
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
            throw new ConflictException(msg('backup.uploadIdConflict'))
          return this.dto(duplicate, locale)
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
        return this.dto(job, locale)
      },
      { isolationLevel: IsolationLevel.REPEATABLE_READ },
    )
  }

  async repreview(id: string, admin: Admin, locale: ApiLocale = DEFAULT_API_LOCALE) {
    return this.em.transactional(async (em) => {
      const job = await em.findOne(
        ContentImport,
        { id, actorId: admin.id },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      )
      if (!job) throw new NotFoundException(msg('backup.importTicketNotFound'))
      if (job.completedAt) return this.dto(job, locale)
      if (!job.payload || job.expiresAt <= new Date()) throw new BadRequestException(msg('backup.packageExpired'))
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
      return this.dto(job, locale)
    })
  }

  executeImport(
    id: string,
    acknowledgement: string,
    confirmation: string,
    admin: Admin,
    locale: ApiLocale = DEFAULT_API_LOCALE,
  ) {
    return this.execute(id, acknowledgement, confirmation, admin, locale)
  }

  async execute(
    id: string,
    acknowledgement: string,
    confirmation: string,
    admin: Admin,
    locale: ApiLocale = DEFAULT_API_LOCALE,
  ) {
    // 确认短语是接口契约，保持中文；前端负责按语言显示。
    if (acknowledgement !== '导入为新草稿') throw new BadRequestException(msg('backup.confirmDraftImport'))
    const initial = await this.em.findOne(ContentImport, { id, actorId: admin.id })
    if (!initial) throw new NotFoundException(msg('backup.importTicketNotFound'))
    if (initial.completedAt) return this.dto(initial, locale)
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
        if (job.completedAt) return this.dto(job, locale)
        if (confirmation !== packageHash(job.plan)) throw new ConflictException(msg('backup.previewUpdated'))
        if (!job.payload || job.expiresAt <= new Date() || job.sessionVersion !== admin.sessionVersion)
          throw new BadRequestException(msg('backup.previewInvalid'))
        if (
          !(await em.count(AdminSession, {
            id: admin.sessionId,
            adminUser: admin.id,
            revokedAt: null,
            expiresAt: { $gt: new Date() },
          }))
        )
          throw new ConflictException(msg('backup.sessionInvalidNotStarted'))
        const current = await makeContentPlan(
          em,
          this.exporter,
          this.storage,
          job.payload,
          job.strategy,
          job.includeSettings,
          id,
        )
        if (!current.ready)
          throw new ConflictException(
            current.errors[0] ? rethrowable(current.errors[0]) : msg('backup.importConditionsUnmet'),
          )
        if (!job.plan.ready || current.basis !== job.plan.basis)
          throw new ConflictException(msg('backup.targetChanged'))
        try {
          job.result = await applyImportPayload({
            em,
            storage: this.storage,
            posts: this.posts,
            flashes: this.flashes,
            sites: this.sites,
            comments: this.comments,
            current,
            payload: job.payload,
            written,
            includeSettings: job.includeSettings,
          })
          job.completedAt = new Date()
          job.payload = undefined
          job.lastError = undefined
          await em.flush()
          return this.dto(job, locale)
        } catch (error) {
          // 事务仍持有媒体锁，只清理本次新写入的文件，不触碰已有文件。
          for (const key of written.splice(0)) await this.storage.remove(key).catch(() => undefined)
          throw error
        }
      })
    } catch (error) {
      // 提交结果不确定时先核对持久化结果；不能删除可能已经提交并被引用的文件。
      return handleImportFailure({
        em: this.em,
        storage: this.storage,
        id,
        actorId: admin.id,
        written,
        error,
        locale,
      })
    }
  }
}
