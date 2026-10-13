/** @file query.ts @description 订阅费用的 URL 筛选和本地查询，金额仅在币种分组内部比较 */
import { categoryLabels, stateLabels, currencyOptions } from './types'
import type { SubscriptionItem, SubscriptionQuery } from './types'
export function subscriptionQuery(query: Record<string, unknown>): SubscriptionQuery {
  const page = Number(query.page)
  return {
    q: typeof query.q === 'string' ? query.q.trim().slice(0, 200) || undefined : undefined,
    category: Object.hasOwn(categoryLabels, String(query.category))
      ? (query.category as SubscriptionQuery['category'])
      : undefined,
    currency: currencyOptions.includes(query.currency as never)
      ? (query.currency as SubscriptionQuery['currency'])
      : undefined,
    subscriptionStatus: Object.hasOwn(stateLabels, String(query.subscriptionStatus))
      ? (query.subscriptionStatus as SubscriptionQuery['subscriptionStatus'])
      : undefined,
    sort: ['amount-asc', 'amount-desc'].includes(String(query.sort))
      ? (query.sort as SubscriptionQuery['sort'])
      : 'manual',
    page: Number.isInteger(page) && page > 0 && page <= 10000 ? page : 1,
    pageSize: 12,
  }
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
