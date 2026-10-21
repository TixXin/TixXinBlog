/**
 * @file operations.service.ts
 * @description 运维监控与后台任务服务：状态脱敏汇总、存储指标与事务级任务重试
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { statfs } from 'node:fs/promises'
import { resolve } from 'node:path'
import { msg } from '../../common/i18n'
import { operationConfigStatus, readOperationConfig } from './operation-config'

export interface SafeTaskOutcome {
  accepted: boolean
  suppressed: boolean
  integrityVerified: boolean
  transferVerified: boolean
  transferConfigured: boolean
  recoveryVerified: boolean
}

export interface SafeTask {
  id: unknown
  kind: unknown
  state: unknown
  attempts: unknown
  maxAttempts: unknown
  availableAt: unknown
  startedAt: unknown
  finishedAt: unknown
  createdAt: unknown
  errorCode: unknown
  outcome: SafeTaskOutcome | null
}

export function safeTask(row: Record<string, unknown>): SafeTask {
  const result = row.result as Record<string, unknown> | null
  const transfer = result?.transfer as Record<string, unknown> | undefined
  return {
    id: row.id,
    kind: row.kind,
    state: row.state,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    availableAt: row.available_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    errorCode: row.error_code,
    outcome: result
      ? {
          accepted: result.accepted === true,
          suppressed: result.suppressed === true,
          integrityVerified: result.integrityVerified === true,
          transferVerified: transfer?.verified === true,
          transferConfigured: transfer?.configured === true,
          recoveryVerified: result.recoveryVerified === true,
        }
      : null,
  }
}

@Injectable()
export class OperationsService {
  constructor(private readonly em: EntityManager) {}

  async getTask(id: string): Promise<SafeTask> {
    const [task] = await this.em.execute('select * from background_task where id=?', [id])
    if (!task) throw new NotFoundException(msg('operations.taskNotFound'))
    return safeTask(task)
  }

  async getStatus(page: number = 1) {
    const config = readOperationConfig()
    const [database, storage] = await Promise.allSettled([
      (async () => {
        const [control] = await this.em.execute<
          { externalPaused: boolean; backupPaused: boolean; revision: number; reason: string; updatedAt: Date }[]
        >(
          'select external_paused as "externalPaused",backup_paused as "backupPaused",revision,reason,updated_at as "updatedAt" from operation_control where id=\'default\'',
        )
        if (!control) throw new Error('operation_control_missing')
        const tasks = await this.em.execute(
          'select * from background_task order by created_at desc,id desc limit 20 offset ?',
          [(page - 1) * 20],
        )
        const [counts] = await this.em.execute<
          { total: number; failures: number; lastVerifiedBackup: Date | null; lastRecovery: Date | null }[]
        >(`select count(*)::int as total,count(*) filter(where state in ('failed','uncertain'))::int as failures,
          max(finished_at) filter(where kind='backup' and result->>'integrityVerified'='true') as "lastVerifiedBackup",
          max(finished_at) filter(where kind='backup' and result->>'recoveryVerified'='true') as "lastRecovery" from background_task`)
        if (!counts) throw new Error('operation_counts_missing')
        return { control, tasks: tasks.map(safeTask), ...counts }
      })(),
      statfs(resolve(process.env.MEDIA_DIRECTORY || './var/media')).then((stat) => ({
        availableBytes: stat.bavail * stat.bsize,
        totalBytes: stat.blocks * stat.bsize,
        low: stat.bavail * stat.bsize < 1024 ** 3 || stat.bavail / Math.max(1, stat.blocks) < 0.05,
      })),
    ])
    const runtime = database.status === 'fulfilled' ? database.value : null
    const stale =
      runtime &&
      !runtime.control.backupPaused &&
      config.backup.enabled &&
      (!runtime.lastVerifiedBackup ||
        Date.now() - new Date(runtime.lastVerifiedBackup).getTime() > config.backup.intervalMinutes * 60000 * 2)
    return {
      configured: operationConfigStatus(config),
      databaseAvailable: !!runtime,
      runtime,
      storage: storage.status === 'fulfilled' ? storage.value : null,
      backupOverdue: !!stale,
      page,
      pageSize: 20,
      generatedAt: new Date().toISOString(),
    }
  }

  async retryTask(id: string, expectedState: string, expectedAttempts: number) {
    return this.em.transactional(async (em) => {
      const [control] = await em.execute("select * from operation_control where id='default' for update")
      if (!control) throw new ConflictException(msg('operations.configUnavailable'))
      const [task] = await em.execute('select * from background_task where id=? for update', [id])
      if (!task || task.state !== expectedState || task.attempts !== expectedAttempts)
        throw new ConflictException(msg('operations.taskStateChanged'))
      if ((task.kind === 'mail' && control.external_paused) || (task.kind === 'backup' && control.backup_paused))
        throw new ConflictException(msg('operations.channelPaused'))
      const result = await em.execute(
        `update background_task set state='queued',generation=?,max_attempts=attempts+3,available_at=now(),finished_at=null,error_code=null,lease_token=null,lease_until=null where id=? returning id,state`,
        [control.generation, id],
      )
      return result[0]
    })
  }
}
