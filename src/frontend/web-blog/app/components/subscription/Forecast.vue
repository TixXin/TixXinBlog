<!-- @file Forecast.vue @description 抽屉内的单币种续费预测与扣费日期清单，统计说明和文字明细默认折叠 -->
<template>
  <section class="subscription-forecast" :aria-label="`${currency}续费预测`" :data-currency="currency">
    <header>
      <p class="subscription-forecast__eyebrow">{{ currency }} · 当前筛选</p>
      <h2>未来 12 个月预计续费</h2>
      <p>本月剩余日期及随后 11 个自然月。</p>
    </header>
    <ClientOnly v-if="forecast.length">
      <LazySubscriptionChart
        kind="line"
        :height="240"
        :labels="forecast.map((month) => month.month)"
        :values="forecast.map((month) => Number(amountInput(month.amount, currency)))"
        :formatted-values="forecast.map((month) => formatAmount(month.amount, currency).slice(currency.length + 1))"
        :currency="currency"
        :label="`${currency}未来12个月预计续费金额；文字明细可在下方展开`"
      />
      <template #fallback
        ><p class="subscription-forecast__placeholder" role="status">
          正在载入预测图，完整金额可在文字明细中查看。
        </p></template
      >
    </ClientOnly>
    <p v-else class="subscription-forecast__empty">当前筛选下没有 {{ currency }} 订阅，暂无续费预测。</p>
    <p v-if="forecast.length && !forecast.some((month) => month.amount > 0)" class="subscription-forecast__note">
      当前条件下没有非零续费预测。
    </p>
    <details class="subscription-forecast__details">
      <summary>查看预计续费文字明细<Icon name="lucide:chevron-down" size="15" /></summary>
      <ul v-if="forecast.length" class="subscription-forecast__amounts">
        <li v-for="month in forecast" :key="month.month">
          <span>{{ month.month }}</span
          ><strong>{{ formatAmount(month.amount, currency) }}</strong>
        </li>
      </ul>
      <p v-else>暂无可展示的月份记录。</p>
    </details>
    <section class="subscription-forecast__payments" aria-label="下次扣费清单">
      <h3>下次扣费清单</h3>
      <ul v-if="upcoming.length">
        <li v-for="item in upcoming" :key="item.id">
          <div>
            <strong>{{ item.name }}</strong
            ><span
              >{{ item.date
              }}<span v-if="item.overdue" class="subscription-forecast__overdue"> · 已逾期，请核对</span></span
            >
          </div>
          <strong>{{ formatAmount(item.amount, currency) }}</strong>
        </li>
      </ul>
      <p v-else class="subscription-forecast__empty">当前筛选没有可用的扣费日期。</p>
    </section>
    <details class="subscription-forecast__details">
      <summary>预测与扣费说明<Icon name="lucide:chevron-down" size="15" /></summary>
      <p>
        截至 {{ stats.asOf }}（UTC
        日期），按当前价格、状态和有效扣费日期估算，并非实际历史支出。试用、暂停、取消和过期记录不生成续费预测；缺少可靠日期的记录不会猜测扣款时间。
      </p>
      <p>
        清单展示每项订阅的下一次扣费日期，逾期记录保留原日期。这里只提供页面提醒，不会自动扣款或发送通知；其他币种需要切换后分别查看。
      </p>
    </details>
  </section>
</template>
<script setup lang="ts">
import { formatAmount, amountInput } from '@tixxin/subscription-domain'
import type { SubscriptionStats, SubscriptionCurrency } from '~/features/subscription/types'
const props = defineProps<{ stats: SubscriptionStats; currency: SubscriptionCurrency }>()
const selected = computed(() => props.stats.currencies.find((item) => item.currency === props.currency))
const forecast = computed(() => selected.value?.forecast ?? [])
const upcoming = computed(() => [...(selected.value?.upcoming ?? [])].sort((a, b) => a.date.localeCompare(b.date)))
</script>
<style scoped lang="scss">
.subscription-forecast {
  display: grid;
  gap: 1.25rem;
  min-width: 0;
  color: var(--text-main);
}
.subscription-forecast header h2 {
  margin: 0.3rem 0 0.5rem;
  font-size: 1.25rem;
  font-weight: 650;
}
.subscription-forecast header p {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.8125rem;
  line-height: 1.7;
}
.subscription-forecast .subscription-forecast__eyebrow {
  color: var(--accent-text, var(--accent));
  font-weight: 600;
}
.subscription-forecast__placeholder {
  min-height: 240px;
  display: flex;
  align-items: center;
  color: var(--text-soft);
  font-size: 0.875rem;
}
.subscription-forecast__note,
.subscription-forecast__empty {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.8125rem;
  line-height: 1.8;
}
.subscription-forecast__details {
  min-width: 0;
  border-top: 1px solid var(--border);
}
.subscription-forecast__details summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  min-height: 44px;
  color: var(--text-soft);
  font-size: 0.8125rem;
  cursor: var(--interaction-cursor, pointer);
  list-style: none;
}
.subscription-forecast__details summary::-webkit-details-marker {
  display: none;
}
.subscription-forecast__details summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.subscription-forecast__details[open] summary .iconify {
  transform: rotate(180deg);
}
.subscription-forecast__details p {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.8;
  color: var(--text-soft);
}
.subscription-forecast__amounts,
.subscription-forecast__payments ul {
  list-style: none;
  padding: 0;
  margin: 0.35rem 0 0;
}
.subscription-forecast__amounts li,
.subscription-forecast__payments li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.75rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8125rem;
}
.subscription-forecast__amounts strong,
.subscription-forecast__payments li > strong {
  font-weight: 550;
  text-align: right;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.subscription-forecast__payments h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}
.subscription-forecast__payments li > div {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.subscription-forecast__payments li > div > strong {
  font-weight: 550;
  overflow-wrap: anywhere;
}
.subscription-forecast__payments li > div > span {
  font-size: 0.75rem;
  color: var(--text-soft);
}
.subscription-forecast__overdue {
  color: var(--accent-text, var(--accent));
}
</style>
