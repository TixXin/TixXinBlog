/** @file local.ts @description 访客订阅的版本化存储校验；损坏数据保留原文，历史迁移不补造过去价格 */
import { appendPriceHistory, isDate, validatePricing, validatePriceHistory } from '@tixxin/subscription-domain'
import { categoryLabels, stateLabels } from './types'
import { currentTranslate } from '~/utils/format'
import type { SubscriptionEditable, SubscriptionItem } from './types'
export const subscriptionStorageKey = 'blog-my-subscriptions'
export const MAX_LOCAL_SUBSCRIPTIONS = 1000
export const MAX_LOCAL_SUBSCRIPTION_LENGTH = 5000000
/** 按调用时的界面语言生成本机订阅错误，对应字典 misc.subscription.local.* */
function localError(key: string, params?: Record<string, unknown>) {
  return new Error(currentTranslate()(`misc.subscription.local.${key}`, params))
}
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
    throw localError('urlInvalid')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw localError('urlInvalid')
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw localError('urlUnsafe')
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
    throw localError('fieldsInvalid')
  safeSubscriptionUrl(value.url)
  if (
    (value.startDate !== null && !isDate(value.startDate)) ||
    (value.nextBillingDate !== null && !isDate(value.nextBillingDate))
  )
    throw localError('dateInvalid')
  if (value.startDate && value.nextBillingDate && value.nextBillingDate < value.startDate)
    throw localError('nextBeforeStart')
  if (value.priceChangeReason && value.priceChangeReason.length > 500) throw localError('reasonTooLong', { max: 500 })
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
    throw localError('corrupted')
  }
}

/** 写入和读取使用相同边界，拒绝制造刷新后无法读取的本机内容。 */
export function serializeLocalSubscriptions(value: LocalSubscriptions): string {
  if (value.items.length > MAX_LOCAL_SUBSCRIPTIONS) throw localError('tooMany', { max: MAX_LOCAL_SUBSCRIPTIONS })
  const raw = JSON.stringify(value)
  if (raw.length > MAX_LOCAL_SUBSCRIPTION_LENGTH) throw localError('tooLarge')
  parseLocalSubscriptions(raw)
  return raw
}
