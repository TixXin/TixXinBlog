<!-- @file Stats.vue @description 单币种月均预算与分类年化开销，统计说明和完整文字明细按需展开 -->
<template>
  <section class="subscription-overview" aria-label="订阅费用统计" :data-currency="currency">
    <div class="subscription-overview__main">
      <div class="subscription-budget">
        <div class="subscription-budget__heading">
          <h2>{{ currency }} 月均预算</h2>
          <button
            type="button"
            class="subscription-budget__info"
            aria-label="查看预算统计口径"
            :aria-expanded="methodOpen"
            :aria-controls="methodId"
            @click="methodOpen = !methodOpen"
          >
            <Icon name="lucide:info" size="18" />
          </button>
        </div>
        <p class="subscription-budget__amount" :aria-label="`${formatAmount(monthlyAmount, currency)} 每月预算`">
          <strong :class="{ 'subscription-budget__number--long': monthlyNumber.length > 10 }">{{
            monthlyNumber
          }}</strong
          ><span>/ 月</span>
        </p>
        <p class="subscription-budget__annual">
          年化 {{ formatAmount(annualAmount, currency) }}<span aria-hidden="true"> · </span
          ><span>{{ selected?.recurringCount ?? 0 }} 项持续订阅</span>
        </p>
      </div>
      <figure class="subscription-breakdown">
        <figcaption>年化费用构成 · {{ currency }}</figcaption>
        <ClientOnly v-if="positiveCategories.length">
          <LazySubscriptionChart
            kind="bar"
            horizontal
            :height="chartHeight"
            :labels="positiveCategories.map((item) => categoryLabels[item.category])"
            :values="positiveCategories.map((item) => Number(amountInput(item.annualAmount, currency)))"
            :formatted-values="positiveCategories.map((item) => amountNumber(item.annualAmount))"
            :currency="currency"
            :label="`${currency}分类年化费用横向条形图；完整金额可在分类明细中阅读`"
          />
          <template #fallback
            ><div class="subscription-breakdown__loading" :style="{ minHeight: `${chartHeight}px` }" role="status">
              正在载入分类开销，金额可在下方明细查看。
            </div></template
          >
        </ClientOnly>
        <p v-else class="subscription-breakdown__empty">
          {{ selected?.count ? '当前币种没有非零持续费用。' : `当前筛选下没有 ${currency} 订阅。` }}
        </p>
        <details class="subscription-disclosure">
          <summary>查看分类明细<Icon name="lucide:chevron-down" size="14" /></summary>
          <ul v-if="selected?.categories.length" class="subscription-breakdown__list">
            <li v-for="category in orderedCategories" :key="category.category">
              <span
                >{{ categoryLabels[category.category] }}<small>{{ category.count }} 条记录</small></span
              ><strong>{{ formatAmount(category.annualAmount, currency) }} / 年</strong>
            </li>
          </ul>
          <p v-else>当前筛选下没有分类记录。</p>
        </details>
      </figure>
    </div>
    <div v-if="methodOpen" :id="methodId" class="subscription-budget__method" role="region" aria-label="预算统计口径">
      <p>
        统计截至 {{ stats.asOf }}（UTC 日期），涵盖当前筛选下全部匹配的 {{ currency }} 订阅，共
        {{ selected?.count ?? 0 }} 条。不同币种分别计算，不做汇率换算。
      </p>
      <p>
        持续费用仅计入已开始的活跃月付、季付、年付订阅。月均为年化预算除以
        12，实际扣费按计费周期发生；暂停、取消、试用、过期和未来开始的记录不计入当前预算。
      </p>
      <p>
        一次性与买断不计入持续费用，记录金额为
        {{ formatAmount(selected?.oneTimeAmount ?? 0, currency) }}，不代表已支付总额。
      </p>
    </div>
  </section>
</template>
<script setup lang="ts">
import { formatAmount, amountInput } from '@tixxin/subscription-domain'
import { categoryLabels } from '~/features/subscription/types'
import type { SubscriptionStats, SubscriptionCurrency } from '~/features/subscription/types'
const props = defineProps<{ stats: SubscriptionStats; currency: SubscriptionCurrency }>()
const methodId = useId(),
  methodOpen = ref(false)
