/** @file operations.controller.ts @description 管理员运行状态与显式任务重试；只返回脱敏结果，不开放外部启用 */
import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { Type } from 'class-transformer'
import { IsIn, IsInt, Min } from 'class-validator'
import { statfs } from 'node:fs/promises'
import { resolve } from 'node:path'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { operationConfigStatus, readOperationConfig } from './operation-config'
class TaskQuery {
  @Type(() => Number) @IsInt() @Min(1) page = 1
}
class RetryTaskDto {
  @IsIn(['failed', 'uncertain', 'restored']) expectedState!: string
  @IsInt() @Min(0) expectedAttempts!: number
  @IsIn(['重试失败任务', '已核对未送达并承担重复投递风险', '明确重新投递恢复前任务']) acknowledgement!: string
}
function safeTask(row: Record<string, unknown>) {
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
@Controller('admin/operations')
@UseGuards(AdminAuthGuard)
export class OperationsController {
  constructor(private readonly em: EntityManager) {}
  @Get('tasks/:id') async task(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const [task] = await this.em.execute('select * from background_task where id=?', [id])
    if (!task) throw new NotFoundException('任务不存在或记录已清理')
    return safeTask(task)
  }
  @Get() async status(@Query() query: TaskQuery) {
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
          [(query.page - 1) * 20],
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
      page: query.page,
      pageSize: 20,
      generatedAt: new Date().toISOString(),
    }
  }
  @Post('tasks/:id/retry') async retry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: RetryTaskDto,
  ) {
    const expected =
      body.expectedState === 'uncertain'
        ? '已核对未送达并承担重复投递风险'
        : body.expectedState === 'restored'
          ? '明确重新投递恢复前任务'
          : '重试失败任务'
    if (body.acknowledgement !== expected) throw new ConflictException('请核对任务实际结果后明确选择重试')
    return this.em.transactional(async (em) => {
      const [control] = await em.execute("select * from operation_control where id='default' for update")
      if (!control) throw new ConflictException('运行配置不可用，请核对迁移')
      const [task] = await em.execute('select * from background_task where id=? for update', [id])
      if (!task || task.state !== body.expectedState || task.attempts !== body.expectedAttempts)
        throw new ConflictException('任务状态已变化，请刷新后核对')
      if ((task.kind === 'mail' && control.external_paused) || (task.kind === 'backup' && control.backup_paused))
        throw new ConflictException('通道当前暂停，请先按运行说明显式启用')
      const result = await em.execute(
        `update background_task set state='queued',generation=?,max_attempts=attempts+3,available_at=now(),finished_at=null,error_code=null,lease_token=null,lease_until=null where id=? returning id,state`,
        [control.generation, id],
      )
      return result[0]
    })
  }
}
