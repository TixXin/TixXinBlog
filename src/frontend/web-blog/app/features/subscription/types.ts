/** @file types.ts @description 平台订阅费领域与接口契约，业务状态和公开状态严格分离 */
import type {
  BillingCycle,
  Currency,
  SubscriptionCategory as DomainCategory,
  SubscriptionStatus,
  PublicationStatus,
  PriceHistoryEntry,
  SubscriptionStats as DomainStats,
} from '@tixxin/subscription-domain'
export type * from '@tixxin/subscription-domain'
export const categoryLabels = {
  development: '开发工具',
  cloud: '云服务',
  entertainment: '影音娱乐',
  productivity: '效率工具',
  ai: '人工智能',
  communication: '通信',
  education: '学习教育',
  design: '设计',
  other: '其他',
} as const
export const cycleLabels = {
  monthly: '月付',
  quarterly: '季付',
  yearly: '年付',
  lifetime: '买断',
  'one-time': '一次性',
} as const
export const stateLabels = {
  active: '活跃',
  paused: '暂停',
  cancelled: '已取消',
  trial: '试用',
  expired: '已过期',
} as const
export const publicationLabels = { draft: '草稿', published: '已公开', withdrawn: '已撤回' } as const
export const currencyOptions = ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'TWD'] as const
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
export type SubscriptionStats = DomainStats
export interface SubscriptionForm extends Omit<SubscriptionEditable, 'amount'> {
  amountInput: string
}
