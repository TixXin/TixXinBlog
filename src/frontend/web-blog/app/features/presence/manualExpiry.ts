/**
 * @file manualExpiry.ts
 * @description 手动状态到期规则与后台时间输入的换算：到期后状态类型与状态文案失效、签名保留；
 *   到期时间以 UTC 的 ISO 字符串保存，后台用本机时区的 datetime-local 输入框编辑。
 */
import type { ManualPresence } from './ownerPresence'

/** 手动状态是否已到期；空串或无法解析视为长期有效 */
export function manualPresenceExpired(expiresAt: string | undefined, now: number): boolean {
  const at = expiresAt ? Date.parse(expiresAt) : Number.NaN
  return Number.isFinite(at) && at <= now
}

/** 到期后去掉状态类型与状态文案，回到自动状态；未到期原样返回 */
export function activeManualPresence<T extends ManualPresence>(manual: T, now: number): T {
  return manualPresenceExpired(manual.presenceExpiresAt, now)
    ? { ...manual, presenceLabel: '', presenceStatus: '' }
    : manual
}

const pad = (value: number) => String(value).padStart(2, '0')

/** ISO 字符串 → 本机时区的 datetime-local 值（YYYY-MM-DDTHH:mm）；空串或非法值返回空串 */
export function toLocalDateTimeInput(iso: string): string {
  const at = iso ? new Date(iso) : null
  if (!at || Number.isNaN(at.getTime())) return ''
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/** datetime-local 值（按本机时区理解）→ UTC 的 ISO 字符串；空串表示长期有效 */
export function fromLocalDateTimeInput(value: string): string {
  if (!value) return ''
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? '' : at.toISOString()
}
