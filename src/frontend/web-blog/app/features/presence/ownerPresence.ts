/**
 * @file ownerPresence.ts
 * @description 博主在线状态的展示规则：手动状态类型优先；状态类型为“自动”时按心跳显示在线或“N 前在线”；
 *   都没有可展示的内容时返回空文案，由界面隐藏状态行（不再向访客展示“未提供在线状态”）。
 */
import type { OwnerPresenceInfo } from '~/features/site/types'
import type { Translate } from '~/utils/format'
import type { LiveOwner } from './types'

/** 超过这个天数没出现时不再给出具体天数 */
export const LONG_ABSENCE_DAYS = 30

export interface ManualPresence {
  presenceLabel?: string
  presenceSignature?: string
  /** 空串表示“自动” */
  presenceStatus?: '' | 'online' | 'idle' | 'busy'
}

/** “N 分钟/小时/天前在线”；超过 30 天为“超过 30 天没在线”；从未出现返回空串 */
export function lastSeenLabel(lastSeenAt: string | null, now: number, t: Translate): string {
  const at = lastSeenAt ? Date.parse(lastSeenAt) : Number.NaN
  if (!Number.isFinite(at)) return ''
  const minutes = Math.max(0, Math.floor((now - at) / 60000))
  if (minutes < 1) return t('layout.presence.lastSeenJustNow')
  if (minutes < 60) return t('layout.presence.lastSeenMinutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('layout.presence.lastSeenHours', { count: hours })
  const days = Math.floor(hours / 24)
  if (days > LONG_ABSENCE_DAYS) return t('layout.presence.lastSeenLongAgo', { days: LONG_ABSENCE_DAYS })
  return t('layout.presence.lastSeenDays', { count: days })
}

export function resolveOwnerPresence(
  manual: ManualPresence,
  live: LiveOwner | null,
  now: number,
  t: Translate,
): OwnerPresenceInfo {
  const label = manual.presenceLabel?.trim() ?? ''
  const signature = manual.presenceSignature?.trim() ?? ''
  const status = manual.presenceStatus ?? ''
  // 选了具体状态类型时以手动为准；文案留空时显示状态名。
  if (status) return { status, label: label || t(`layout.presence.${status}`), signature, since: '' }
  if (live?.status === 'online')
    return { status: 'online', label: label || t('layout.presence.online'), signature, since: '' }
  if (live) return { status: 'offline', label: lastSeenLabel(live.lastSeenAt, now, t), signature, since: '' }
  // 尚未拿到心跳（SSR、静态发布或关闭了自动状态）：有手动文案时按在线展示，否则隐藏。
  if (label || signature) return { status: 'online', label: label || t('layout.presence.online'), signature, since: '' }
  return { status: 'offline', label: '', signature: '', since: '' }
}
