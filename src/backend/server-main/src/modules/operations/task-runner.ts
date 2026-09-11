/** @file task-runner.ts @description 最小持久执行器：同类互斥、租约、有限重试与明确的不确定投递，默认无循环 */
import type { MikroORM, EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import nodemailer from 'nodemailer'
import type { BackgroundTaskKind } from '../../entities/background-task.entity'
import type { OperationConfig } from './operation-config'
import { recordOwnerEvent } from './owner-events'
import { performWorkerBackup } from './worker-backup'
import { resolveNotificationTargets } from './notification-targets'
import type { NotificationSource } from './notification-targets'

interface TaskRow {
  id: string
  generation: string
  payload: { notificationId?: string }
  attempts: number
  max_attempts: number
  lease_token: string
}
export interface TaskOutcome {
  state: string
  taskId?: string
  errorCode?: string
}
const LOCK = { mail: 743061, backup: 743062 }
const LEASE_SECONDS = 300
export async function setOperationPaused(
  orm: MikroORM,
  kind: BackgroundTaskKind,
  paused: boolean,
  expectedRevision: number,
) {
  const column = kind === 'mail' ? 'external_paused' : 'backup_paused'
  const [row] = await orm.em
    .fork()
    .execute<Record<string, unknown>[]>(
      `update operation_control set ${column}=?,revision=revision+1,reason=?,updated_at=now() where id='default' and revision=? returning revision,external_paused,backup_paused,generation`,
      [paused, paused ? 'operator_paused' : 'operator_enabled', expectedRevision],
    )
  if (!row) throw new Error('运行控制版本已改变，请重新读取后确认')
  return row
}
export async function scheduleBackup(orm: MikroORM, config: OperationConfig, now = new Date()): Promise<TaskOutcome> {
  if (!config.backup.enabled || config.backup.missing.length) return { state: 'disabled' }
  const slot = Math.floor(now.getTime() / (config.backup.intervalMinutes * 60_000))
  const [row] = await orm.em.fork().execute<{ id: string }[]>(
    `insert into background_task (id,dedupe_key,kind,state,generation,payload,available_at,created_at)
    select ?, 'backup:'||generation::text||':'||?, 'backup','queued',generation,'{}'::jsonb,?,now() from operation_control
    where id='default' and backup_paused=false on conflict(dedupe_key) do nothing returning id`,
    [randomUUID(), String(slot), now],
  )
  return row ? { state: 'queued', taskId: row.id } : { state: 'paused_or_existing' }
}
export function classifyMailError(error: unknown): { state: 'retry' | 'failed' | 'uncertain'; code: string } {
  const value = error as { code?: string; responseCode?: number; command?: string; syscall?: string }
  if (value.responseCode && value.responseCode >= 400 && value.responseCode < 500)
    return { state: 'retry', code: 'smtp_temporary_rejection' }
  if (value.responseCode && value.responseCode >= 500) return { state: 'failed', code: 'smtp_permanent_rejection' }
  if (value.code === 'EAUTH' || value.code === 'EENVELOPE')
    return { state: 'failed', code: 'smtp_configuration_rejected' }
  if (value.code === 'EDNS' || value.syscall === 'connect')
    return { state: 'retry', code: 'smtp_connection_unavailable' }
  // 实测 DATA 后断线仍可报告 command=CONN，不能据此断言尚未发送。
  return { state: 'uncertain', code: 'smtp_acceptance_unknown' }
}
async function mail(em: EntityManager, config: OperationConfig, task: TaskRow) {
  const [notification] = await em.execute<(NotificationSource & { reason: string })[]>(
    'select id,kind,reason,source_id as "sourceId" from owner_notification where id=?',
    [task.payload.notificationId ?? null],
  )
  if (
    !notification ||
    (!['guestbook', 'comment', 'moment-comment'].includes(notification.kind) &&
      !(notification.kind === 'task' && notification.reason === 'backup_failed'))
  )
    throw Object.assign(new Error('通知不存在'), { code: 'EENVELOPE' })
  const targetState = (await resolveNotificationTargets(em, [notification])).get(notification.id)
  if (!targetState || ['unavailable', 'handled'].includes(targetState.state))
    return { suppressed: true, reason: targetState?.state ?? 'unavailable' }
  const labels: Record<string, string> = {
    guestbook: '收到新的留言',
    comment: '收到新的文章评论',
    'moment-comment': '收到新的动态评论',
    task: '备份任务执行异常',
  }
  const transport = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    requireTLS: !config.email.secure && !config.email.localPlain,
    ignoreTLS: config.email.localPlain,
    auth: config.email.user ? { user: config.email.user, pass: config.email.password } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    dnsTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  })
  try {
    const target = new URL('/admin/notifications', config.email.siteUrl)
    target.searchParams.set('notification', task.payload.notificationId!)
    const info = await transport.sendMail({
      from: config.email.from,
      to: config.email.to,
      subject: `博客互动：${labels[notification.kind]}`,
      text: `${labels[notification.kind]}。请登录后台查看当前审核和回复状态。\n${target.toString()}`,
      messageId: `<tixxin-${task.id}@${new URL(config.email.siteUrl).hostname}>`,
      disableFileAccess: true,
      disableUrlAccess: true,
    })
    if (info.accepted?.length !== 1 || info.rejected?.length)
      throw Object.assign(new Error('收件目标未被接受'), { code: 'EENVELOPE' })
    return { accepted: true, messageId: `<tixxin-${task.id}@${new URL(config.email.siteUrl).hostname}>` }
  } finally {
    transport.close()
  }
}
export async function runTaskOnce(
  orm: MikroORM,
  config: OperationConfig,
  kind: BackgroundTaskKind,
): Promise<TaskOutcome> {
  const settings = kind === 'mail' ? config.email : config.backup
  if (!settings.enabled || settings.missing.length) return { state: 'disabled' }
  // 独立连接上的事务锁覆盖全部外部操作；领取/进度由其他连接提交，使进程中断可观测。
  return orm.em.fork().transactional(async (locked) => {
    const [lock] = await locked.execute<{ owned: boolean }[]>('select pg_try_advisory_xact_lock(?) as owned', [
      LOCK[kind],
    ])
    if (!lock?.owned) return { state: 'busy' }
    const em = orm.em.fork()
    await em.transactional(async (transaction) => {
      const expired = await transaction.execute<{ id: string }[]>(
        `update background_task set state=?,error_code=?,finished_at=now(),lease_token=null,lease_until=null where kind=? and state='running' and (lease_until is null or lease_until<now()) returning id`,
        [
          kind === 'mail' ? 'uncertain' : 'failed',
          kind === 'mail' ? 'smtp_interrupted_unknown' : 'backup_interrupted',
          kind,
        ],
      )
      for (const item of expired)
        await recordOwnerEvent(transaction, 'task', item.id, kind === 'mail' ? 'delivery_uncertain' : 'backup_failed')
    })
    const [active] = await em.execute<{ count: number }[]>(
      "select count(*)::int as count from background_task where kind=? and state='running'",
      [kind],
    )
    if (active?.count) return { state: 'busy' }
    const column = kind === 'mail' ? 'external_paused' : 'backup_paused'
    const [control] = await em.execute<{ paused: boolean; generation: string; limited: boolean }[]>(
      `select ${column} as paused,generation,(last_mail_at is not null and last_mail_at>now()-(?*interval '1 second')) as limited from operation_control where id='default'`,
      [config.email.intervalSeconds],
    )
    if (!control || control.paused) return { state: 'paused' }
    if (kind === 'mail' && control.limited) return { state: 'rate_limited' }
    const token = randomUUID()
    const [task] = await em.execute<TaskRow[]>(
      `update background_task set state='running',attempts=attempts+1,lease_token=?,lease_until=now()+(?*interval '1 second'),started_at=now(),finished_at=null,error_code=null
      where id=(select id from background_task where kind=? and state in ('queued','retry') and generation=? and available_at<=now() and attempts<max_attempts order by available_at,created_at,id for update skip locked limit 1) returning *`,
      [token, LEASE_SECONDS, kind, control.generation],
    )
    if (!task) return { state: 'idle' }
    let heartbeatFailure = false
    let heartbeating = Promise.resolve()
    const timer = setInterval(() => {
      heartbeating = heartbeating.then(async () => {
        try {
          await orm.em
            .fork()
            .execute(
              "update background_task set lease_until=now()+(?*interval '1 second') where id=? and lease_token=? and state='running'",
              [LEASE_SECONDS, task.id, token],
            )
        } catch {
          heartbeatFailure = true
        }
      })
    }, 60_000)
    timer.unref()
    let final: TaskOutcome
    let acceptedMailResult: Record<string, unknown> | null = null
    try {
      const [authorized] = await em.execute<{ allowed: boolean }[]>(
        `select (generation=? and ${column}=false) as allowed from operation_control where id='default'`,
        [task.generation],
      )
      if (!authorized?.allowed) {
        await em.execute(
          "update background_task set state='paused',error_code='operation_paused',lease_token=null,lease_until=null where id=? and lease_token=?",
          [task.id, token],
        )
        return { state: 'paused', taskId: task.id }
      }
      if (kind === 'mail')
        await em.execute("update operation_control set last_mail_at=now() where id='default' and generation=?", [
          task.generation,
        ])
      const result =
        kind === 'mail' ? await mail(em, config, task) : await performWorkerBackup(config, task.id, task.attempts)
      if (kind === 'mail' && 'accepted' in result && result.accepted === true) acceptedMailResult = result
      const [completed] = await em.execute<{ id: string }[]>(
        `update background_task set state='succeeded',result=?::jsonb,finished_at=now(),lease_token=null,lease_until=null where id=? and lease_token=? and generation=(select generation from operation_control where id='default') returning id`,
        [JSON.stringify(result), task.id, token],
      )
      final = { state: completed ? 'succeeded' : 'uncertain', taskId: task.id }
    } catch (error) {
      const classification =
        kind === 'mail'
          ? acceptedMailResult
            ? // SMTP 已接受后发生的是结果记录故障，数据库 connect/DNS 错误不能当作未投递重试。
              { state: 'uncertain' as const, code: 'smtp_result_not_recorded' }
            : classifyMailError(error)
          : {
              state: 'retry' as const,
              code: (error as { operationCode?: string }).operationCode ?? 'backup_execution_failed',
            }
      const state =
        classification.state === 'retry' && task.attempts >= task.max_attempts ? 'failed' : classification.state
      const seconds = Math.min(3600, 30 * 2 ** Math.max(0, task.attempts - 1))
      // 错误仅保留固定分类；SMTP 回复和底层异常可能含地址、路径与凭据。
      const recorded = await em.transactional(async (transaction) => {
        const [updated] = await transaction.execute<{ id: string }[]>(
          `update background_task set state=?,error_code=?,result=?::jsonb,available_at=now()+(?*interval '1 second'),finished_at=case when ?='retry' then null else now() end,lease_token=null,lease_until=null where id=? and lease_token=? and generation=(select generation from operation_control where id='default') returning id`,
          [
            state,
            classification.code,
            JSON.stringify(acceptedMailResult ?? (error as { operationResult?: unknown }).operationResult ?? null),
            seconds,
            state,
            task.id,
            token,
          ],
        )
        if (updated)
          await recordOwnerEvent(
            transaction,
            'task',
            task.id,
            kind === 'backup' ? 'backup_failed' : classification.code,
          )
        return !!updated
      })
      final = { state: recorded ? state : 'uncertain', taskId: task.id, errorCode: classification.code }
    } finally {
      clearInterval(timer)
      await heartbeating
    }
    if (heartbeatFailure && final.state !== 'succeeded')
      return { ...final, errorCode: final.errorCode ?? 'task_heartbeat_failed' }
    return final
  })
}
