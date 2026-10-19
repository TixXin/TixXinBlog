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
        <nav class="subscription-source" :aria-label="$t('misc.subscription.page.sourceLabel')">
          <button type="button" :aria-pressed="mode === 'blog'" @click="switchMode('blog')">
            {{ $t('misc.subscription.page.sourceBlog') }}
          </button>
          <button type="button" :aria-pressed="mode === 'local'" @click="switchMode('local')">
            {{ $t('misc.subscription.page.sourceLocal')
            }}<span> · {{ $t('misc.subscription.page.sourceLocalHint') }}</span>
          </button>
          <button
            v-if="mode === 'local' && !local.editing.value"
            type="button"
            class="subscription-add-entry"
            :aria-label="$t('misc.subscription.page.addLocalLabel')"
            :disabled="!local.ready.value"
            @click="addLocal"
          >
            <Icon name="lucide:plus" size="18" /><span>{{ $t('misc.subscription.page.addLocal') }}</span>
          </button>
          <NuxtLink v-if="mode === 'blog' && auth.isLoggedIn.value" to="/admin/subscriptions">{{
            $t('misc.subscription.page.manage')
          }}</NuxtLink>
        </nav>
        <p v-if="mode === 'local'" class="subscription-note subscription-local-note">
          {{ $t('misc.subscription.page.localNote') }}
        </p>
        <nav class="subscription-currencies" :aria-label="$t('misc.subscription.page.currencyLabel')">
          <button
            v-for="code in currencyOptions"
            :key="code"
            type="button"
            :aria-pressed="currency === code"
            :disabled="!controlsReady"
            @click="changeQuery({ currency: code })"
          >
            {{ code }}
          </button>
        </nav>
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
          <div class="subscription-toolbar">
            <h2>
              {{ $t('misc.subscription.page.listTitle', { currency })
              }}<span v-if="total !== null" role="status"> · {{ total }}</span>
            </h2>
            <form class="subscription-search" role="search" @submit.prevent="search">
              <CommonSearchBox
                v-model="searchText"
                :label="$t('misc.subscription.page.searchLabel')"
                :placeholder="$t('misc.subscription.page.searchPlaceholder')"
                :disabled="!controlsReady"
                @change="search"
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
                  <SubscriptionFilters :query="query" compact :disabled="!controlsReady" @change="changeQuery" />
                  <div class="subscription-row">
                    <button type="button" @click="clearFilters">{{ $t('misc.subscription.page.resetFilters') }}</button
                    ><button type="button" @click="close">{{ $t('misc.subscription.page.viewResults') }}</button>
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
            <button type="button" @click="clearFilters">
              {{ $t('misc.subscription.page.clearFilters') }} <Icon name="lucide:x" size="14" />
            </button>
          </div>
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
        <footer v-if="stats" class="subscription-footer">
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
        <ClientOnly>
          <section v-show="mode === 'local'" ref="localPanel" class="subscription-stack subscription-local-panel">
            <CommonRequestFeedback
              v-if="local.error.value"
              compact
              :title="$t('misc.subscription.page.localFailed')"
              :description="local.error.value"
              @retry="local.load()"
            />
            <p v-if="local.notice.value" role="status">{{ local.notice.value }}</p>
            <div v-if="local.conflict.value" class="subscription-panel">
              <p>
                {{ $t('misc.subscription.page.conflictBody') }}
              </p>
              <SubscriptionRecovery v-if="local.latest.value" :value="subscriptionForm(local.latest.value)" />
              <p v-else-if="local.editingId.value">{{ $t('misc.subscription.page.conflictDeleted') }}</p>
              <button type="button" @click="local.mergeLatest">{{ $t('misc.subscription.page.mergeLatest') }}</button>
            </div>
            <form v-if="local.editing.value" class="subscription-panel subscription-stack" @submit.prevent="saveLocal">
              <h2>
                {{
                  local.editingId.value
                    ? $t('misc.subscription.page.editLocal')
                    : $t('misc.subscription.page.addLocalLabel')
                }}
              </h2>
              <SubscriptionFields
                :value="local.form"
                :disabled="!local.ready.value || local.saving.value"
                :changed="localPriceChanged"
                @change="Object.assign(local.form, $event)"
              />
              <div class="subscription-row">
                <button
                  type="submit"
                  :disabled="!local.ready.value || local.saving.value || local.conflict.value"
                  :aria-busy="local.saving.value"
                >
                  {{
                    local.saving.value ? $t('misc.subscription.editor.saving') : $t('misc.subscription.page.saveLocal')
                  }}</button
                ><button type="button" :disabled="local.saving.value" @click="local.cancel">
                  {{ $t('misc.subscription.editor.cancel') }}
                </button>
              </div>
            </form>
          </section>
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
import { statistics, parseAmount, formatAmount } from '@tixxin/subscription-domain'
import type { SubscriptionItem, SubscriptionQuery } from '~/features/subscription/types'
import { filterSubscriptions, publicSubscriptionQuery } from '~/features/subscription/query'
import { currencyOptions } from '~/features/subscription/types'
import { categoryLabel, stateLabel } from '~/features/subscription/labels'
import { subscriptionForm } from '~/features/subscription/editor'
const feed = await useSubscriptions(),
  local = useLocalSubscriptions(),
  auth = useCurrentUser()
