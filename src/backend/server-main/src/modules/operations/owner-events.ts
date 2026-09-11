/** @file owner-events.ts @description 业务事务内写入唯一事件和邮件出箱，重试与重启不重复生成通知 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { OwnerEventKind } from '../../entities/owner-notification.entity'
const deliveryContext = new AsyncLocalStorage<{ record: boolean; deliver: boolean }>()
export function withoutExternalNotifications<T>(work: () => Promise<T>) {
  return deliveryContext.run({ record: true, deliver: false }, work)
}
export function withoutOwnerEvents<T>(work: () => Promise<T>) {
  return deliveryContext.run({ record: false, deliver: false }, work)
}

export async function recordOwnerEvent(
  em: EntityManager,
  kind: OwnerEventKind,
  sourceId: string | number,
  reason: string,
  suffix = '',
) {
  if (deliveryContext.getStore()?.record === false) return
  const eventKey = `${kind}:${sourceId}${suffix ? ':' + suffix : ''}`
  const [event] = await em.execute<{ id: string }[]>(
    'insert into owner_notification (id,event_key,kind,source_id,reason,created_at) values (?,?,?,?,?,now()) on conflict (event_key) do nothing returning id',
    [randomUUID(), eventKey, kind, String(sourceId), reason],
  )
  if (!event) return
  // 邮件自身故障仅留站内，备份故障可进入已启用通道，避免递归投递。
  if (kind === 'task' && reason !== 'backup_failed') return
  await em.execute(
    `insert into background_task (id,dedupe_key,kind,state,generation,payload,available_at,created_at)
    select ?,?,'mail',case when external_paused or ?=false then 'paused' else 'queued' end,generation,?::jsonb,now(),now()
    from operation_control where id='default' on conflict (dedupe_key) do nothing`,
    [
      randomUUID(),
      `mail:${eventKey}`,
      process.env.NOTIFICATION_EMAIL_ENABLED === 'true' && deliveryContext.getStore()?.deliver !== false,
      JSON.stringify({ notificationId: event.id }),
    ],
  )
}
