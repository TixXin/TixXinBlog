/**
 * @file admin-pending.ts
 * @description 后台待审数量：评论、闪念评论、朋友圈评论、留言与友链申请。工作台统计与导航徽章共用同一组子查询，
 *              导航只取这五项，不触发工作台的趋势与最近内容查询
 */

/** 各待审项的计数子查询，键即响应字段名 */
export const PENDING_COUNT_SQL = {
  pendingComments: `(select count(*)::int from comment where status='pending')`,
  pendingFlashComments: `(select count(*)::int from flash_comment where status='pending')`,
  pendingMomentComments: `(select count(*)::int from moment_comment c join moment m on m.id=c.moment_id
            where c.status='pending' and c.deleted_at is null and m.deleted_at is null)`,
  pendingGuestbook: `(select count(*)::int from guestbook_message where status='pending' and deleted_at is null)`,
  pendingLinkApplications: `(select count(*)::int from friend_link_application where status='pending')`,
} as const

export type PendingCounts = Record<keyof typeof PENDING_COUNT_SQL, number>

/** 一次查询取全部待审数量 */
export const PENDING_COUNTS_QUERY = `select ${Object.entries(PENDING_COUNT_SQL)
  .map(([key, sql]) => `${sql} as "${key}"`)
  .join(', ')}`
