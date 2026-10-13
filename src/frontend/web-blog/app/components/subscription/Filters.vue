<!-- @file Filters.vue @description 博主和访客共享筛选展示组件，只发出查询变更 -->
<template>
  <div class="subscription-ui subscription-grid">
    <label
      >搜索订阅<input
        :value="query.q ?? ''"
        type="search"
        maxlength="200"
        aria-label="搜索订阅"
        placeholder="名称、平台或描述"
        :disabled="disabled"
        @change="change('q', $event)" /></label
    ><label
      >分类<select
        :value="query.category ?? ''"
        aria-label="筛选订阅分类"
        :disabled="disabled"
        @change="change('category', $event)"
      >
        <option value="">全部分类</option>
        <option v-for="(label, key) in categoryLabels" :key="key" :value="key">{{ label }}</option>
      </select></label
    ><label
      >币种<select
        :value="query.currency ?? ''"
        aria-label="筛选订阅币种"
        :disabled="disabled"
        @change="change('currency', $event)"
      >
        <option value="">全部币种（独立统计）</option>
        <option v-for="currency in currencyOptions" :key="currency" :value="currency">{{ currency }}</option>
      </select></label
    ><label
      >订阅状态<select
        :value="query.subscriptionStatus ?? ''"
        aria-label="筛选订阅状态"
        :disabled="disabled"
        @change="change('subscriptionStatus', $event)"
      >
        <option value="">全部订阅状态</option>
        <option v-for="(label, key) in stateLabels" :key="key" :value="key">{{ label }}</option>
      </select></label
    ><label
      >排列方式<select
        :value="query.sort ?? 'manual'"
        aria-label="订阅排列方式"
        :disabled="disabled"
        @change="change('sort', $event)"
      >
        <option value="manual">默认排序</option>
        <option value="amount-asc">币种内原始金额升序</option>
        <option value="amount-desc">币种内原始金额降序</option>
      </select></label
    >
  </div>
</template>
<script setup lang="ts">
import { categoryLabels, stateLabels, currencyOptions } from '~/features/subscription/types'
import type { SubscriptionQuery } from '~/features/subscription/types'
defineProps<{ query: SubscriptionQuery; disabled?: boolean }>()
const emit = defineEmits<{ change: [value: Record<string, string | number | undefined>] }>()
function change(key: string, event: Event) {
  emit('change', { [key]: (event.target as HTMLInputElement).value || undefined })
}
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
</style>
