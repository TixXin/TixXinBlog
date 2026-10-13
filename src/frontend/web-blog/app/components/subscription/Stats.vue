<!-- @file Stats.vue @description 当前筛选范围的分币种预算、数量和 ECharts 图表，无跨币种金额运算 -->
<template>
  <section class="subscription-ui subscription-stack" aria-label="订阅费用统计">
    <div class="subscription-row">
      <h2>当前筛选统计</h2>
      <span class="subscription-note"
        >{{ stats.total }} 条 · 活跃 {{ stats.activeCount }} 条 · {{ stats.categoryCount }} 个分类</span
      >
    </div>
    <p class="subscription-note">
      {{ stats.asOf }}（UTC 日期） · 持续费用仅计入已开始的活跃月付、季付、年付，共
      {{ stats.recurringCount }} 条。币种分别统计；月均为年化预算除以 12，实际扣费按周期发生。
    </p>
    <div class="subscription-grid">
      <article
        v-for="currency in stats.currencies"
        :key="currency.currency"
        class="subscription-panel subscription-totals"
        :data-currency="currency.currency"
      >
        <h3>{{ currency.currency }}</h3>
        <span>月均预算</span><strong>{{ formatAmount(currency.monthlyAmount, currency.currency) }}</strong
        ><span>年化预算 {{ formatAmount(currency.annualAmount, currency.currency) }}</span
        ><small>{{ currency.count }} 条记录 · {{ currency.recurringCount }} 条计入持续费用</small
        ><small v-if="currency.oneTimeAmount"
          >一次性与买断记录金额 {{ formatAmount(currency.oneTimeAmount, currency.currency) }}</small
        >
      </article>
    </div>
    <template v-if="stats.currencies.length">
      <div class="subscription-row">
        <label class="subscription-currency-select"
          >图表币种<select v-model="selectedCurrency" aria-label="图表币种">
            <option v-for="currency in stats.currencies" :key="currency.currency" :value="currency.currency">
              {{ currency.currency }}
            </option>
          </select></label
        >
        <p class="subscription-note">图表与当前列表使用同一筛选，统计涵盖全部匹配记录。</p>
      </div>
      <template v-if="selected">
        <div class="subscription-chart-grid">
          <figure class="subscription-panel">
            <figcaption>分类费用占比 · {{ selected.currency }} 年化</figcaption>
            <ClientOnly
              ><LazySubscriptionChart
                v-if="selected.annualAmount > 0"
                kind="pie"
                :labels="categoryNames"
                :values="categoryValues"
                :currency="selected.currency"
                :label="`${selected.currency}分类年化费用占比`"
              />
              <p v-else class="subscription-zero">当前币种没有非零持续费用。</p>
              <template #fallback><p class="subscription-zero">正在载入图表，费用明细见下方。</p></template></ClientOnly
            >
          </figure>
          <figure class="subscription-panel">
            <figcaption>分类费用对比 · {{ selected.currency }} 年化</figcaption>
            <ClientOnly
              ><LazySubscriptionChart
                kind="bar"
                :labels="categoryNames"
                :values="categoryValues"
                :currency="selected.currency"
                :label="`${selected.currency}分类年化费用条形图`"
              /><template #fallback
                ><p class="subscription-zero">正在载入图表，费用明细见下方。</p></template
              ></ClientOnly
            >
          </figure>
        </div>
        <details>
          <summary>分类费用文字明细</summary>
          <ul>
            <li v-for="category in selected.categories" :key="category.category">
              {{ categoryLabels[category.category] }}：{{ formatAmount(category.annualAmount, selected.currency) }} / 年
              · {{ category.count }} 条
            </li>
          </ul>
        </details>
        <figure class="subscription-panel">
          <figcaption>未来 12 个月预计续费金额 · {{ selected.currency }}</figcaption>
          <p class="subscription-note">
            统计窗口为本月剩余日期及随后 11
            个自然月。基于当前价格、状态和有效扣费日期估算，并非实际历史支出。无日期及试用、暂停、取消、过期记录不生成续费预测。
          </p>
          <ClientOnly
            ><LazySubscriptionChart
              kind="line"
              :labels="selected.forecast.map((item) => item.month)"
              :values="forecastValues"
              :currency="selected.currency"
              :label="`${selected.currency}未来12个月预计续费金额`"
            /><template #fallback><p class="subscription-zero">正在载入图表，预测明细见下方。</p></template></ClientOnly
          >
          <details>
            <summary>预计续费文字明细</summary>
            <ul>
              <li v-for="month in selected.forecast" :key="month.month">
                {{ month.month }}：{{ formatAmount(month.amount, selected.currency) }}
              </li>
            </ul>
          </details>
        </figure>
      </template>
    </template>
  </section>
</template>
<script setup lang="ts">
import { formatAmount, amountInput } from '@tixxin/subscription-domain'
import { categoryLabels } from '~/features/subscription/types'
import type { SubscriptionStats, SubscriptionCurrency } from '~/features/subscription/types'
const props = defineProps<{ stats: SubscriptionStats }>()
const selectedCurrency = ref<SubscriptionCurrency | ''>('')
watch(
  () => props.stats.currencies,
  (items) => {
    if (!items.some((item) => item.currency === selectedCurrency.value))
      selectedCurrency.value = items[0]?.currency ?? ''
  },
  { immediate: true },
)
const selected = computed(() => props.stats.currencies.find((item) => item.currency === selectedCurrency.value))
const categoryNames = computed(() => selected.value?.categories.map((item) => categoryLabels[item.category]) ?? [])
const categoryValues = computed(
  () =>
    selected.value?.categories.map((item) => Number(amountInput(item.annualAmount, selected.value!.currency))) ?? [],
)
const forecastValues = computed(
  () => selected.value?.forecast.map((item) => Number(amountInput(item.amount, selected.value!.currency))) ?? [],
)
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
.subscription-totals {
  display: grid;
  gap: 0.5rem;
}
.subscription-totals > strong {
  font-size: 1.45rem;
  font-variant-numeric: tabular-nums;
}
.subscription-totals > span,
small {
  font-size: 0.8125rem;
  color: var(--text-muted);
}
.subscription-chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
figure {
  margin: 0;
}
figcaption {
  font-size: 0.875rem;
  font-weight: 600;
}
.subscription-currency-select {
  width: 150px;
}
.subscription-zero {
  min-height: 280px;
  display: grid;
  place-content: center;
}
ul {
  padding-left: 1.3rem;
  font-size: 0.8125rem;
  line-height: 1.9;
}
@media (max-width: 850px) {
  .subscription-chart-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
