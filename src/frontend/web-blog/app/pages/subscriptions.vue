<!-- @file subscriptions.vue @description 按单币种统一查看预算、清单与预测，复用公开 API 与本机编辑恢复流程 -->
<template>
  <CommonPageFrame class="main-inner subscriptions-page" header-key="subscriptions">
    <template #header>
      <CommonPageHeader title="平台订阅费" subtitle="按币种，理清每一笔持续开销。" icon="lucide:credit-card" />
    </template>
    <CommonCustomScrollbar
      class="subscriptions-body"
      viewport-class="subscriptions-viewport"
      :show-back-to-top="false"
      primary
    >
      <div class="subscription-ui subscription-workspace">
        <nav class="subscription-source" aria-label="订阅数据来源">
          <button type="button" :aria-pressed="mode === 'blog'" @click="switchMode('blog')">博主订阅</button>
          <button type="button" :aria-pressed="mode === 'local'" @click="switchMode('local')">
            我的订阅<span> · 本机</span>
          </button>
          <button
            v-if="mode === 'local' && !local.editing.value"
            type="button"
            class="subscription-add-entry"
            aria-label="添加我的订阅"
            :disabled="!local.ready.value"
            @click="addLocal"
          >
            <Icon name="lucide:plus" size="18" /><span>添加订阅</span>
          </button>
          <NuxtLink v-if="mode === 'blog' && auth.isLoggedIn.value" to="/admin/subscriptions">订阅管理</NuxtLink>
        </nav>
        <p v-if="mode === 'local'" class="subscription-note subscription-local-note">
          仅保存在当前浏览器，不会上传或公开；清理浏览器数据会丢失。
        </p>
        <nav class="subscription-currencies" aria-label="订阅币种">
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
          :title="feed.error.value?.message || '正在读取平台订阅'"
          @retry="feed.refresh()"
        />
        <p v-if="mode === 'local' && !local.ready.value" role="status">本地数据尚未就绪，修复存储问题后可重试。</p>
        <SubscriptionStats v-if="stats" :stats="stats" :currency="currency" />
        <section class="subscription-list" :aria-label="`${currency}订阅列表`" :aria-busy="pending">
          <div class="subscription-toolbar">
            <h2>
              {{ currency }} 订阅<span v-if="total !== null" role="status"> · {{ total }}</span>
            </h2>
            <form class="subscription-search" role="search" @submit.prevent="search">
              <CommonSearchBox
                v-model="searchText"
                label="搜索当前币种订阅"
                placeholder="搜索当前币种…"
                :disabled="!controlsReady"
                @change="search"
              />
            </form>
            <CommonContextDrawer
              v-model:open="filtersOpen"
              :label="filterCount ? `筛选 · ${filterCount}` : '筛选'"
              icon="lucide:sliders-horizontal"
            >
              <template #default="{ close }">
                <div class="subscription-ui subscription-stack">
                  <p class="subscription-note">筛选同时应用于 {{ currency }} 的预算、清单与续费预测。</p>
                  <SubscriptionFilters :query="query" compact :disabled="!controlsReady" @change="changeQuery" />
                  <div class="subscription-row">
                    <button type="button" @click="clearFilters">重置筛选</button
                    ><button type="button" @click="close">查看结果</button>
                  </div>
                </div>
              </template>
            </CommonContextDrawer>
          </div>
          <div v-if="filtered || sorted" class="subscription-active-filters" aria-label="已应用的筛选">
            <span v-if="query.q">搜索：{{ query.q }}</span>
            <span v-if="query.category">{{ categoryLabels[query.category] }}</span>
            <span v-if="query.subscriptionStatus">{{ stateLabels[query.subscriptionStatus] }}</span>
            <span v-if="sorted">{{ sortLabel }}</span>
            <button type="button" @click="clearFilters">清除筛选 <Icon name="lucide:x" size="14" /></button>
          </div>
          <CommonStateBlock
            v-if="total === 0 && !pending"
            icon="lucide:credit-card"
            :title="filtered ? '没有匹配的订阅' : `暂无 ${currency} 订阅`"
            :description="
              filtered
                ? '试试其他关键词、分类或状态。'
                : mode === 'local'
                  ? '添加一个平台，或切换币种查看已有记录。'
                  : '可切换币种，查看博主的其他订阅。'
            "
            :action-label="filtered ? '清除筛选' : undefined"
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
          aria-label="订阅分页"
        >
          <button type="button" :disabled="query.page <= 1 || pending" @click="changeQuery({ page: query.page - 1 })">
            上一页</button
          ><span>{{ query.page }} / {{ Math.max(1, Math.ceil(total / query.pageSize)) }}</span
          ><button
            type="button"
            :disabled="query.page * query.pageSize >= total || pending"
            @click="changeQuery({ page: query.page + 1 })"
          >
            下一页
          </button>
        </nav>
        <footer v-if="stats" class="subscription-footer">
          <CommonContextDrawer v-model:open="forecastOpen" label="查看续费预测" icon="lucide:calendar-days">
            <SubscriptionForecast :stats="stats" :currency="currency" />
          </CommonContextDrawer>
          <p class="subscription-note">
            <template v-if="nextRenewal"
              >下次续费：{{ nextRenewal.name }} · {{ nextRenewal.date }}{{ renewalDayHint }} ·
              {{ formatAmount(nextRenewal.amount, currency) }}</template
            >
            <template v-else>暂无待续费日期</template>
            <button v-if="overdueCount" type="button" class="subscription-overdue" @click="forecastOpen = true">
              {{ overdueCount }} 项日期已过，待核对
            </button>
          </p>
        </footer>
        <ClientOnly>
          <section v-show="mode === 'local'" ref="localPanel" class="subscription-stack subscription-local-panel">
            <p v-if="local.error.value" role="alert">
              {{ local.error.value }} <button type="button" @click="local.load()">重试读取</button>
            </p>
            <p v-if="local.notice.value" role="status">{{ local.notice.value }}</p>
            <div v-if="local.conflict.value" class="subscription-panel">
              <p>
                当前输入已保留。合并会保留本页实际改过的字段，其余字段采用最新记录；同一字段双方都修改时保留本页输入，请对照下方内容核对。
              </p>
              <SubscriptionRecovery v-if="local.latest.value" :value="subscriptionForm(local.latest.value)" />
              <p v-else-if="local.editingId.value">最新数据中已没有这条记录，不能按原身份继续保存。</p>
              <button type="button" @click="local.mergeLatest">读取最新记录并保留输入</button>
            </div>
            <form v-if="local.editing.value" class="subscription-panel subscription-stack" @submit.prevent="saveLocal">
              <h2>{{ local.editingId.value ? '编辑我的订阅' : '添加我的订阅' }}</h2>
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
                  {{ local.saving.value ? '正在保存…' : '保存到当前浏览器' }}</button
                ><button type="button" :disabled="local.saving.value" @click="local.cancel">取消编辑</button>
              </div>
            </form>
          </section>
        </ClientOnly>
        <ClientOnly>
          <section v-if="auth.isLoggedIn.value" v-show="mode === 'blog'" ref="ownerPanel" class="subscription-panel">
            <button v-if="!ownerExpanded" type="button" class="subscription-add" @click="openOwner(null)">
              <Icon name="lucide:plus" /> 记录一个平台订阅
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
import { currencyOptions, categoryLabels, stateLabels } from '~/features/subscription/types'
import { subscriptionForm } from '~/features/subscription/editor'
const feed = await useSubscriptions(),
  local = useLocalSubscriptions(),
  auth = useCurrentUser()
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
const sortLabel = computed(() => (query.value.sort === 'amount-asc' ? '金额升序' : '金额降序'))
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
  return days === 0 ? '（今天）' : days === 1 ? '（明天）' : ''
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
  if (mode.value === 'local' && local.dirty.value && !window.confirm('本地编辑输入会保留在此页，确定切换数据来源吗？'))
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
      localPanel.value?.querySelector<HTMLInputElement>('input[aria-label="服务名称"]')?.focus({ preventScroll: true })
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
  localPanel.value?.querySelector<HTMLInputElement>('input[aria-label="服务名称"]')?.focus({ preventScroll: true })
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
useSeoMeta({
  title: '平台订阅费',
  description: '按原币种记录个人工具和服务的订阅费用、价格变化与预计续费。访客可在当前浏览器记录自己的订阅。',
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
