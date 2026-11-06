/**
 * @file status.ts
 * @description 后台内容状态到徽章色调的统一映射：公开为成功色，待处理为警告色，隐藏与回收为危险色，
 *              归档、撤回等收起状态为中性色。各页面只传状态值与自己的文案，不再各写一套颜色。
 * @author TixXin
 * @since 2026-11-06
 */

export type AdminStatusTone = 'is-success' | 'is-warning' | 'is-danger' | 'is-info' | ''

const TONES: Record<string, AdminStatusTone> = {
  published: 'is-success',
  approved: 'is-success',
  active: 'is-success',
  success: 'is-success',
  draft: 'is-warning',
  pending: 'is-warning',
  dev: 'is-info',
  scheduled: 'is-info',
  running: 'is-info',
  hidden: 'is-danger',
  rejected: 'is-danger',
  trash: 'is-danger',
  deleted: 'is-danger',
  failed: 'is-danger',
}

/** 未登记的状态（归档、撤回、取消、暂停等）一律中性色 */
export function adminStatusTone(status: string | null | undefined): AdminStatusTone {
  return (status && TONES[status]) || ''
}
