<!-- @file Filters.vue @description 博主和访客共享筛选展示组件，只发出查询变更 -->
<template>
  <div class="subscription-ui subscription-grid">
    <label v-if="!compact"
      >{{ $t('misc.subscription.filters.search')
      }}<input
        :value="query.q ?? ''"
        type="search"
        maxlength="200"
        :aria-label="$t('misc.subscription.filters.search')"
        :placeholder="$t('misc.subscription.filters.searchPlaceholder')"
        :disabled="disabled"
        @change="change('q', $event)" /></label
    ><label
      >{{ $t('misc.subscription.filters.category')
      }}<select
        :value="query.category ?? ''"
        :aria-label="$t('misc.subscription.filters.categoryLabel')"
        :disabled="disabled"
        @change="change('category', $event)"
      >
        <option value="">{{ $t('misc.subscription.filters.allCategories') }}</option>
        <option v-for="key in categoryKeys" :key="key" :value="key">{{ categoryLabel(key, t) }}</option>
      </select></label
    ><label v-if="!compact"
      >{{ $t('misc.subscription.filters.currency')
      }}<select
        :value="query.currency ?? ''"
        :aria-label="$t('misc.subscription.filters.currencyLabel')"
        :disabled="disabled"
        @change="change('currency', $event)"
      >
        <option value="">{{ $t('misc.subscription.filters.allCurrencies') }}</option>
        <option v-for="currency in currencyOptions" :key="currency" :value="currency">{{ currency }}</option>
      </select></label
    ><label
      >{{ $t('misc.subscription.filters.status')
      }}<select
        :value="query.subscriptionStatus ?? ''"
        :aria-label="$t('misc.subscription.filters.statusLabel')"
        :disabled="disabled"
        @change="change('subscriptionStatus', $event)"
      >
        <option value="">{{ $t('misc.subscription.filters.allStatuses') }}</option>
        <option v-for="key in stateKeys" :key="key" :value="key">{{ stateLabel(key, t) }}</option>
      </select></label
    ><label
      >{{ $t('misc.subscription.filters.sort')
      }}<select
        :value="query.sort ?? 'manual'"
        :aria-label="$t('misc.subscription.filters.sortLabel')"
        :disabled="disabled"
        @change="change('sort', $event)"
      >
        <option value="manual">{{ $t('misc.subscription.filters.sortManual') }}</option>
        <option value="amount-asc">{{ $t('misc.subscription.filters.sortAmountAsc') }}</option>
        <option value="amount-desc">{{ $t('misc.subscription.filters.sortAmountDesc') }}</option>
      </select></label
    >
  </div>
</template>
<script setup lang="ts">
import { categoryLabels, stateLabels, currencyOptions } from '~/features/subscription/types'
import type { SubscriptionCategory, SubscriptionQuery, SubscriptionState } from '~/features/subscription/types'
import { categoryLabel, stateLabel } from '~/features/subscription/labels'
defineProps<{ query: SubscriptionQuery; disabled?: boolean; compact?: boolean }>()
const emit = defineEmits<{ change: [value: Record<string, string | number | undefined>] }>()
const { t } = useI18n()
const categoryKeys = Object.keys(categoryLabels) as SubscriptionCategory[],
  stateKeys = Object.keys(stateLabels) as SubscriptionState[]
function change(key: string, event: Event) {
  emit('change', { [key]: (event.target as HTMLInputElement).value || undefined })
}
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
</style>
