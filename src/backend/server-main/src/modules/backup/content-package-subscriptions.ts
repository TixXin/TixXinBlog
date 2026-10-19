/** @file content-package-subscriptions.ts @description v11 订阅格式严格校验，保存价格事实并拒绝管理身份与伪造缓存来源。 */
import { BadRequestException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { isISO8601, validateSync } from 'class-validator'
import { validatePriceHistory } from '@tixxin/subscription-domain'
import type {
  PriceHistoryEntry,
  Pricing,
  PublicationStatus,
  SubscriptionCategory,
  SubscriptionStatus,
} from '@tixxin/subscription-domain'
import { SaveSubscriptionDto } from '../subscription/subscription.dto'
import { faviconDomain, subscriptionValues } from '../subscription/subscription-values'
import { msg } from '../../common/i18n'

export interface PackageSubscription {
  sourceId: number
  createdAt: string
  publishedAt: string | null
  deleted: boolean
  values: Pricing & {
    name: string
    description: string
    url: string | null
    platform: string | null
    category: SubscriptionCategory
    startDate: string | null
    nextBillingDate: string | null
    subscriptionStatus: SubscriptionStatus
    notes: string
    iconMediaId: string | null
    faviconDomain: string | null
    priceHistory: PriceHistoryEntry[]
    status: PublicationStatus
    sortOrder: number
  }
}
const valueKeys = [
  'name',
  'description',
  'url',
  'platform',
  'category',
  'currency',
  'amount',
  'billingCycle',
  'startDate',
  'nextBillingDate',
  'subscriptionStatus',
  'notes',
  'iconMediaId',
  'faviconDomain',
  'priceHistory',
  'status',
  'sortOrder',
]
function fail(path: string): never {
  throw new BadRequestException(msg('package.invalidField', { path }))
}
function strictRecord(value: unknown, keys: string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path)
  const row = value as Record<string, unknown>
  if (Object.keys(row).some((key) => !keys.includes(key)) || keys.some((key) => row[key] === undefined))
    return fail(path)
  return row
}
function timestamp(value: unknown, path: string) {
  if (
    typeof value !== 'string' ||
    value.length > 40 ||
    !isISO8601(value, { strict: true }) ||
    !Number.isFinite(Date.parse(value))
  )
    return fail(path)
  return new Date(value).toISOString()
}
export function parsePackageSubscriptions(input: unknown): PackageSubscription[] {
  if (!Array.isArray(input) || input.length > 3000) return fail('subscriptions')
  const seen = new Set<number>()
  return input.map((value, index): PackageSubscription => {
    const path = `subscriptions[${index}]`
    const row = strictRecord(value, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values'], path)
    if (
      !Number.isSafeInteger(row.sourceId) ||
      Number(row.sourceId) < 1 ||
      Number(row.sourceId) > 2147483647 ||
      seen.has(Number(row.sourceId))
    )
      throw new BadRequestException(msg('package.subscriptionIdInvalid', { path }))
    seen.add(Number(row.sourceId))
    if (typeof row.deleted !== 'boolean') fail(`${path}.deleted`)
    const raw = strictRecord(row.values, valueKeys, `${path}.values`)
    const { priceHistory, faviconDomain: domain, ...editable } = raw
    const dto = plainToInstance(SaveSubscriptionDto, editable)
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length) fail(`${path}.values`)
    const normalized = subscriptionValues(dto)
    let history: PriceHistoryEntry[]
    try {
      history = validatePriceHistory(priceHistory, normalized as Pricing)
      if (
        domain !== null &&
        (typeof domain !== 'string' || !normalized.url || faviconDomain(normalized.url) !== domain)
      )
        fail(`${path}.faviconDomain`)
    } catch {
      throw new BadRequestException(msg('package.subscriptionHistoryInvalid', { path }))
    }
    return {
      sourceId: Number(row.sourceId),
      createdAt: timestamp(row.createdAt, `${path}.createdAt`),
      publishedAt: row.publishedAt === null ? null : timestamp(row.publishedAt, `${path}.publishedAt`),
      deleted: row.deleted,
      values: {
        ...normalized,
        iconMediaId: normalized.iconMediaId?.toLowerCase() ?? null,
        priceHistory: history,
        faviconDomain: domain,
      } as PackageSubscription['values'],
    }
  })
}
