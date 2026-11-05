/** @file useSubscriptionEstimate.ts @description 参考汇率折合估算：客户端读取博主公开的参考汇率，把各币种月均预算折合为基准币种总额 */
import { convertAmount, statistics } from '@tixxin/subscription-domain'
import type { CurrencyStats, SubscriptionLike } from '@tixxin/subscription-domain'
import { rateConfig } from '~/features/subscription/types'
import type { SubscriptionCurrency, SubscriptionSettings } from '~/features/subscription/types'

export interface SubscriptionEstimate {
  base: SubscriptionCurrency
  /** 全部币种月均预算折合基准币种的合计（最小单位） */
  monthly: number
  /** 有预算但未填写汇率、未计入合计的币种 */
  missing: SubscriptionCurrency[]
  updatedAt: string | null
}

export function useSubscriptionEstimate(options: {
  mode: Ref<'blog' | 'local'>
  localItems: Ref<readonly SubscriptionLike[]>
  today: Ref<string>
}) {
  const repo = useSubscriptionRepository()
  const settings = ref<SubscriptionSettings | null>(null)
  const blogCurrencies = ref<CurrencyStats[] | null>(null)
  // 估算是附加信息：只在客户端读取，失败时静默不显示，不影响预算与清单。
  onMounted(async () => {
    try {
      settings.value = await repo.settings()
      if (!settings.value.baseCurrency) return
      // 不带币种与筛选的全量统计，用于跨币种合计
      const all = await repo.stats({ page: 1, pageSize: 12 })
      blogCurrencies.value = all.records
        ? statistics(all.records, options.today.value, { rollForward: true }).currencies
        : all.currencies
    } catch {
      settings.value = null
    }
  })
  const config = computed(() => rateConfig(settings.value))
  const localCurrencies = computed(() => {
    try {
      return statistics(options.localItems.value, options.today.value).currencies
    } catch {
      return null
    }
  })
  const estimate = computed<SubscriptionEstimate | null>(() => {
    const value = config.value
    const currencies = options.mode.value === 'blog' ? blogCurrencies.value : localCurrencies.value
    if (!value || !currencies) return null
    let monthly = 0
    const missing: SubscriptionCurrency[] = []
    for (const item of currencies) {
      if (!item.monthlyAmount) continue
      const converted = convertAmount(item.monthlyAmount, item.currency, value)
      if (converted === null) missing.push(item.currency)
      else monthly += converted
    }
    return { base: value.base, monthly, missing, updatedAt: settings.value?.ratesUpdatedAt ?? null }
  })
  return { config, estimate }
}
