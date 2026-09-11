/** @file notification-targets.ts @description 按当前业务状态解析通知目标；不将已读与已处理混用 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { unansweredCommentSql, visibleCommentSql } from '../comment/comment-visibility'
import { unansweredGuestbookSql } from '../guestbook/guestbook-values'
import type { OwnerEventKind } from '../../entities/owner-notification.entity'
export interface NotificationSource {
  id: string
  kind: OwnerEventKind
  sourceId: string
}
export interface NotificationTarget {
  state: 'pending_review' | 'awaiting_reply' | 'available' | 'handled' | 'unavailable' | 'failed'
  url: string | null
}

export async function resolveNotificationTargets(em: EntityManager, notifications: NotificationSource[]) {
  const result = new Map<string, NotificationTarget>()
  for (const kind of ['comment', 'guestbook', 'moment-comment', 'task'] as const) {
    const selected = notifications.filter((item) => item.kind === kind)
    if (!selected.length) continue
    const ids = [...new Set(selected.map((item) => item.sourceId))]
    const parameters = ids.map(() => '?').join(',')
    const query =
      kind === 'comment'
        ? `select c.id::text as id,case when p.deleted_at is not null or p.status<>'published' or c.status in ('hidden','spam') or (c.status='published' and not (${visibleCommentSql('c')})) then 'unavailable' when c.status='pending' then 'pending_review' when ${unansweredCommentSql('c')} then 'awaiting_reply' when c.parent_id is null then 'handled' else 'available' end as state from comment c join post p on p.id=c.post_id where c.id::text in (${parameters})`
        : kind === 'guestbook'
          ? `select g.id::text as id,case when g.deleted_at is not null or g.status='hidden' then 'unavailable' when g.status='pending' then 'pending_review' when ${unansweredGuestbookSql('g')} then 'awaiting_reply' when g.reply_to_id is null then 'handled' else 'available' end as state from guestbook_message g where g.id::text in (${parameters})`
          : kind === 'moment-comment'
            ? `select c.id::text as id,c.moment_id as parent,case when c.deleted_at is not null or m.deleted_at is not null or c.status='hidden' then 'unavailable' when c.status='pending' then 'pending_review' when m.status<>'published' then 'unavailable' else 'available' end as state from moment_comment c join moment m on m.id=c.moment_id where c.id::text in (${parameters})`
            : `select id::text,case when state='succeeded' then 'handled' when state in ('failed','uncertain','restored') then 'failed' else 'available' end as state from background_task where id::text in (${parameters})`
    const rows = await em.execute<{ id: string; state: NotificationTarget['state']; parent?: string }[]>(query, ids)
    const byId = new Map(rows.map((row) => [row.id, row]))
    for (const item of selected) {
      const row = byId.get(item.sourceId)
      const state = row?.state ?? 'unavailable'
      const url =
        state === 'unavailable'
          ? null
          : kind === 'comment'
            ? `/admin/comments?commentId=${item.sourceId}`
            : kind === 'guestbook'
              ? `/admin/guestbook?focus=${item.sourceId}`
              : kind === 'moment-comment'
                ? `/admin/moments?comments=${row!.parent}&commentId=${item.sourceId}`
                : `/admin/operations?task=${item.sourceId}`
      result.set(item.id, { state, url })
    }
  }
  return result
}