const { t } = useI18n()
definePageMeta({ rightSidebar: false })
const route = useRoute()
const mode = ref<'blog' | 'local'>('blog'),
  localQuery = reactive<SubscriptionQuery>(publicSubscriptionQuery({}))
const ownerExpanded = ref(false),
  ownerId = ref<number | null>(null),
  ownerEditor = ref<{ canLeave(): boolean; focusName(): void } | null>(null),
  ownerPanel = ref<HTMLElement | null>(null),
  localPanel = ref<HTMLElement | null>(null)
const today = useSubscriptionToday()
const filtersOpen = ref(false),
  forecastOpen = ref(false),
  searchText = ref('')
const query = computed(() => (mode.value === 'blog' ? feed.query.value : localQuery))
const localFiltered = computed(() => filterSubscriptions(local.data.value.items, localQuery))
const stats = computed(() =>
  mode.value === 'blog' ? feed.stats.value : local.ready.value ? statistics(localFiltered.value, today.value) : null,
)
const total = computed(() =>
  mode.value === 'blog' ? feed.total.value : local.ready.value ? localFiltered.value.length : null,
)
const items = computed(() =>
  mode.value === 'blog'
    ? feed.items.value
    : local.ready.value
      ? localFiltered.value.slice((localQuery.page - 1) * localQuery.pageSize, localQuery.page * localQuery.pageSize)
      : [],
)
const currency = computed(() => query.value.currency ?? 'USD')
const pending = computed(() => mode.value === 'blog' && feed.pending.value)
const filtered = computed(() => !!(query.value.q || query.value.category || query.value.subscriptionStatus))
// 本机数据不依赖公开接口，两种来源各自判断控件是否可用。
const controlsReady = computed(() => (mode.value === 'blog' ? feed.ready.value : local.ready.value))
const sorted = computed(() => query.value.sort !== 'manual')
const sortLabel = computed(() =>
  t(query.value.sort === 'amount-asc' ? 'misc.subscription.page.sortAsc' : 'misc.subscription.page.sortDesc'),
)
const filterCount = computed(
  () =>
    Number(!!query.value.category) + Number(!!query.value.subscriptionStatus) + Number(query.value.sort !== 'manual'),
)
const selectedStats = computed(() => stats.value?.currencies.find((item) => item.currency === currency.value))
const nextRenewal = computed(() => selectedStats.value?.upcoming.find((item) => !item.overdue))
/** 今天或明天续费时在日期后补充提示，避免只看日期还要心算 */
const renewalDayHint = computed(() => {
  const date = nextRenewal.value?.date,
    base = stats.value?.asOf ?? today.value
  if (!date || !base) return ''
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${base}T00:00:00Z`)) / 86_400_000)
  return days === 0
    ? t('misc.subscription.page.renewalToday')
    : days === 1
      ? t('misc.subscription.page.renewalTomorrow')
      : ''
})
const overdueCount = computed(() => selectedStats.value?.upcoming.filter((item) => item.overdue).length ?? 0)
watch(
  [() => query.value.q, mode, currency],
  () => {
    searchText.value = query.value.q ?? ''
  },
  { immediate: true },
)
const localPriceChanged = computed(() => {
  const saved = local.saved.value
  if (!saved) return false
  try {
    return (
      parseAmount(local.form.amountInput, local.form.currency) !== saved.amount ||
      local.form.currency !== saved.currency ||
      local.form.billingCycle !== saved.billingCycle
    )
  } catch {
    return true
  }
})
// 本机列表在前端分页，记录变少时夹取页码，避免停在有总数却空白的分页。
watch([() => localFiltered.value.length, () => localQuery.pageSize], ([count, size]) => {
  const pages = Math.max(1, Math.ceil(count / size))
  if (localQuery.page > pages) localQuery.page = pages
})
function changeQuery(patch: Record<string, string | number | undefined>) {
  if (mode.value === 'blog') void feed.changeQuery(patch)
  else Object.assign(localQuery, publicSubscriptionQuery({ ...localQuery, page: undefined, ...patch }))
}
function clearFilters() {
  changeQuery({
    q: undefined,
    category: undefined,
    subscriptionStatus: undefined,
    sort: undefined,
  })
}
function switchMode(next: 'blog' | 'local') {
  if (next === mode.value || local.saving.value) return
  if (mode.value === 'blog' && ownerEditor.value && !ownerEditor.value.canLeave()) return
  if (mode.value === 'local' && local.dirty.value && !window.confirm(t('misc.subscription.page.confirmSwitchSource')))
    return
  // 币种是页面级语境，切换来源后继续查看同一币种。
  const carried = currency.value
  mode.value = next
  if (carried !== (query.value.currency ?? 'USD')) changeQuery({ currency: carried })
}
async function openOwner(id: number | null) {
  if (ownerEditor.value && !ownerEditor.value.canLeave()) return
  ownerId.value = id
  ownerExpanded.value = true
  await nextTick()
  ownerPanel.value?.scrollIntoView({ block: 'start' })
  ownerEditor.value?.focusName()
}
async function editItem(item: SubscriptionItem) {
  if (mode.value === 'blog') await openOwner(Number(item.id))
  else {
    const record = local.data.value.items.find((row) => row.id === item.id)
    if (record && local.edit(record)) {
      await nextTick()
      localPanel.value?.scrollIntoView({ block: 'start' })
      localPanel.value
        ?.querySelector<HTMLInputElement>('input[data-subscription-field="name"]')
        ?.focus({ preventScroll: true })
    }
  }
}
function removeLocal(item: SubscriptionItem) {
  const record = local.data.value.items.find((row) => row.id === item.id)
  if (record) void local.remove(record)
}
async function ownerSaved() {
  ownerExpanded.value = false
  await feed.refresh()
}
onMounted(() => {
  void auth.restore()
})
async function addLocal() {
  if (!local.edit(undefined, currency.value)) return
  await nextTick()
  localPanel.value?.scrollIntoView({ block: 'start' })
  localPanel.value
    ?.querySelector<HTMLInputElement>('input[data-subscription-field="name"]')
    ?.focus({ preventScroll: true })
}
async function saveLocal() {
  const savedCurrency = local.form.currency
  await local.save()
  if (!local.editing.value && !local.error.value) {
    changeQuery({ currency: savedCurrency, q: undefined, category: undefined, subscriptionStatus: undefined })
  }
}
function search() {
  changeQuery({ q: searchText.value.trim() || undefined })
}
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
.subscription-source {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.subscription-source button {
  padding-inline: 1rem;
}
.subscription-source button[aria-pressed='true'] {
  border-color: var(--accent-text);
  color: var(--accent-text);
  background: var(--accent-soft);
}
.subscription-source .subscription-add-entry {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}
.subscription-source a {
  margin-left: auto;
  font-size: 0.875rem;
}
.subscription-local-note {
  margin: -0.75rem 0 0;
}
.subscription-currencies {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
}
.subscription-currencies button {
  min-width: 0;
  padding-inline: 0.35rem;
}
.subscription-currencies button[aria-pressed='true'] {
  background: var(--accent-action);
  border-color: var(--accent-action);
  color: #fff;
}
.subscription-list {
  border-top: 1px solid var(--border);
}
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
.subscription-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: -1rem;
}
.subscription-footer :deep(.context-entry__button) {
  border: 0;
  background: transparent;
  color: var(--accent-text);
  padding-left: 0;
  font-weight: 600;
}
.subscription-footer > p {
  text-align: right;
  margin: 0;
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
.subscription-local-panel {
  scroll-margin-top: 1rem;
}
@media (max-width: 850px) {
  :deep(.subscriptions-viewport) {
    padding: 1rem 1.5rem 1.5rem;
  }
  .subscriptions-page :deep(.main-content__header) {
    padding: 1.5rem 1.5rem 0;
  }
  .subscription-search :deep(.search-box) {
    width: 12rem;
  }
  .subscription-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.25rem;
  }
  .subscription-footer > p {
    text-align: left;
  }
  .subscription-overdue {
    margin-left: 0;
  }
}
@media (max-width: 640px) {
  .subscription-source .subscription-add-entry {
    width: 44px;
    flex-shrink: 0;
    padding-inline: 0;
  }
  .subscription-add-entry span {
    display: none;
  }
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
  .subscription-currencies {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
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
