/** @file local.ts @description 访客订阅的版本化存储校验；损坏数据保留原文，历史迁移不补造过去价格 */
import { appendPriceHistory, isDate, validatePricing, validatePriceHistory } from '@tixxin/subscription-domain'
import { categoryLabels, stateLabels } from './types'
import type { SubscriptionEditable, SubscriptionItem } from './types'
export const subscriptionStorageKey = 'tixxin-my-subscriptions'
export const MAX_LOCAL_SUBSCRIPTIONS = 1000
export const MAX_LOCAL_SUBSCRIPTION_LENGTH = 5000000
export interface LocalSubscription extends SubscriptionItem, SubscriptionEditable {
  id: string
  revision: number
  createdAt: string
  updatedAt: string
}
export interface LocalSubscriptions {
  version: 2
  revision: string
  items: LocalSubscription[]
}
export function safeSubscriptionUrl(value: unknown): string | null {
  if (value === null || value === '') return null
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    [...value].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)
  )
    throw new Error('官网地址必须是有效的 HTTP 或 HTTPS 地址')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('官网地址必须是有效的 HTTP 或 HTTPS 地址')
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('官网地址不能包含危险协议或登录凭据')
  return url.href
}
export function validateLocalFields(value: SubscriptionEditable) {
  validatePricing(value)
  if (
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 160 ||
    typeof value.description !== 'string' ||
    value.description.length > 5000 ||
    typeof value.notes !== 'string' ||
    value.notes.length > 5000 ||
    (value.platform !== null && (typeof value.platform !== 'string' || value.platform.length > 160)) ||
    !Object.hasOwn(categoryLabels, value.category) ||
    !Object.hasOwn(stateLabels, value.subscriptionStatus)
  )
    throw new Error('订阅字段无效，请核对名称、分类和说明')
  safeSubscriptionUrl(value.url)
  if (
    (value.startDate !== null && !isDate(value.startDate)) ||
    (value.nextBillingDate !== null && !isDate(value.nextBillingDate))
  )
    throw new Error('请填写真实存在的日期')
  if (value.startDate && value.nextBillingDate && value.nextBillingDate < value.startDate)
    throw new Error('下次扣费日期不能早于开始日期')
  if (value.priceChangeReason && value.priceChangeReason.length > 500) throw new Error('变价原因最多 500 字')
}
export function parseLocalSubscriptions(raw: string | null, now = new Date().toISOString()): LocalSubscriptions {
  if (raw === null) return { version: 2, revision: '', items: [] }
  try {
    if (raw.length > MAX_LOCAL_SUBSCRIPTION_LENGTH) throw new Error('size')
    const envelope = JSON.parse(raw) as { version: number; revision?: string; items: LocalSubscription[] }
    if (
      ![1, 2].includes(envelope.version) ||
      !Array.isArray(envelope.items) ||
      envelope.items.length > MAX_LOCAL_SUBSCRIPTIONS ||
      (envelope.version === 2 && typeof envelope.revision !== 'string')
    )
      throw new Error('version')
    const ids = new Set<string>()
    const items = envelope.items.map((entry) => {
      if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)) throw new Error('id')
      ids.add(entry.id)
      const migrated =
        envelope.version === 1
          ? {
              ...entry,
              notes: entry.notes ?? '',
              description: entry.description ?? '',
              platform: entry.platform ?? null,
              url: entry.url ?? null,
              startDate: entry.startDate ?? null,
              nextBillingDate: entry.nextBillingDate ?? null,
              revision: entry.revision ?? 0,
              createdAt: entry.createdAt ?? now,
              updatedAt: entry.updatedAt ?? now,
            }
          : entry
      validateLocalFields(migrated)
      if (
        !Number.isSafeInteger(migrated.revision) ||
        migrated.revision < 0 ||
        !Number.isFinite(Date.parse(migrated.createdAt)) ||
        !Number.isFinite(Date.parse(migrated.updatedAt))
      )
        throw new Error('revision')
      const history =
        migrated.priceHistory ??
        (envelope.version === 1
          ? appendPriceHistory([], migrated, {
              id: crypto.randomUUID(),
              recordedAt: now,
              reason: '迁移时首次记录的价格；之前价格未知',
            })
          : null)
      return {
        ...migrated,
        iconMediaId: null,
        iconUrl: null,
        faviconUrl: null,
        publishedAt: null,
        status: 'draft' as const,
        sortOrder: 0,
        priceChangeReason: '',
        priceHistory: validatePriceHistory(history, migrated),
      }
    })
    return { version: 2, revision: envelope.revision ?? '', items }
  } catch {
    throw new Error('本地订阅数据损坏、字段无效或版本不兼容。原始数据已保留，请保留浏览器数据并修复后重试。')
  }
}

/** 写入和读取使用相同边界，拒绝制造刷新后无法读取的本机内容。 */
export function serializeLocalSubscriptions(value: LocalSubscriptions): string {
  if (value.items.length > MAX_LOCAL_SUBSCRIPTIONS) throw new Error('本地订阅最多保存 1000 条，新增内容尚未保存。')
  const raw = JSON.stringify(value)
  if (raw.length > MAX_LOCAL_SUBSCRIPTION_LENGTH)
    throw new Error('本地订阅内容超过存储格式上限，内容尚未保存；原始数据保持不变。')
  parseLocalSubscriptions(raw)
  return raw
}
