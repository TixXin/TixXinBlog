<!-- @file subscriptions.vue @description 博主公开订阅与访客本机订阅双入口，真实 API 失败可恢复且不回退样本 -->
<template>
  <CommonPageFrame class="main-inner" header-key="subscriptions">
    <template #header
      ><CommonPageHeader
        title="平台订阅费"
        subtitle="记录工具与服务的费用，按原币种查看预算和续费日期"
        icon="lucide:credit-card"
    /></template>
    <CommonCustomScrollbar
      class="subscriptions-body"
      viewport-class="subscriptions-viewport"
      :show-back-to-top="false"
      primary
    >
      <div class="subscription-ui subscription-stack">
        <nav class="subscription-row" aria-label="订阅数据来源">
          <button type="button" :aria-pressed="mode === 'blog'" @click="switchMode('blog')">博主订阅</button
          ><button type="button" :aria-pressed="mode === 'local'" @click="switchMode('local')">我的订阅</button
          ><NuxtLink v-if="auth.isLoggedIn.value" to="/admin/subscriptions">订阅管理</NuxtLink>
        </nav>
        <p v-if="mode === 'local'" class="subscription-note">
          数据仅保存在当前浏览器，清理浏览器数据会丢失。这里的记录不会上传、公开或与博主账号同步。
        </p>
        <ClientOnly>
          <section v-show="mode === 'local'" ref="localPanel" class="subscription-stack">
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
            <button
              v-if="!local.editing.value"
              type="button"
              :disabled="!local.ready.value"
              class="subscription-add"
              @click="local.edit()"
            >
              <Icon name="lucide:plus" /> 添加我的订阅
            </button>
            <form v-else class="subscription-panel subscription-stack" @submit.prevent="local.save">
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
        <SubscriptionFilters :query="query" :disabled="!feed.ready.value" @change="changeQuery" />
        <button v-if="filtered" type="button" class="subscription-clear" @click="clearFilters">清除筛选</button>
        <CommonRequestFeedback
          v-if="mode === 'blog' && (feed.pending.value || feed.error.value)"
          :pending="feed.pending.value"
          :title="feed.error.value?.message || '正在读取平台订阅'"
          @retry="feed.refresh()"
        />
        <p v-if="mode === 'local' && !local.ready.value" role="status">本地数据尚未就绪，修复存储问题后可重试。</p>
        <SubscriptionStats v-if="stats" :stats="stats" />
        <p v-if="total !== null" class="subscription-note" role="status">
          {{ mode === 'local' ? '我的订阅' : '博主公开订阅' }} · 共 {{ total }} 条匹配记录 · 第 {{ query.page }} 页
        </p>
        <CommonStateBlock
          v-if="total === 0 && !(mode === 'blog' && feed.pending.value)"
          icon="lucide:credit-card"
          :title="filtered ? '没有匹配的订阅' : mode === 'local' ? '开始记录你的订阅' : '尚无公开订阅'"
          :description="
            filtered
              ? '试试其他关键词、分类、币种或状态。'
              : mode === 'local'
                ? '添加一个平台，费用和价格历史会保存在当前浏览器。'
                : '博主公开平台订阅后会展示在这里。'
          "
          :action-label="filtered ? '清除筛选' : undefined"
          @action="clearFilters"
        />
        <section
          v-for="group in groups"
          :key="group.currency"
          class="subscription-stack"
          :aria-label="`${group.currency}订阅列表`"
        >
          <h2>{{ group.currency }} 订阅</h2>
          <SubscriptionCard
            v-for="item in group.items"
            :key="item.id"
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
          <button
            type="button"
            :disabled="query.page <= 1 || feed.pending.value"
            @click="changeQuery({ page: query.page - 1 })"
          >
            上一页</button
          ><span>{{ query.page }} / {{ Math.max(1, Math.ceil(total / query.pageSize)) }}</span
          ><button
            type="button"
            :disabled="query.page * query.pageSize >= total || feed.pending.value"
            @click="changeQuery({ page: query.page + 1 })"
          >
            下一页
          </button>
        </nav>
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
        <details v-if="stats" class="subscription-compact-sidebar" :class="sidebarClass">
          <summary>订阅摘要与扣费日期</summary>
          <SubscriptionSidebar :stats="stats" :local="mode === 'local'" />
        </details>
      </div>
    </CommonCustomScrollbar>
    <template #overlays
      ><ClientOnly
        ><Teleport v-if="sidebarExists && activeTheme.capabilities.rightSidebar" to="#right-sidebar-target"
          ><SidebarRightSidebar
            ><SubscriptionSidebar v-if="stats" :stats="stats" :local="mode === 'local'" />
            <p v-else class="subscription-sidebar-wait">当前筛选统计尚未就绪。</p></SidebarRightSidebar
          ></Teleport
        ></ClientOnly
      ></template
    >
  </CommonPageFrame>
