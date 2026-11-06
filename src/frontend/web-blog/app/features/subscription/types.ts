/** @file types.ts @description 平台订阅费领域与接口契约，业务状态和公开状态严格分离 */
import {
  BILLING_CYCLES,
  CURRENCIES,
  PUBLICATION_STATUSES,
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_STATUSES,
} from '@tixxin/subscription-domain'
import type {
  BillingCycle,
  Currency,
  SubscriptionCategory as DomainCategory,
  SubscriptionStatus,
  PublicationStatus,
  PausedPeriod,
  PriceHistoryEntry,
  RateConfig,
  SubscriptionLike,
  SubscriptionStats as DomainStats,
} from '@tixxin/subscription-domain'
export type * from '@tixxin/subscription-domain'
// 枚举取值统一来自领域包；界面名称在 labels.ts 按语言取字典，不在这里维护第二份清单。
export const categoryOptions = SUBSCRIPTION_CATEGORIES
export const cycleOptions = BILLING_CYCLES
export const stateOptions = SUBSCRIPTION_STATUSES
export const publicationOptions = PUBLICATION_STATUSES
export const currencyOptions = CURRENCIES
/** 判断任意输入是否为给定枚举之一，并收窄类型 */
export const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (options as readonly string[]).includes(value)
export type SubscriptionCategory = DomainCategory
export type SubscriptionCycle = BillingCycle
export type SubscriptionState = SubscriptionStatus
export type SubscriptionCurrency = Currency
export type SubscriptionPublication = PublicationStatus
export type SubscriptionPrice = PriceHistoryEntry
export interface SubscriptionFields {
  name: string
  description: string
  url: string | null
  platform: string | null
  category: SubscriptionCategory
  currency: SubscriptionCurrency
  amount: number
  billingCycle: SubscriptionCycle
  startDate: string | null
  nextBillingDate: string | null
  /** 试用到期（首次扣费）日 */
  trialEndDate: string | null
  /** 服务结束日：当天及之后不再扣费 */
  endDate: string | null
  /** 暂停区间：[from, to) 内不扣费 */
  pausedPeriods: PausedPeriod[]
  /** 套餐名，公开展示 */
  planName: string | null
  subscriptionStatus: SubscriptionState
}
export interface SubscriptionItem extends SubscriptionFields {
  id: number | string
  iconUrl: string | null
  faviconUrl: string | null
  priceHistory: SubscriptionPrice[]
  publishedAt: string | null
}
export interface SubscriptionEditable extends SubscriptionFields {
  notes: string
  /** 付款方式：只在后台与本机可见 */
  paymentMethod: string | null
  iconMediaId: string | null
  status: SubscriptionPublication
  sortOrder: number
  priceChangeReason?: string
}
export interface ManagedSubscription extends SubscriptionItem, SubscriptionEditable {
  id: number
  revision: number
  createdAt: string
  updatedAt: string
}
export interface SubscriptionQuery {
  q?: string
  category?: SubscriptionCategory
  currency?: SubscriptionCurrency
  subscriptionStatus?: SubscriptionState
  sort?: 'manual' | 'amount-asc' | 'amount-desc'
  page: number
  pageSize: number
}
export interface SubscriptionPage<T = SubscriptionItem> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
/** 公开统计另带计算日程所需的公开字段（records），前端按访客当天重算，静态发布冻结后日期仍正确 */
export type SubscriptionStats = DomainStats & { records?: SubscriptionLike[] }
/** 公开的参考汇率；baseCurrency 为空表示博主未启用 */
export interface SubscriptionSettings {
  baseCurrency: SubscriptionCurrency | null
  rates: Partial<Record<SubscriptionCurrency, string>>
  ratesUpdatedAt: string | null
}
export interface AdminSubscriptionSettings extends SubscriptionSettings {
  revision: number
  calendarEnabled: boolean
}
/** 领域包换算使用的汇率配置；未启用时为 null */
export const rateConfig = (settings: SubscriptionSettings | null | undefined): RateConfig | null =>
  settings?.baseCurrency ? { base: settings.baseCurrency, rates: settings.rates } : null
export interface SubscriptionForm extends Omit<SubscriptionEditable, 'amount'> {
  amountInput: string
}
