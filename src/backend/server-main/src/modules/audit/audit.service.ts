/**
 * @file audit.service.ts
 * @description 操作前持久化意图；结果正常写库，短时失败保留待补全记录并有限重试。
 */
import { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { OnModuleDestroy } from '@nestjs/common'
import { AuditEntry } from '../../entities/audit-entry.entity'
import type { AuditState, AuditSummary } from '../../entities/audit-entry.entity'
import { auditActionLabel, auditFieldLabel } from './audit-description'
import { msg, translate, translateStored, type ApiLocale } from '../../common/i18n'
export interface AuditActor {
  id: string
  name?: string
  sessionId?: string
}
interface AuditCompletion {
  finishedAt?: Date
  actor?: AuditActor
  state: AuditState
  statusCode?: number
  summary: AuditSummary
  resourceId?: string
}
@Injectable()
export class AuditService implements OnModuleDestroy {
  private readonly logger = new Logger('AuditService')
  private readonly retries = new Map<string, AuditCompletion>()
  private readonly pending = new Set<Promise<boolean>>()
  private timer?: ReturnType<typeof setTimeout>
  private stopping = false
  private droppedRetries = 0
  constructor(private readonly em: EntityManager) {}
  async begin(
    description: { action: string; resourceType: string; resourceId?: string },
    actor?: AuditActor,
    traceId?: string,
  ) {
    if (this.stopping || this.retries.size >= 1000) throw new ServiceUnavailableException(msg('audit.backlog'))
    try {
      const em = this.em.fork()
      const entry = em.create(AuditEntry, {
        ...description,
        actorId: actor?.id,
        actorName: actor?.name?.slice(0, 80),
        sessionId: actor?.sessionId,
        traceId,
        state: 'pending',
        summary: { fields: [] },
      })
      await em.flush()
      return entry.id
    } catch {
      throw new ServiceUnavailableException(msg('audit.storageUnavailable'))
    }
  }
  complete(id: string, value: AuditCompletion): Promise<boolean> {
    const operation = this.persist(id, { ...value, finishedAt: value.finishedAt ?? new Date() })
    this.pending.add(operation)
    void operation.then(
      () => this.pending.delete(operation),
      () => this.pending.delete(operation),
    )
    return operation
  }
  private async persist(id: string, value: AuditCompletion) {
    try {
      await this.em.fork().nativeUpdate(
        AuditEntry,
        { id },
        {
          actorId: value.actor?.id,
          actorName: value.actor?.name?.slice(0, 80),
          sessionId: value.actor?.sessionId,
          resourceId: value.resourceId,
          state: value.state,
          statusCode: value.statusCode,
          summary: value.summary,
          finishedAt: value.finishedAt,
        },
      )
      this.retries.delete(id)
      return true
    } catch {
      if (this.retries.size < 1000 || this.retries.has(id)) this.retries.set(id, value)
      else this.droppedRetries += 1
      this.logger.warn(`审计结果待补全，记录 ${id}`)
      this.scheduleRetry()
      return false
    }
  }
  private scheduleRetry() {
    if (this.timer || this.stopping) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.flushRetries()
    }, 3000)
    this.timer.unref()
  }
  private async flushRetries() {
    for (const [id, value] of [...this.retries]) await this.complete(id, value)
  }
  async onModuleDestroy() {
    this.stopping = true
    clearTimeout(this.timer)
    await Promise.allSettled([...this.pending])
    await this.flushRetries()
  }
  async list(
    query: { page: number; action?: string; state?: AuditState; from?: string; to?: string },
    locale: ApiLocale = 'zh-CN',
  ) {
    const where: FilterQuery<AuditEntry> = {}
    if (query.action) where.action = query.action
    if (query.state) where.state = query.state
    if (query.from || query.to)
      where.createdAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lt: new Date(new Date(query.to).getTime() + 86400000) } : {}),
      }
    const [items, total] = await this.em.findAndCount(AuditEntry, where, {
      orderBy: { createdAt: 'desc', id: 'desc' },
      limit: 20,
      offset: (query.page - 1) * 20,
    })
    return {
      items: items.map((item) => ({
        id: item.id,
        actor: item.actorName
          ? translateStored(locale, item.actorName, 'audit.actor.')
          : translate(locale, item.actorId ? 'audit.actor.admin' : 'audit.actor.anonymous'),
        actorId: item.actorId,
        action: item.action,
        actionLabel: auditActionLabel(item.action, locale),
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        state: item.state,
        statusCode: item.statusCode,
        // 字段名按中文持久化，读取时翻译；数据库中的历史记录保持原样。
        summary: Array.isArray(item.summary?.fields)
          ? { ...item.summary, fields: item.summary.fields.map((label) => auditFieldLabel(label, locale)) }
          : item.summary,
        createdAt: item.createdAt.toISOString(),
        finishedAt: item.finishedAt?.toISOString(),
        traceId: item.traceId,
      })),
      total,
      page: query.page,
      pageSize: 20,
      health: {
        waitingResults: await this.em.count(AuditEntry, { state: 'pending' }),
        retryQueue: this.retries.size,
        droppedRetries: this.droppedRetries,
      },
    }
  }
}
