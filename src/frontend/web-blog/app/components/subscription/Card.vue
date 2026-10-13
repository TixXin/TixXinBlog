<!-- @file Card.vue @description 订阅真实金额、周期、状态与只读历史；日期不隐式调整 -->
<template>
  <article class="subscription-ui subscription-panel" :aria-label="item.name">
    <header class="subscription-card-header">
      <img
        v-if="icon && !imageFailed"
        :src="icon"
        :alt="`${item.name}图标`"
        width="44"
        height="44"
        loading="lazy"
        @error="imageFailed = true"
      /><span v-else class="subscription-card-icon"><Icon name="lucide:credit-card" size="23" /></span>
      <div>
        <h3>{{ item.name }}</h3>
        <p v-if="item.platform" class="subscription-note">{{ item.platform }}</p>
      </div>
      <strong class="subscription-card-price"
        >{{ formatAmount(item.amount, item.currency) }}<small>{{ cycleLabels[item.billingCycle] }}</small></strong
      >
    </header>
    <p v-if="item.description" class="subscription-description">{{ item.description }}</p>
    <div class="subscription-row">
      <span class="subscription-tag">{{ categoryLabels[item.category] }}</span
      ><span class="subscription-tag">{{ stateLabels[item.subscriptionStatus] }}</span
      ><span v-if="item.startDate && item.startDate > today" class="subscription-tag">未来开始</span>
    </div>
    <p class="subscription-note">
      开始日期 {{ item.startDate ?? '未设置' }}<br />下次扣费 {{ item.nextBillingDate ?? '未设置'
      }}<template v-if="item.nextBillingDate && item.nextBillingDate < today"> · 已逾期，请核对</template>
    </p>
    <div class="subscription-row">
      <a v-if="website" :href="website" target="_blank" rel="noopener noreferrer"
        >访问官网 <Icon name="lucide:external-link" size="13" /></a
      ><button v-if="editable" type="button" :disabled="busy" @click="$emit('edit')">编辑订阅</button
      ><button v-if="local" type="button" :disabled="busy" @click="$emit('remove')">删除订阅</button>
    </div>
    <SubscriptionHistory :history="item.priceHistory" />
  </article>
</template>
<script setup lang="ts">
import { formatAmount } from '@tixxin/subscription-domain'
import { categoryLabels, cycleLabels, stateLabels } from '~/features/subscription/types'
import type { SubscriptionItem } from '~/features/subscription/types'
import { safeSubscriptionUrl } from '~/features/subscription/local'
const props = defineProps<{
  item: SubscriptionItem
  today: string
  editable?: boolean
  local?: boolean
  busy?: boolean
}>()
defineEmits<{ edit: []; remove: [] }>()
const imageFailed = ref(false),
  icon = computed(() => props.item.iconUrl || props.item.faviconUrl)
watch(icon, () => {
  imageFailed.value = false
})
const website = computed(() => {
  try {
    return safeSubscriptionUrl(props.item.url)
  } catch {
    return null
  }
})
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
.subscription-card-header {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
}
.subscription-card-header img {
  object-fit: contain;
  border-radius: 0.5rem;
}
.subscription-card-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-content: center;
  border-radius: 0.5rem;
  background: var(--surface-2);
  color: var(--text-muted);
}
.subscription-card-price {
  display: grid;
  justify-items: end;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}
.subscription-card-price small {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 400;
}
.subscription-description {
  white-space: pre-wrap;
  font-size: 0.875rem;
}
.subscription-row {
  margin-block: 0.6rem;
}
a {
  font-size: 0.8125rem;
}
@media (max-width: 420px) {
  .subscription-card-header {
    grid-template-columns: 44px minmax(0, 1fr);
  }
  .subscription-card-price {
    grid-column: 2;
    justify-items: start;
  }
}
</style>
