/** @file query.ts @description 订阅费用的 URL 筛选和本地查询，金额仅在币种分组内部比较 */
import { categoryOptions, currencyOptions, isOneOf, stateOptions } from './types'
import type { SubscriptionItem, SubscriptionQuery } from './types'
export function subscriptionQuery(query: Record<string, unknown>): SubscriptionQuery {
  const page = Number(query.page)
  return {
    q: typeof query.q === 'string' ? query.q.trim().slice(0, 200) || undefined : undefined,
    category: isOneOf(categoryOptions, query.category) ? query.category : undefined,
    currency: isOneOf(currencyOptions, query.currency) ? query.currency : undefined,
    subscriptionStatus: isOneOf(stateOptions, query.subscriptionStatus) ? query.subscriptionStatus : undefined,
    sort: ['amount-asc', 'amount-desc'].includes(String(query.sort))
      ? (query.sort as SubscriptionQuery['sort'])
      : 'manual',
    page: Number.isInteger(page) && page > 0 && page <= 10000 ? page : 1,
    pageSize: 12,
  }
}
// 公开预算页始终使用单一币种；后台仍可使用不限定币种的通用查询。
export function publicSubscriptionQuery(query: Record<string, unknown>): SubscriptionQuery {
  const parsed = subscriptionQuery(query)
  return { ...parsed, currency: parsed.currency ?? 'USD' }
}
export function filterSubscriptions<T extends SubscriptionItem>(items: T[], query: SubscriptionQuery): T[] {
  const keyword = query.q?.toLocaleLowerCase('zh-CN')
  return items
    .filter(
      (item) =>
        (!query.category || item.category === query.category) &&
        (!query.currency || item.currency === query.currency) &&
        (!query.subscriptionStatus || item.subscriptionStatus === query.subscriptionStatus) &&
        (!keyword ||
          `${item.name} ${item.description} ${item.platform ?? ''}`.toLocaleLowerCase('zh-CN').includes(keyword)),
    )
    .sort((a, b) => {
      const group = a.currency.localeCompare(b.currency)
      if (group) return group
      if (query.sort === 'amount-asc') return a.amount - b.amount
      if (query.sort === 'amount-desc') return b.amount - a.amount
      return 0
    })
}
