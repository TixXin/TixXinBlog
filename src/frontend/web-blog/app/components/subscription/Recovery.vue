<!-- @file Recovery.vue @description 恢复与冲突对比使用完整字段，避免只显示摘要丢失可核对信息 -->
<template>
  <dl class="subscription-recovery">
    <template v-for="key in fields" :key="key"
      ><dt>{{ $t(`misc.subscription.recovery.${key}`) }}</dt>
      <dd>{{ String(value[key] ?? '') || $t('misc.subscription.recovery.notFilled') }}</dd></template
    >
  </dl>
</template>
<script setup lang="ts">
import type { SubscriptionForm } from '~/features/subscription/types'
defineProps<{ value: SubscriptionForm }>()
// 展示顺序即表单字段顺序；名称取字典 misc.subscription.recovery.<字段>。
const fields: (keyof SubscriptionForm)[] = [
  'name',
  'description',
  'url',
  'platform',
  'category',
  'currency',
  'amountInput',
  'billingCycle',
  'startDate',
  'nextBillingDate',
  'subscriptionStatus',
  'notes',
  'iconMediaId',
  'status',
  'sortOrder',
  'priceChangeReason',
]
</script>
<style scoped>
.subscription-recovery {
  display: grid;
  grid-template-columns: minmax(80px, 1fr) minmax(0, 3fr);
  gap: 0.5rem;
  margin-block: 0.75rem;
  font-size: 0.8125rem;
}
dt {
  color: var(--text-muted);
}
dd {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
