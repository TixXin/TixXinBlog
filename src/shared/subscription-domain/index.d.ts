/** @file index.d.ts @description 前后端共用的订阅领域契约，所有金额均为对应币种最小单位 */
export type Currency = 'CNY' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'HKD' | 'TWD'
export type SubscriptionCategory =
  'development' | 'cloud' | 'entertainment' | 'productivity' | 'ai' | 'communication' | 'education' | 'design' | 'other'
export type BillingCycle =
  'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'biennial' | 'triennial' | 'lifetime' | 'one-time'
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'trial' | 'expired'
export type PublicationStatus = 'draft' | 'published' | 'withdrawn'
export const CURRENCIES: readonly Currency[]
export const CURRENCY_DIGITS: Readonly<Record<Currency, number>>
export const SUBSCRIPTION_CATEGORIES: readonly SubscriptionCategory[]
export const BILLING_CYCLES: readonly BillingCycle[]
export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[]
export const PUBLICATION_STATUSES: readonly PublicationStatus[]
export const MAX_AMOUNT: number
/** 周期付费的月数；买断与一次性不在表中 */
export const CYCLE_MONTHS: Readonly<Record<Exclude<BillingCycle, 'lifetime' | 'one-time'>, number>>
export interface Pricing {
  amount: number
  currency: Currency
  billingCycle: BillingCycle
}
export interface PriceHistoryEntry extends Pricing {
  id: string
  effectiveAt: string
  recordedAt: string
  reason?: string
}
export interface SubscriptionLike extends Pricing {
  id: string | number
  name: string
  category: SubscriptionCategory
  subscriptionStatus: SubscriptionStatus
  startDate: string | null
  nextBillingDate: string | null
  /** 试用到期（首次扣费）日；未填写时试用记录不进入预测 */
  trialEndDate?: string | null
  /** 服务结束日：当天及之后不再扣费 */
  endDate?: string | null
  /** 价格历史；缺省时累计花费按当前价格估算 */
  priceHistory?: readonly PriceHistoryEntry[]
}
export interface UpcomingPayment {
  id: string | number
  name: string
  date: string
  amount: number
  currency: Currency
  overdue: boolean
  /** 试用到期转正的首次扣费 */
  trial: boolean
}
export interface CurrencyStats {
  currency: Currency
  count: number
  activeCount: number
  recurringCount: number
  annualAmount: number
  monthlyAmount: number
  oneTimeAmount: number
  categories: { category: SubscriptionCategory; count: number; annualAmount: number }[]
  forecast: { month: string; amount: number }[]
  upcoming: UpcomingPayment[]
}
export interface SpendingStats {
  currency: Currency
  /** 截至今天的累计花费估算 */
  amount: number
  /** 缺少开始日期等信息、无法估算的记录数 */
  unknownCount: number
  years: { year: number; amount: number }[]
}
export interface PriceChange {
  id: string | number
  name: string
  date: string
  currency: Currency
  billingCycle: BillingCycle
  fromAmount: number
  toAmount: number
  reason?: string
}
export interface Charge {
  /** 一次性/买断缺少日期时为 null */
  date: string | null
  amount: number
  currency: Currency
}
export interface SubscriptionStats {
  asOf: string
  total: number
  activeCount: number
  recurringCount: number
  categoryCount: number
  currencies: CurrencyStats[]
  spending: SpendingStats[]
  priceChanges: PriceChange[]
}
/** 博主手填参考汇率：rates[币种] 为“1 单位该币种折合多少基准币种”的十进制字符串 */
export interface RateConfig {
  base: Currency
  rates: Partial<Record<Currency, string>>
}
export function isDate(value: unknown): value is string
/** 指定时区（IANA 名）的当天日期 YYYY-MM-DD；不传时区按 UTC */
export function todayDate(timeZone?: string, now?: Date): string
export function addMonths(date: string, months: number, anchorDay?: number): string
export function addDays(date: string, days: number): string
export function parseAmount(input: string, currency: Currency): number
export function amountInput(amount: number, currency: Currency): string
export function formatAmount(amount: number, currency: Currency): string
export function validatePricing(value: unknown): asserts value is Pricing
export function validatePriceHistory(history: unknown, current?: Pricing, referenceTime?: string): PriceHistoryEntry[]
export function appendPriceHistory(
  history: readonly PriceHistoryEntry[],
  next: Pricing,
  options: {
    id: string
    recordedAt: string
    effectiveAt?: string
    reason?: string
  },
): PriceHistoryEntry[]
export function validateRecord(record: SubscriptionLike): void
export function statistics(
  records: readonly SubscriptionLike[],
  today?: string,
  options?: { rollForward?: boolean },
): SubscriptionStats
export function nextChargeDate(record: SubscriptionLike, today: string): string | null
/** 今天起 months（缺省 12）个月内的扣费日，最多 60 个 */
export function scheduleDates(record: SubscriptionLike, today: string, months?: number): string[]
export function isOverdue(record: SubscriptionLike, today: string): boolean
/** “已续费”后的下次扣费日；无周期或没有下次扣费日时为 null */
export function advanceBilling(record: SubscriptionLike): string | null
/** 截至今天的扣费估算；缺少日期无法估算时为 null */
export function charges(record: SubscriptionLike, today: string): Charge[] | null
export function priceChanges(record: SubscriptionLike): PriceChange[]
export function parseRate(input: string): bigint
export function validateRates(value: unknown): RateConfig
export function convertAmount(amount: number, currency: Currency, config: RateConfig | null): number | null