</template>
<script setup lang="ts">
import { statistics, parseAmount } from '@tixxin/subscription-domain'
import type { SubscriptionItem, SubscriptionQuery } from '~/features/subscription/types'
import { filterSubscriptions, subscriptionQuery } from '~/features/subscription/query'
import { subscriptionForm } from '~/features/subscription/editor'
const feed = await useSubscriptions(),
  local = useLocalSubscriptions(),
  auth = useCurrentUser()
const { activeTheme, currentThemeId } = useLayoutTheme(),
  route = useRoute()
const mode = ref<'blog' | 'local'>('blog'),
  localQuery = reactive<SubscriptionQuery>(subscriptionQuery({}))
const ownerExpanded = ref(false),
  ownerId = ref<number | null>(null),
  ownerEditor = ref<{ canLeave(): boolean } | null>(null),
  ownerPanel = ref<HTMLElement | null>(null),
  localPanel = ref<HTMLElement | null>(null)
const today = useSubscriptionToday(),
  sidebarExists = ref(false)
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
const groups = computed(() =>
  [...new Set(items.value.map((item) => item.currency))].map((currency) => ({
    currency,
    items: items.value.filter((item) => item.currency === currency),
  })),
)
const filtered = computed(
  () => !!(query.value.q || query.value.category || query.value.currency || query.value.subscriptionStatus),
)
const sidebarClass = computed(() =>
  sidebarExists.value && activeTheme.value.capabilities.rightSidebar
    ? `subscription-compact-sidebar--${currentThemeId.value}`
    : '',
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
function changeQuery(patch: Record<string, string | number | undefined>) {
  if (mode.value === 'blog') void feed.changeQuery(patch)
  else Object.assign(localQuery, subscriptionQuery({ ...localQuery, page: undefined, ...patch }))
}
function clearFilters() {
  changeQuery({
    q: undefined,
    category: undefined,
    currency: undefined,
    subscriptionStatus: undefined,
    sort: undefined,
  })
}
function switchMode(next: 'blog' | 'local') {
  if (next === mode.value || local.saving.value) return
  if (mode.value === 'blog' && ownerEditor.value && !ownerEditor.value.canLeave()) return
  if (mode.value === 'local' && local.dirty.value && !window.confirm('本地编辑输入会保留在此页，确定切换数据来源吗？'))
    return
  mode.value = next
}
async function openOwner(id: number | null) {
  if (ownerEditor.value && !ownerEditor.value.canLeave()) return
  ownerId.value = id
  ownerExpanded.value = true
  await nextTick()
  ownerPanel.value?.scrollIntoView({ block: 'start' })
}
async function editItem(item: SubscriptionItem) {
  if (mode.value === 'blog') await openOwner(Number(item.id))
  else {
    const record = local.data.value.items.find((row) => row.id === item.id)
    if (record && local.edit(record)) {
      await nextTick()
      localPanel.value?.scrollIntoView({ block: 'start' })
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
let observer: MutationObserver | undefined
onMounted(() => {
  void auth.restore()
  const target = () => {
    sidebarExists.value = !!document.querySelector('#right-sidebar-target')
  }
  target()
  observer = new MutationObserver(target)
  observer.observe(document.body, { childList: true, subtree: true })
})
onScopeDispose(() => observer?.disconnect())
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
  padding: 1.5rem 2rem 2rem;
}
.subscription-add {
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.subscription-clear {
  justify-self: start;
}
.subscription-pagination {
  justify-content: center;
  margin-top: 1rem;
}
.subscription-sidebar-wait {
  padding: 1rem;
}
@media (min-width: 1440px) {
  .subscription-compact-sidebar--nexus {
    display: none;
  }
}
@media (min-width: 1280px) {
  .subscription-compact-sidebar--aurora {
    display: none;
  }
}
@media (max-width: 640px) {
  :deep(.subscriptions-viewport) {
    padding: 1rem;
  }
}
</style>
