/**
 * @file pending.ts
 * @description 后台导航待审徽章：待审项与导航入口的对应关系。数量来自 GET /admin/overview/pending
 * @author TixXin
 * @since 2026-11-06
 */

export interface AdminPendingCounts {
  pendingComments: number
  pendingFlashComments: number
  pendingMomentComments: number
  pendingGuestbook: number
  pendingLinkApplications: number
}

/** 导航路径 → 显示在该入口上的待审项 */
export const ADMIN_PENDING_BY_PATH: Record<string, keyof AdminPendingCounts> = {
  '/admin/comments': 'pendingComments',
  '/admin/flash-comments': 'pendingFlashComments',
  '/admin/moment-comments': 'pendingMomentComments',
  '/admin/guestbook': 'pendingGuestbook',
  '/admin/links': 'pendingLinkApplications',
}

/** 徽章里的数字超过 99 时显示 99+ */
export function badgeText(count: number) {
  return count > 99 ? '99+' : String(count)
}
