/** @file content-package-subscriptions.ts @description v11 起的订阅格式严格校验，保存价格事实并拒绝管理身份与伪造缓存来源；v18 起携带试用到期日与结束日；v20 起携带暂停区间、套餐名与付款方式。 */
import { BadRequestException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { isISO8601, validateSync } from 'class-validator'
import { validatePriceHistory } from '@tixxin/subscription-domain'
import type {
  PausedPeriod,
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
    trialEndDate: string | null
    endDate: string | null
    pausedPeriods: PausedPeriod[]
    planName: string | null
    paymentMethod: string | null
    subscriptionStatus: SubscriptionStatus
    notes: string
    iconMediaId: string | null
    faviconDomain: string | null
    priceHistory: PriceHistoryEntry[]
    status: PublicationStatus
    sortOrder: number
  }
}
/** 订阅 values 携带 trialEndDate、endDate 的首个内容包版本；更早版本出现即按未知字段拒绝 */
export const SUBSCRIPTION_SCHEDULE_VERSION = 18
const scheduleKeys = ['trialEndDate', 'endDate']
/** 订阅 values 携带暂停区间、套餐名与付款方式的首个内容包版本 */
export const SUBSCRIPTION_PLAN_VERSION = 20
const planKeys = ['pausedPeriods', 'planName', 'paymentMethod']
/** 该版本订阅 values 允许且必须携带的字段 */
function subscriptionKeys(version: number) {
  return [
    ...valueKeys,
    ...(version >= SUBSCRIPTION_SCHEDULE_VERSION ? scheduleKeys : []),
    ...(version >= SUBSCRIPTION_PLAN_VERSION ? planKeys : []),
  ]
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
/** 源编号必须是范围内且不重复的正整数 */
function sourceId(value: unknown, seen: Set<number>, path: string): number {
  const id = Number(value)
  if (!Number.isSafeInteger(value) || id < 1 || id > 2147483647 || seen.has(id))
    throw new BadRequestException(msg('package.subscriptionIdInvalid', { path }))
  seen.add(id)
  return id
}
/** 旧版本没有的后加字段补为缺省值，使新旧包与现有记录的内容哈希可比 */
function laterFields(values: {
  trialEndDate?: string | null
  endDate?: string | null
  pausedPeriods?: PausedPeriod[]
  planName?: string | null
  paymentMethod?: string | null
}) {
  return {
    trialEndDate: values.trialEndDate ?? null,
    endDate: values.endDate ?? null,
    pausedPeriods: values.pausedPeriods ?? [],
    planName: values.planName ?? null,
    paymentMethod: values.paymentMethod ?? null,
  }
}
export function parsePackageSubscriptions(input: unknown, version: number): PackageSubscription[] {
  const keys = subscriptionKeys(version)
  if (!Array.isArray(input) || input.length > 3000) return fail('subscriptions')
  const seen = new Set<number>()
  return input.map((value, index): PackageSubscription => {
    const path = `subscriptions[${index}]`
    const row = strictRecord(value, ['sourceId', 'createdAt', 'publishedAt', 'deleted', 'values'], path)
    const id = sourceId(row.sourceId, seen, path)
    if (typeof row.deleted !== 'boolean') fail(`${path}.deleted`)
    const raw = strictRecord(row.values, keys, `${path}.values`)
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
      sourceId: id,
      createdAt: timestamp(row.createdAt, `${path}.createdAt`),
      publishedAt: row.publishedAt === null ? null : timestamp(row.publishedAt, `${path}.publishedAt`),
      deleted: row.deleted,
      values: {
        ...normalized,
        ...laterFields(normalized),
        iconMediaId: normalized.iconMediaId?.toLowerCase() ?? null,
        priceHistory: history,
        faviconDomain: domain,
      } as PackageSubscription['values'],
    }
  })
}
