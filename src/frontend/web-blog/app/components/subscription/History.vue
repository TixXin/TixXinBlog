<!-- @file History.vue @description 价格历史按连续币种与周期分段；新价格生效快照只读展示 -->
<template>
  <details class="subscription-ui subscription-history" @toggle="expanded = ($event.target as HTMLDetailsElement).open">
    <summary>{{ $t('misc.subscription.history.summary', { count: history.length }, history.length) }}</summary>
    <p class="subscription-note">{{ $t('misc.subscription.history.note') }}</p>
    <ol>
      <li v-for="(entry, i) in history" :key="entry.id">
        <strong>{{
          $t(i === 0 ? 'misc.subscription.history.initial' : 'misc.subscription.history.change', {
            amount: formatAmount(entry.amount, entry.currency),
            cycle: cycleLabel(entry.billingCycle, t),
          })
        }}</strong>
        <p>
          {{
            $t('misc.subscription.history.times', {
              effective: displayTime(entry.effectiveAt),
              recorded: displayTime(entry.recordedAt),
            })
          }}
        </p>
        <p v-if="entry.reason">{{ entry.reason }}</p>
      </li>
    </ol>
    <template v-if="expanded"
      ><section v-for="(segment, index) in segments" :key="index" class="subscription-history__segment">
        <h3>
          {{
            $t('misc.subscription.history.segment', {
              currency: segment[0]!.currency,
              cycle: cycleLabel(segment[0]!.billingCycle, t),
              index: index + 1,
            })
          }}
        </h3>
        <ClientOnly
          ><LazySubscriptionChart
            kind="line"
            :labels="segment.map((entry) => displayTime(entry.effectiveAt))"
            :values="segment.map((entry) => Number(amountInput(entry.amount, entry.currency)))"
            :currency="segment[0]!.currency"
            step
            :label="
              $t('misc.subscription.history.chartLabel', {
                currency: segment[0]!.currency,
                cycle: cycleLabel(segment[0]!.billingCycle, t),
              })
            "
          /><template #fallback
            ><div class="subscription-chart-placeholder">
              {{ $t('misc.subscription.history.chartLoading') }}
            </div></template
          ></ClientOnly
        >
      </section></template
    >
  </details>
</template>
<script setup lang="ts">
import { formatAmount, amountInput } from '@tixxin/subscription-domain'
import { cycleLabel } from '~/features/subscription/labels'
import type { SubscriptionPrice } from '~/features/subscription/types'
const props = defineProps<{ history: SubscriptionPrice[] }>(),
  expanded = ref(false)
const { t } = useI18n()
const displayTime = (value: string) => value.replace('T', ' ').replace('.000Z', ' UTC').replace(/Z$/, ' UTC')
const segments = computed(() => {
  const groups: SubscriptionPrice[][] = []
  for (const entry of props.history) {
    const last = groups.at(-1)
    if (last?.[0]?.currency === entry.currency && last[0].billingCycle === entry.billingCycle) last.push(entry)
    else groups.push([entry])
  }
  return groups
})
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
.subscription-history {
  margin-top: 0.75rem;
  border-top: 1px solid var(--border);
}
ol {
  padding-left: 1.25rem;
  font-size: 0.8125rem;
}
li {
  padding-block: 0.6rem;
}
.subscription-history__segment {
  margin-block: 1rem;
}
.subscription-chart-placeholder {
  min-height: 280px;
}
</style>
