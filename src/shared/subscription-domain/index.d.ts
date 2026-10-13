/** @file index.d.ts @description 前后端共用的订阅领域契约，所有金额均为对应币种最小单位 */
export type Currency = 'CNY' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'HKD' | 'TWD'
export type SubscriptionCategory =
  'development' | 'cloud' | 'entertainment' | 'productivity' | 'ai' | 'communication' | 'education' | 'design' | 'other'
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'lifetime' | 'one-time'
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'trial' | 'expired'
export type PublicationStatus = 'draft' | 'published' | 'withdrawn'
export const CURRENCIES: readonly Currency[]
export const CURRENCY_DIGITS: Readonly<Record<Currency, number>>
export const SUBSCRIPTION_CATEGORIES: readonly SubscriptionCategory[]
export const BILLING_CYCLES: readonly BillingCycle[]
export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[]
export const PUBLICATION_STATUSES: readonly PublicationStatus[]
export const MAX_AMOUNT: number
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
}
export interface UpcomingPayment {
  id: string | number
  name: string
  date: string
  amount: number
  currency: Currency
  overdue: boolean
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
export interface SubscriptionStats {
  asOf: string
  total: number
  activeCount: number
  recurringCount: number
  categoryCount: number
  currencies: CurrencyStats[]
}
export function isDate(value: unknown): value is string
export function todayDate(): string
export function addMonths(date: string, months: number, anchorDay?: number): string
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
export function statistics(records: readonly SubscriptionLike[], today?: string): SubscriptionStats
