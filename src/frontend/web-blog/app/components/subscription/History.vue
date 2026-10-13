<!-- @file History.vue @description 价格历史按连续币种与周期分段；新价格生效快照只读展示 -->
<template>
  <details class="subscription-ui subscription-history" @toggle="expanded = ($event.target as HTMLDetailsElement).open">
    <summary>价格历史（{{ history.length }} 条）</summary>
    <p class="subscription-note">
      每条记录表示从生效时间起有效的新价格。首次录入之前的价格未知；变更币种或周期会分段展示。
    </p>
    <ol>
      <li v-for="(entry, i) in history" :key="entry.id">
        <strong
          >{{ i === 0 ? '初始记录' : '价格变更' }}：{{ formatAmount(entry.amount, entry.currency) }} /
          {{ cycleLabels[entry.billingCycle] }}</strong
        >
        <p>生效 {{ displayTime(entry.effectiveAt) }} · 记录 {{ displayTime(entry.recordedAt) }}</p>
        <p v-if="entry.reason">{{ entry.reason }}</p>
      </li>
    </ol>
    <template v-if="expanded"
      ><section v-for="(segment, index) in segments" :key="index" class="subscription-history__segment">
        <h3>{{ segment[0]!.currency }} · {{ cycleLabels[segment[0]!.billingCycle] }} · 第 {{ index + 1 }} 段</h3>
        <ClientOnly
          ><LazySubscriptionChart
            kind="line"
            :labels="segment.map((entry) => displayTime(entry.effectiveAt))"
            :values="segment.map((entry) => Number(amountInput(entry.amount, entry.currency)))"
            :currency="segment[0]!.currency"
            step
            :label="`${segment[0]!.currency} ${cycleLabels[segment[0]!.billingCycle]}价格历史阶梯图`"
          /><template #fallback
            ><div class="subscription-chart-placeholder">图表载入中；完整价格见上方列表。</div></template
          ></ClientOnly
        >
      </section></template
    >
  </details>
</template>
<script setup lang="ts">
import { formatAmount, amountInput } from '@tixxin/subscription-domain'
import { cycleLabels } from '~/features/subscription/types'
import type { SubscriptionPrice } from '~/features/subscription/types'
const props = defineProps<{ history: SubscriptionPrice[] }>(),
  expanded = ref(false)
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
