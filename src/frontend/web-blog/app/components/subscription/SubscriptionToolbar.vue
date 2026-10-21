<!--
  @file SubscriptionToolbar.vue
  @description 订阅列表工具栏：标题、搜索框、筛选抽屉及生效筛选条件展示
  @author TixXin
  @since 2026-04-20
-->

<template>
  <div class="subscription-toolbar">
    <h2>
      {{ $t('misc.subscription.page.listTitle', { currency })
      }}<span v-if="total !== null" role="status"> · {{ total }}</span>
    </h2>
    <form class="subscription-search" role="search" @submit.prevent="$emit('search')">
      <CommonSearchBox
        :model-value="searchText"
        :label="$t('misc.subscription.page.searchLabel')"
        :placeholder="$t('misc.subscription.page.searchPlaceholder')"
        :disabled="!controlsReady"
        @update:model-value="$emit('update:search-text', $event)"
        @change="$emit('search')"
      />
    </form>
    <CommonContextDrawer
      v-model:open="filtersOpen"
      :label="
        filterCount
          ? $t('misc.subscription.page.filtersCount', { count: filterCount })
          : $t('misc.subscription.page.filters')
      "
      icon="lucide:sliders-horizontal"
    >
      <template #default="{ close }">
        <div class="subscription-ui subscription-stack">
          <p class="subscription-note">{{ $t('misc.subscription.page.filtersNote', { currency }) }}</p>
          <SubscriptionFilters
            :query="query"
            compact
            :disabled="!controlsReady"
            @change="$emit('change-query', $event)"
          />
          <div class="subscription-row">
            <button type="button" @click="$emit('clear-filters')">
              {{ $t('misc.subscription.page.resetFilters') }}
            </button>
            <button type="button" @click="close">{{ $t('misc.subscription.page.viewResults') }}</button>
          </div>
        </div>
      </template>
    </CommonContextDrawer>
  </div>
  <div
    v-if="filtered || sorted"
    class="subscription-active-filters"
    :aria-label="$t('misc.subscription.page.activeFilters')"
  >
    <span v-if="query.q">{{ $t('misc.subscription.page.activeSearch', { q: query.q }) }}</span>
    <span v-if="query.category">{{ categoryLabel(query.category, t) }}</span>
    <span v-if="query.subscriptionStatus">{{ stateLabel(query.subscriptionStatus, t) }}</span>
    <span v-if="sorted">{{ sortLabel }}</span>
    <button type="button" @click="$emit('clear-filters')">
      {{ $t('misc.subscription.page.clearFilters') }} <Icon name="lucide:x" size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { SubscriptionQuery } from '~/features/subscription/types'
import { categoryLabel, stateLabel } from '~/features/subscription/labels'

const props = defineProps<{
  currency: string
  total: number | null
  searchText: string
  controlsReady: boolean
  query: SubscriptionQuery
  filtered: boolean
  sorted: boolean
  filterCount: number
}>()

defineEmits<{
  'update:search-text': [value: string]
  search: []
  'change-query': [patch: Record<string, string | number | undefined>]
  'clear-filters': []
}>()

const { t } = useI18n()
const filtersOpen = ref(false)

const sortLabel = computed(() =>
  t(props.query.sort === 'amount-asc' ? 'misc.subscription.page.sortAsc' : 'misc.subscription.page.sortDesc'),
)
</script>

<style scoped lang="scss">
@use '~/features/subscription/styles';

.subscription-toolbar {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding-block: 1.15rem 0.85rem;
}
.subscription-toolbar h2 {
  margin: 0 auto 0 0;
  font-size: 1.25rem;
  white-space: nowrap;
}
.subscription-toolbar h2 span {
  color: var(--text-muted);
  font-weight: 400;
}
.subscription-search {
  margin: 0;
  min-width: 0;
}
.subscription-search :deep(.search-box) {
  max-width: none;
  width: 16rem;
}
.subscription-search :deep(.search-box__input) {
  border-radius: 0.75rem;
  padding-left: 2.75rem;
}
.subscription-active-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  font-size: 0.8125rem;
}
.subscription-active-filters span {
  color: var(--text-muted);
  background: var(--surface-2);
  padding: 0.35rem 0.6rem;
  border-radius: 0.35rem;
}
.subscription-active-filters button {
  background: transparent;
  border: 0;
  color: var(--accent-text);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
@media (max-width: 850px) {
  .subscription-search :deep(.search-box) {
    width: 12rem;
  }
}
@media (max-width: 640px) {
  .subscription-toolbar {
    flex-wrap: wrap;
    gap: 0.65rem;
    padding-top: 1rem;
  }
  .subscription-toolbar h2 {
    flex-basis: 100%;
    font-size: 1.125rem;
  }
  .subscription-search {
    flex: 1;
  }
  .subscription-search :deep(.search-box) {
    width: 100%;
  }
}
</style>
