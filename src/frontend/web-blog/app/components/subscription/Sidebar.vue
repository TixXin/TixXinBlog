<!-- @file Sidebar.vue @description 与页面数据源及筛选一致的订阅摘要和扣费提示 -->
<template>
  <section class="subscription-ui subscription-panel subscription-stack">
    <h2>{{ local ? '我的订阅' : '博主订阅' }}</h2>
    <p>{{ stats.total }} 条匹配记录 · {{ stats.categoryCount }} 个分类</p>
    <p v-for="currency in stats.currencies" :key="currency.currency">
      {{ currency.currency }} 月均<br /><strong>{{ formatAmount(currency.monthlyAmount, currency.currency) }}</strong>
    </p>
    <h3>扣费日期提醒</h3>
    <p class="subscription-note">日期为页面提醒，不会自动扣款或发送通知。</p>
    <ul v-if="upcoming.length">
      <li v-for="item in upcoming" :key="item.id">
        <strong>{{ item.name }}</strong
        ><br />{{ item.date }}{{ item.overdue ? ' · 已逾期' : '' }}<br />{{ formatAmount(item.amount, item.currency) }}
      </li>
    </ul>
    <p v-else>当前筛选没有可用的扣费日期。</p>
    <h3>分类摘要</h3>
    <p v-for="category in categories" :key="category.name">{{ category.name }} · {{ category.count }} 条</p>
  </section>
</template>
<script setup lang="ts">
import { formatAmount } from '@tixxin/subscription-domain'
import { categoryLabels } from '~/features/subscription/types'
import type { SubscriptionStats } from '~/features/subscription/types'
const props = defineProps<{ stats: SubscriptionStats; local?: boolean }>()
const upcoming = computed(() =>
  props.stats.currencies
    .flatMap((item) => item.upcoming)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8),
)
const categories = computed(() => {
  const result = new Map<string, number>()
  for (const bucket of props.stats.currencies)
    for (const category of bucket.categories) {
      const name = categoryLabels[category.category]
      result.set(name, (result.get(name) ?? 0) + category.count)
    }
  return [...result].map(([name, count]) => ({ name, count }))
})
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
ul {
  padding-left: 1rem;
  font-size: 0.8125rem;
  display: grid;
  gap: 1rem;
}
</style>
