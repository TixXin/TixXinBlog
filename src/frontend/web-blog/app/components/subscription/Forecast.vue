<!-- @file Forecast.vue @description 抽屉内的单币种续费预测与扣费日期清单，统计说明和文字明细默认折叠 -->
<template>
  <section
    class="subscription-forecast"
    :aria-label="$t('misc.subscription.forecast.label', { currency })"
    :data-currency="currency"
  >
    <header>
      <p class="subscription-forecast__eyebrow">{{ $t('misc.subscription.forecast.eyebrow', { currency }) }}</p>
      <h2>{{ $t('misc.subscription.forecast.title') }}</h2>
      <p>{{ $t('misc.subscription.forecast.range') }}</p>
    </header>
    <ClientOnly v-if="forecast.length">
      <LazySubscriptionChart
        kind="line"
        :height="240"
        :labels="forecast.map((month) => month.month)"
        :values="forecast.map((month) => Number(amountInput(month.amount, currency)))"
        :formatted-values="forecast.map((month) => formatAmount(month.amount, currency).slice(currency.length + 1))"
        :currency="currency"
        :label="$t('misc.subscription.forecast.chartLabel', { currency })"
      />
      <template #fallback
        ><p class="subscription-forecast__placeholder" role="status">
          {{ $t('misc.subscription.forecast.chartLoading') }}
        </p></template
      >
    </ClientOnly>
    <p v-else class="subscription-forecast__empty">{{ $t('misc.subscription.forecast.noItems', { currency }) }}</p>
    <p v-if="forecast.length && !forecast.some((month) => month.amount > 0)" class="subscription-forecast__note">
      {{ $t('misc.subscription.forecast.noPositive') }}
    </p>
    <details class="subscription-forecast__details">
      <summary>
        {{ $t('misc.subscription.forecast.amountsSummary') }}<Icon name="lucide:chevron-down" size="15" />
      </summary>
      <ul v-if="forecast.length" class="subscription-forecast__amounts">
        <li v-for="month in forecast" :key="month.month">
          <span>{{ month.month }}</span
          ><strong>{{ formatAmount(month.amount, currency) }}</strong>
        </li>
      </ul>
      <p v-else>{{ $t('misc.subscription.forecast.noMonths') }}</p>
    </details>
    <section class="subscription-forecast__payments" :aria-label="$t('misc.subscription.forecast.payments')">
      <h3>{{ $t('misc.subscription.forecast.payments') }}</h3>
      <ul v-if="upcoming.length">
        <li v-for="item in upcoming" :key="item.id">
          <div>
            <strong>{{ item.name }}</strong
            ><span
              >{{ item.date
              }}<span v-if="item.overdue" class="subscription-forecast__overdue">
                · {{ $t('misc.subscription.card.overdue') }}</span
              ></span
            >
          </div>
          <strong>{{ formatAmount(item.amount, currency) }}</strong>
        </li>
      </ul>
      <p v-else class="subscription-forecast__empty">{{ $t('misc.subscription.forecast.noPayments') }}</p>
    </section>
    <details class="subscription-forecast__details">
      <summary>
        {{ $t('misc.subscription.forecast.notesSummary') }}<Icon name="lucide:chevron-down" size="15" />
      </summary>
      <p>{{ $t('misc.subscription.forecast.notesEstimate', { asOf: stats.asOf }) }}</p>
      <p>{{ $t('misc.subscription.forecast.notesPayments') }}</p>
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
