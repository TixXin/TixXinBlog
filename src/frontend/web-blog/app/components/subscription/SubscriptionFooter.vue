<!--
  @file SubscriptionFooter.vue
  @description 订阅页底部栏：支出预测抽屉入口、下期续费概要与逾期筛选快捷入口
  @author TixXin
  @since 2026-04-20
-->

<template>
  <footer class="subscription-footer">
    <CommonContextDrawer
      v-model:open="forecastOpen"
      :label="$t('misc.subscription.page.forecast')"
      icon="lucide:calendar-days"
    >
      <SubscriptionForecast :stats="stats" :currency="currency" />
    </CommonContextDrawer>
    <p class="subscription-note">
      <template v-if="nextRenewal">{{
        $t('misc.subscription.page.nextRenewal', {
          name: nextRenewal.name,
          date: nextRenewal.date,
          hint: renewalDayHint,
          amount: formatAmount(nextRenewal.amount, currency),
        })
      }}</template>
      <template v-else>{{ $t('misc.subscription.page.noRenewal') }}</template>
      <button v-if="overdueCount" type="button" class="subscription-overdue" @click="forecastOpen = true">
        {{ $t('misc.subscription.page.overdueCount', { count: overdueCount }, overdueCount) }}
      </button>
    </p>
  </footer>
</template>

<script setup lang="ts">
import { formatAmount } from '@tixxin/subscription-domain'
import type { SubscriptionCurrency, SubscriptionStats } from '~/features/subscription/types'

defineProps<{
  stats: SubscriptionStats
  currency: SubscriptionCurrency
  nextRenewal?: { name: string; date: string; amount: number }
  renewalDayHint: string
  overdueCount: number
}>()

const forecastOpen = ref(false)
</script>

<style scoped lang="scss">
@use '~/features/subscription/styles';

.subscription-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: -1rem;

  :deep(.context-entry__button) {
    border: 0;
    background: transparent;
    color: var(--accent-text);
    padding-left: 0;
    font-weight: 600;
  }

  > p {
    text-align: right;
    margin: 0;
  }
}

.subscription-overdue {
  display: block;
  margin-left: auto;
  color: var(--text-muted);
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 0.8125rem;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

@media (max-width: 850px) {
  .subscription-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.25rem;
    > p {
      text-align: left;
    }
  }

  .subscription-overdue {
    margin-left: 0;
  }
}
</style>
