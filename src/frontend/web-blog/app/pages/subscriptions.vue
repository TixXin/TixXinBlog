<!-- @file subscriptions.vue @description 按单币种统一查看预算、清单与预测，复用公开 API 与本机编辑恢复流程 -->
<template>
  <CommonPageFrame class="main-inner subscriptions-page" header-key="subscriptions">
    <template #header>
      <CommonPageHeader
        :title="$t('misc.subscription.page.title')"
        :subtitle="$t('misc.subscription.page.subtitle')"
        icon="lucide:credit-card"
      />
    </template>
    <CommonCustomScrollbar
      class="subscriptions-body"
      viewport-class="subscriptions-viewport"
      :show-back-to-top="false"
      primary
    >
      <div class="subscription-ui subscription-workspace">
        <SubscriptionSourceNav
          :mode="mode"
          :editing="local.editing.value"
          :local-ready="local.ready.value"
          :is-logged-in="auth.isLoggedIn.value"
          :currency-options="currencyOptions"
          :currency="currency"
          :controls-ready="controlsReady"
          @switch-mode="switchMode"
          @add-local="addLocal"
          @change-currency="changeQuery({ currency: $event })"
        />
        <CommonRequestFeedback
          v-if="mode === 'blog' && (feed.pending.value || feed.error.value)"
          :pending="feed.pending.value"
          :title="feed.error.value?.message || $t('misc.subscription.page.loading')"
          @retry="feed.refresh()"
        />
        <p v-if="mode === 'local' && !local.ready.value" role="status">
          {{ $t('misc.subscription.page.localNotReady') }}
        </p>
        <SubscriptionStats v-if="stats" :stats="stats" :currency="currency" />
        <section
          class="subscription-list"
          :aria-label="$t('misc.subscription.page.listLabel', { currency })"
          :aria-busy="pending"
        >
          <SubscriptionToolbar
            v-model:search-text="searchText"
            :currency="currency"
            :total="total"
            :controls-ready="controlsReady"
            :query="query"
            :filtered="filtered"
            :sorted="sorted"
            :filter-count="filterCount"
            @search="search"
            @change-query="changeQuery"
            @clear-filters="clearFilters"
          />
          <CommonStateBlock
            v-if="total === 0 && !pending"
            icon="lucide:credit-card"
            :title="
              filtered
                ? $t('misc.subscription.page.emptyFilteredTitle')
                : $t('misc.subscription.page.emptyTitle', { currency })
            "
            :description="
              filtered
                ? $t('misc.subscription.page.emptyFilteredDescription')
                : mode === 'local'
                  ? $t('misc.subscription.page.emptyLocalDescription')
                  : $t('misc.subscription.page.emptyBlogDescription')
            "
            :action-label="filtered ? $t('misc.subscription.page.clearFilters') : undefined"
            @action="clearFilters"
          />
          <SubscriptionCard
            v-for="item in items"
            :key="`${mode}:${item.id}`"
            :item="item"
            :today="stats?.asOf ?? today"
            :editable="mode === 'local' || auth.isLoggedIn.value"
            :local="mode === 'local'"
            :busy="local.saving.value"
            @edit="editItem(item)"
            @remove="removeLocal(item)"
          />
        </section>
        <nav
          v-if="total !== null && (total > query.pageSize || query.page > 1)"
          class="subscription-row subscription-pagination"
          :aria-label="$t('misc.subscription.page.pagination')"
        >
          <button type="button" :disabled="query.page <= 1 || pending" @click="changeQuery({ page: query.page - 1 })">
            {{ $t('misc.subscription.page.prevPage') }}</button
          ><span>{{ query.page }} / {{ Math.max(1, Math.ceil(total / query.pageSize)) }}</span
          ><button
            type="button"
            :disabled="query.page * query.pageSize >= total || pending"
            @click="changeQuery({ page: query.page + 1 })"
          >
            {{ $t('misc.subscription.page.nextPage') }}
          </button>
        </nav>
        <SubscriptionFooter
          v-if="stats"
          :stats="stats"
          :currency="currency"
          :next-renewal="nextRenewal"
          :renewal-day-hint="renewalDayHint"
          :overdue-count="overdueCount"
        />
        <ClientOnly>
          <SubscriptionLocalPanel
            v-show="mode === 'local'"
            ref="localPanel"
            :error="local.error.value"
            :notice="local.notice.value"
            :conflict="local.conflict.value"
            :latest="local.latest.value"
            :editing-id="local.editingId.value"
            :editing="local.editing.value"
            :form="local.form"
            :ready="local.ready.value"
            :saving="local.saving.value"
            :price-changed="localPriceChanged"
            @retry="local.load()"
            @merge="local.mergeLatest"
            @update-form="Object.assign(local.form, $event)"
            @save="saveLocal"
            @cancel="local.cancel"
          />
        </ClientOnly>
        <ClientOnly>
          <section v-if="auth.isLoggedIn.value" v-show="mode === 'blog'" ref="ownerPanel" class="subscription-panel">
            <button v-if="!ownerExpanded" type="button" class="subscription-add" @click="openOwner(null)">
              <Icon name="lucide:plus" /> {{ $t('misc.subscription.page.addOwner') }}
            </button>
            <SubscriptionEditor
              v-if="ownerExpanded"
              :id="ownerId"
              :key="ownerId ?? 'new'"
              ref="ownerEditor"
              inline
              @cancel="ownerExpanded = false"
              @saved="ownerSaved"
            />
          </section>
        </ClientOnly>
      </div>
    </CommonCustomScrollbar>
  </CommonPageFrame>
