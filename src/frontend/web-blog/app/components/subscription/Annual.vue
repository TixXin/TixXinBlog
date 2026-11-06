<!-- @file Annual.vue @description 单币种年度账单：按年估算已发生的扣费、逐项排行与当年调价记录 -->
<template>
  <section class="subscription-annual" :aria-label="$t('misc.subscription.annual.label', { currency })">
    <header>
      <p class="subscription-annual__eyebrow">{{ $t('misc.subscription.annual.eyebrow', { currency }) }}</p>
      <h2>{{ $t('misc.subscription.annual.title') }}</h2>
    </header>
    <p v-if="!years.length" class="subscription-annual__empty">
      {{ $t('misc.subscription.annual.empty', { currency }) }}
    </p>
    <template v-else>
      <div class="subscription-annual__years" role="group" :aria-label="$t('misc.subscription.annual.yearLabel')">
        <button
          v-for="year in years"
          :key="year"
          type="button"
          :aria-pressed="year === selectedYear"
          @click="pickedYear = year"
        >
          {{ year }}
        </button>
      </div>
      <p v-if="converted" class="subscription-annual__converted">
        {{ $t('misc.subscription.annual.convertedTotal', { amount: formatAmount(converted.amount, converted.base) })
        }}<span v-if="converted.missing.length">
          · {{ $t('misc.subscription.annual.convertedMissing', { currencies: converted.missing.join(' / ') }) }}</span
        >
      </p>
      <p class="subscription-annual__total">
        <strong>{{ formatAmount(yearTotal, currency) }}</strong>
        <span>{{
          $t('misc.subscription.annual.summary', { count: yearCharges, services: ranking.length }, yearCharges)
        }}</span>
      </p>
      <ol class="subscription-annual__ranking" :aria-label="$t('misc.subscription.annual.rankingLabel')">
        <li v-for="row in ranking" :key="row.id">
          <span>{{ row.name }}</span>
          <small>{{ $t('misc.subscription.annual.chargeCount', { count: row.count }, row.count) }}</small>
          <strong>{{ formatAmount(row.amount, currency) }}</strong>
        </li>
      </ol>
      <section class="subscription-annual__changes" :aria-label="$t('misc.subscription.annual.changesLabel')">
        <h3>{{ $t('misc.subscription.annual.changesTitle') }}</h3>
        <ul v-if="yearChanges.length">
          <li v-for="change in yearChanges" :key="`${change.id}-${change.date}`">
            <span
              >{{ change.name }}<small> · {{ change.date }}</small></span
            >
            <strong :class="change.toAmount > change.fromAmount ? 'is-up' : 'is-down'">
              <Icon
                :name="change.toAmount > change.fromAmount ? 'lucide:trending-up' : 'lucide:trending-down'"
                size="14"
                aria-hidden="true"
              />
              {{ formatAmount(change.fromAmount, currency) }} → {{ formatAmount(change.toAmount, currency) }}
            </strong>
          </li>
        </ul>
        <p v-else class="subscription-annual__empty">{{ $t('misc.subscription.annual.noChanges') }}</p>
      </section>
    </template>
    <p class="subscription-annual__note">{{ $t('misc.subscription.annual.note', { asOf: today }) }}</p>
  </section>
</template>
<script setup lang="ts">
import { charges, convertAmount, formatAmount } from '@tixxin/subscription-domain'
import type { Currency, PriceChange, RateConfig, SubscriptionLike } from '@tixxin/subscription-domain'
import type { SubscriptionCurrency } from '~/features/subscription/types'

const props = defineProps<{
  records: readonly SubscriptionLike[]
  priceChanges: readonly PriceChange[]
  currency: SubscriptionCurrency
  today: string
  allRecords?: readonly SubscriptionLike[]
  rates?: RateConfig | null
}>()
/** 每条记录在当前币种下、有日期的扣费；缺日期无法估算的记录不计入 */
const dated = computed(() =>
  props.records.flatMap((record) =>
    (charges(record, props.today) ?? [])
      .filter((charge) => charge.currency === props.currency && charge.date)
      .map((charge) => ({
        id: record.id,
        name: record.name,
        year: Number(charge.date!.slice(0, 4)),
        amount: charge.amount,
      })),
  ),
)
const years = computed(() => [...new Set(dated.value.map((charge) => charge.year))].sort((a, b) => b - a))
const pickedYear = ref<number | null>(null)
const selectedYear = computed(() =>
  pickedYear.value !== null && years.value.includes(pickedYear.value) ? pickedYear.value : (years.value[0] ?? null),
)
const inYear = computed(() => dated.value.filter((charge) => charge.year === selectedYear.value))
const yearTotal = computed(() => inYear.value.reduce((sum, charge) => sum + charge.amount, 0))
const yearCharges = computed(() => inYear.value.length)
const ranking = computed(() => {
  const rows = new Map<string, { id: string | number; name: string; amount: number; count: number }>()
  for (const charge of inYear.value) {
    const key = String(charge.id)
    const row = rows.get(key) ?? { id: charge.id, name: charge.name, amount: 0, count: 0 }
    row.amount += charge.amount
    row.count++
    rows.set(key, row)
  }
  return [...rows.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
})
/** 选中年份全部币种的扣费按参考汇率折合到基准币种；未启用汇率时不显示 */
const converted = computed(() => {
  const rates = props.rates,
    year = selectedYear.value
  if (!rates || year === null || !props.allRecords?.length) return null
  const totals = new Map<Currency, number>()
  for (const record of props.allRecords)
    for (const charge of charges(record, props.today) ?? [])
      if (charge.date?.startsWith(`${year}-`))
        totals.set(charge.currency, (totals.get(charge.currency) ?? 0) + charge.amount)
  if (![...totals.keys()].some((code) => code !== props.currency)) return null
  let amount = 0
  const missing: Currency[] = []
  for (const [code, value] of totals) {
    const result = convertAmount(value, code, rates)
    if (result === null) missing.push(code)
    else amount += result
  }
  return { base: rates.base, amount, missing }
})
const yearChanges = computed(() =>
  props.priceChanges.filter(
    (change) => change.currency === props.currency && Number(change.date.slice(0, 4)) === selectedYear.value,
  ),
)
</script>
<style scoped lang="scss">
.subscription-annual {
  display: grid;
  gap: 1rem;
  color: var(--text-main);
  header h2 {
    margin: 0.2rem 0 0;
    font-size: 1.35rem;
  }
}
.subscription-annual__converted {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-soft);
}
.subscription-annual__eyebrow,
.subscription-annual__note,
.subscription-annual__empty {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-soft);
}
.subscription-annual__years {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  button {
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    &[aria-pressed='true'] {
      border-color: var(--accent);
      color: var(--accent-text);
      font-weight: 600;
    }
  }
}
.subscription-annual__total {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  strong {
    font-size: 1.75rem;
    font-variant-numeric: tabular-nums;
  }
  span {
    font-size: 0.85rem;
    color: var(--text-soft);
  }
}
.subscription-annual__ranking,
.subscription-annual__changes ul {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding-bottom: 0.45rem;
    border-bottom: 1px solid var(--border);
  }
  span {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  small {
    color: var(--text-soft);
  }
  strong {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}
.subscription-annual__changes {
  display: grid;
  gap: 0.6rem;
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .is-up {
    color: var(--danger, #d14343);
  }
  .is-down {
    color: var(--success, #2f9e5b);
  }
}
</style>
