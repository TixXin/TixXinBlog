/** @file presenceExpiry.test.ts @description 手动状态到期：到期后回到自动状态且签名保留，本机时间与 ISO 的换算往返一致 */
import { expect, it } from 'vitest'
import {
  activeManualPresence,
  fromLocalDateTimeInput,
  manualPresenceExpired,
  toLocalDateTimeInput,
} from '../../app/features/presence/manualExpiry'
import { resolveOwnerPresence } from '../../app/features/presence/ownerPresence'

const t = (key: string, params: Record<string, unknown> = {}) =>
  key === 'layout.presence.busy'
    ? '忙碌'
    : key === 'layout.presence.online'
      ? '在线'
      : `${key}${JSON.stringify(params)}`
const EXPIRES = '2026-11-05T10:00:00.000Z'
const manual = {
  presenceStatus: 'busy' as const,
  presenceLabel: '出门了',
  presenceSignature: '晚点回复',
  presenceExpiresAt: EXPIRES,
}

it('到期前保留手动状态，到期时刻起回到自动状态，签名保留；空串与非法时间视为长期有效', () => {
  const before = Date.parse(EXPIRES) - 1
  const at = Date.parse(EXPIRES)
  expect(manualPresenceExpired(EXPIRES, before)).toBe(false)
  expect(manualPresenceExpired(EXPIRES, at)).toBe(true)
  expect(manualPresenceExpired('', at)).toBe(false)
  expect(manualPresenceExpired('not-a-date', at)).toBe(false)
  expect(activeManualPresence(manual, before)).toBe(manual)
  expect(activeManualPresence(manual, at)).toEqual({ ...manual, presenceStatus: '', presenceLabel: '' })
  // 到期后由心跳决定：博主在线显示“在线”，签名照常显示
  expect(
    resolveOwnerPresence(activeManualPresence(manual, at), { status: 'online', lastSeenAt: EXPIRES }, at, t),
  ).toMatchObject({ status: 'online', label: '在线', signature: '晚点回复' })
  expect(resolveOwnerPresence(activeManualPresence(manual, before), null, before, t)).toMatchObject({
    status: 'busy',
    label: '出门了',
  })
})

it('后台输入框按本机时区显示与保存，往返一致；空值表示长期有效', () => {
  const local = toLocalDateTimeInput(EXPIRES)
  expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  expect(fromLocalDateTimeInput(local)).toBe(EXPIRES)
  expect(toLocalDateTimeInput('')).toBe('')
  expect(toLocalDateTimeInput('bad')).toBe('')
  expect(fromLocalDateTimeInput('')).toBe('')
})