</template>
<script setup lang="ts">
import { currencyOptions } from '~/features/subscription/types'
import { useSubscriptionsPage } from '~/features/subscription/useSubscriptionsPage'
import SubscriptionSourceNav from '~/components/subscription/SubscriptionSourceNav.vue'

definePageMeta({ rightSidebar: false })
const { t } = useI18n()
const route = useRoute()

const ownerPanel = ref<HTMLElement | null>(null),
  ownerEditor = ref<{ canLeave(): boolean; focusName(): void } | null>(null),
  localPanel = ref<{ focusName(): void; scrollIntoView(opts?: ScrollIntoViewOptions): void } | null>(null)

const feed = await useSubscriptions()
const page = useSubscriptionsPage(feed, { ownerEditor, ownerPanel, localPanel })

const {
  local,
  auth,
  mode,
  ownerExpanded,
  ownerId,
  searchText,
  query,
  stats,
  total,
  items,
  currency,
  pending,
  filtered,
  controlsReady,
  sorted,
  filterCount,
  nextRenewal,
  renewalDayHint,
  overdueCount,
  localPriceChanged,
  today,
  switchMode,
  changeQuery,
  clearFilters,
  openOwner,
  editItem,
  removeLocal,
  ownerSaved,
  addLocal,
  saveLocal,
  search,
} = page

onMounted(() => {
  void auth.restore()
})

watch(
  () => route.path,
  () => {
    ownerExpanded.value = false
  },
)

usePageSeo({
  title: () => t('misc.subscription.page.title'),
  description: () => t('misc.subscription.page.seoDescription'),
})
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';

.subscriptions-body {
  flex: 1;
  padding: 0;
}
:deep(.subscriptions-viewport) {
  padding: 1.25rem 2.25rem 2rem;
}
.subscriptions-page :deep(.main-content__header) {
  padding: 1.75rem 2.25rem 0;
  border-bottom: 0;
}
.subscriptions-page :deep(.page-header__title) {
  font-size: 2rem;
  letter-spacing: -0.025em;
}
.subscriptions-page :deep(.page-header__icon) {
  width: 25px;
  height: 25px;
}
.subscriptions-page :deep(.page-header__subtitle) {
  font-size: 1rem;
  margin-top: 0.4rem;
}
.subscription-workspace {
  display: grid;
  gap: 1.5rem;
}
.subscription-list {
  border-top: 1px solid var(--border);
}
.subscription-add {
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.subscription-pagination {
  justify-content: center;
}

@media (max-width: 850px) {
  :deep(.subscriptions-viewport) {
    padding: 1rem 1.5rem 1.5rem;
  }
  .subscriptions-page :deep(.main-content__header) {
    padding: 1.5rem 1.5rem 0;
  }
}
@media (max-width: 640px) {
  :deep(.subscriptions-viewport) {
    padding: 1rem;
  }
  .subscriptions-page :deep(.main-content__header) {
    padding: 1.25rem 1rem 0;
  }
  .subscriptions-page :deep(.page-header__title) {
    font-size: 1.5rem;
  }
  .subscriptions-page :deep(.page-header__subtitle) {
    font-size: 0.875rem;
  }
  .subscription-workspace {
    gap: 1rem;
  }
}
</style>