const selected = computed(() => props.stats.currencies.find((item) => item.currency === props.currency))
const monthlyAmount = computed(() => selected.value?.monthlyAmount ?? 0)
const annualAmount = computed(() => selected.value?.annualAmount ?? 0)
const amountNumber = (amount: number) => formatAmount(amount, props.currency).slice(props.currency.length + 1)
const monthlyNumber = computed(() => amountNumber(monthlyAmount.value))
const orderedCategories = computed(() =>
  [...(selected.value?.categories ?? [])].sort((a, b) => b.annualAmount - a.annualAmount),
)
const positiveCategories = computed(() => orderedCategories.value.filter((item) => item.annualAmount > 0))
const chartHeight = computed(() => Math.max(108, positiveCategories.value.length * 42 + 12))
</script>
<style scoped lang="scss">
.subscription-overview {
  min-width: 0;
  color: var(--text-main);
  container-type: inline-size;
}
.subscription-overview__main {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 2rem;
  align-items: start;
  padding-block: 0.5rem;
}
.subscription-budget {
  min-width: 0;
  align-self: stretch;
  border-right: 1px solid var(--border);
  padding-right: 1.75rem;
}
.subscription-budget__heading {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 44px;
}
.subscription-budget__heading h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 650;
}
.subscription-budget__info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  color: var(--text-soft);
  background: transparent;
  border: 0;
  border-radius: 0.5rem;
  cursor: var(--interaction-cursor, pointer);
}
.subscription-budget__info:hover,
.subscription-budget__info[aria-expanded='true'] {
  color: var(--accent-text, var(--accent));
  background: var(--accent-soft);
}
.subscription-budget__info:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.subscription-budget__amount {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.65rem;
  margin: 0.1rem 0 0.6rem;
  min-width: 0;
}
.subscription-budget__amount strong {
  max-width: 100%;
  font-size: clamp(3.25rem, 8cqi, 5.25rem);
  font-weight: 720;
  letter-spacing: -0.045em;
  font-variant-numeric: tabular-nums;
  line-height: 1.07;
  overflow-wrap: anywhere;
}
.subscription-budget__amount strong.subscription-budget__number--long {
  font-size: clamp(1.75rem, 4.5cqi, 3rem);
}
.subscription-budget__amount > span {
  font-size: 1.15rem;
  color: var(--text-soft);
  white-space: nowrap;
}
.subscription-budget__annual {
  margin: 0.75rem 0 0;
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--text-soft);
  overflow-wrap: anywhere;
}
.subscription-budget__annual > span:last-child {
  white-space: nowrap;
}
.subscription-breakdown {
  min-width: 0;
  margin: 0;
}
.subscription-breakdown figcaption {
  min-height: 44px;
  display: flex;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 600;
}
.subscription-breakdown__loading,
.subscription-breakdown__empty {
  min-height: 108px;
  display: flex;
  align-items: center;
  margin: 0;
  color: var(--text-soft);
  font-size: 0.875rem;
  line-height: 1.7;
}
.subscription-disclosure summary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 36px;
  font-size: 0.75rem;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);
  list-style: none;
}
.subscription-disclosure summary::-webkit-details-marker {
  display: none;
}
.subscription-disclosure[open] summary .iconify {
  transform: rotate(180deg);
}
.subscription-breakdown__list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
}
.subscription-breakdown__list li {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
  padding-block: 0.65rem;
  border-top: 1px solid var(--border);
  font-size: 0.8125rem;
}
.subscription-breakdown__list li > span {
  min-width: 0;
}
.subscription-breakdown__list small {
  display: block;
  padding-top: 0.2rem;
  font-size: 0.75rem;
  color: var(--text-soft);
}
.subscription-breakdown__list strong {
  font-weight: 500;
  text-align: right;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.subscription-budget__method {
  padding-block: 1rem 0.25rem;
  border-top: 1px solid var(--border);
  margin-top: 1rem;
}
.subscription-budget__method p,
.subscription-disclosure > p {
  margin: 0 0 0.5rem;
  color: var(--text-soft);
  font-size: 0.8125rem;
  line-height: 1.8;
}
@container (max-width: 620px) {
  .subscription-overview__main {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.1rem;
  }
  .subscription-budget {
    border-right: 0;
    border-bottom: 1px solid var(--border);
    padding: 0 0 1rem;
  }
  .subscription-budget__amount strong {
    font-size: clamp(3.25rem, 15cqi, 4.5rem);
  }
  .subscription-budget__amount strong.subscription-budget__number--long {
    font-size: clamp(1.75rem, 8cqi, 2.75rem);
  }
}
</style>
