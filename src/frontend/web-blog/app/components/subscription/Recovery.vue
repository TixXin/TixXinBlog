<!-- @file Recovery.vue @description 恢复与冲突对比使用完整字段，避免只显示摘要丢失可核对信息 -->
<template>
  <dl class="subscription-recovery">
    <template v-for="(label, key) in labels" :key="key"
      ><dt>{{ label }}</dt>
      <dd>{{ String(value[key] ?? '') || '未填写' }}</dd></template
    >
  </dl>
</template>
<script setup lang="ts">
import type { SubscriptionForm } from '~/features/subscription/types'
defineProps<{ value: SubscriptionForm }>()
const labels: Record<keyof SubscriptionForm, string> = {
  name: '服务名称',
  description: '描述',
  url: '官网',
  platform: '供应商',
  category: '分类',
  currency: '币种',
  amountInput: '金额',
  billingCycle: '周期',
  startDate: '开始日期',
  nextBillingDate: '下次扣费',
  subscriptionStatus: '订阅状态',
  notes: '私人备注',
  iconMediaId: '受管图标',
  status: '发布状态',
  sortOrder: '排序',
  priceChangeReason: '变价原因',
}
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
