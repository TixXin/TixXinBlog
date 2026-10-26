<!--
  @file index.vue
  @description 真实文章管理列表：页码跳转、跨页选择、筛选结果全选和分批操作
-->
<template>
  <section class="admin-posts">
    <header class="admin-page-header">
      <h1>{{ $t('admin-content.postList.title') }}</h1>
      <NuxtLink class="admin-btn admin-btn--primary" to="/admin/posts/new"
        ><Icon name="lucide:plus" aria-hidden="true" />{{ $t('admin-content.postList.newPost') }}</NuxtLink
      >
    </header>
    <ClientOnly>
      <div v-if="isLoggedIn" class="admin-posts__body">
        <AdminPostListFilters
          v-model:search="search"
          v-model:status="status"
          v-model:category="category"
          v-model:folder="folder"
          v-model:tag="tag"
          v-model:sort="sort"
          v-model:order="order"
          :folders="filters.folders"
          :tags="filters.tags"
          :pending="pending"
          @apply="resetPage"
          @ordering="applyOrdering"
          @clear="clearFilters"
        />
        <p v-if="filterError" role="alert">
          {{ $t('admin-content.postList.filtersFailed') }}
          <button type="button" @click="loadFilters">{{ $t('admin-content.postList.retryFilters') }}</button>
        </p>
        <p v-if="error" role="alert">
          {{ error }} <button type="button" @click="load">{{ $t('admin-content.postList.retry') }}</button>
        </p>
        <p v-if="pending" role="status">{{ $t('admin-content.postList.loading') }}</p>
        <AdminPostListBatchBar
          v-model:action="batchAction"
          :all-selected="allSelected"
          :partially-selected="partiallySelected"
          :selected-count="selectedCount"
          :selecting-all="selectingAll"
          :disabled="selectionDisabled"
          :has-items="items.length > 0"
          :total="total"
          :batch-pending="batch.pending.value"
          @toggle-page="togglePage"
          @clear="clearSelection"
          @select-all="selectAllFiltered"
          @review="reviewBatch"
        />
        <p v-if="selectionError" role="alert">{{ selectionError }}</p>
        <AdminPostListTable
          :items="items"
          :is-selected="selection.isSelected"
          :selection-disabled="selectionDisabled"
          :navigation-disabled="navigationDisabled"
          @toggle="togglePost"
          @archive="archive"
          @restore="restorePost"
        />
        <p v-if="!pending && !error && !items.length">{{ $t('admin-content.postList.empty') }}</p>
        <AdminPostListPagination
          :page="page"
          :total-pages="totalPages"
          :total="total"
          :disabled="navigationDisabled"
          @go="goToPage"
        />
        <AdminPostBatch
          v-model:open="batch.open.value"
          v-model:acknowledgement="batch.acknowledgement.value"
          :preview="batch.preview.value"
          :result="batch.result.value"
          :pending="batch.pending.value"
          :error="batch.error.value"
          :attempted="batch.attempted.value"
          :batch-index="batch.batchIndex.value"
          :batch-count="batch.batchCount.value"
          :total-count="batch.totalCount.value"
          :can-next="batch.canNext.value"
          @execute="batch.execute"
          @query="batch.queryResult"
          @next="batch.nextBatch"
        />
        <AdminPostBatchHistory
          :items="batch.recent.value"
          :error="batch.recentError.value"
          :pending="batch.pending.value"
          @inspect="batch.inspect"
          @retry="batch.loadRecent"
        />
      </div>
      <i18n-t v-else keypath="admin-content.postList.loginPrompt" tag="p" scope="global">
        <template #link>
          <NuxtLink to="/admin/login">{{ $t('admin-content.postList.loginLink') }}</NuxtLink>
        </template>
      </i18n-t>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import type { PostBatchAction } from '~/features/post/batchTypes'
import { ADMIN_POST_PAGE_SIZE } from '~/features/post/adminListQuery'
import { useAdminPostListData } from '~/features/post/useAdminPostListData'
import { useAdminPostListQuery } from '~/features/post/useAdminPostListQuery'
import { useAdminPostListSelection } from '~/features/post/useAdminPostListSelection'
import { useAdminPostStatusChange } from '~/features/post/useAdminPostStatusChange'
definePageMeta({ layout: 'admin', key: '/admin/posts' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-content.postList.title'), robots: 'noindex, nofollow' })
const { isLoggedIn, currentUser, restore } = useCurrentUser()
const contentContext = useState<string>('page-content-context', () => '')
const api = useAdminApi()
const route = useRoute()
const ready = ref(false)
// 筛选与路由同步、列表读取、跨页选择、单篇归档恢复分别由领域组合函数维护，页面只负责串联与生命周期。
const query = useAdminPostListQuery({
  onCriteriaChange: () => picker.clearSelection(),
  onSameCriteria: () => picker.cancel(),
  reload: () => list.load(),
})
const { search, status, category, folder, tag, sort, order, page, applyOrdering, clearFilters } = query
const list = useAdminPostListData({ api, page, applied: query.currentApplied, replacePage: query.replacePage })
const { items, total, pending, error, filters, filterError, load, loadFilters } = list
const picker = useAdminPostListSelection({ items, api, isDisabled: () => selectionDisabled.value })
const { selection, selectingAll, selectionError, clearSelection, togglePost, togglePage } = picker
const { count: selectedCount, allSelected, partiallySelected } = selection
const { working, archive, restorePost } = useAdminPostStatusChange({
  api,
  error,
  isDisabled: () => navigationDisabled.value,
  onChanged: async (post) => {
    selection.remove([post.id])
    await load()
  },
})
const batchAction = ref<PostBatchAction>('archive')
const batch = usePostBatch(async (result) => {
  picker.removeSucceeded(result)
  await load()
})
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / ADMIN_POST_PAGE_SIZE)))
const navigationDisabled = computed(() => pending.value || working.value || batch.pending.value || selectingAll.value)
const selectionDisabled = computed(() => navigationDisabled.value || !!error.value)
const resetPage = () => void query.navigate(1)
function goToPage(value: number) {
  if (navigationDisabled.value || !Number.isSafeInteger(value) || value < 1 || value > totalPages.value) return
  query.pushPage(value)
}
const selectAllFiltered = () => picker.selectAllFiltered({ ...query.currentApplied() }, total.value)
function reviewBatch() {
  if (selectionDisabled.value) return
  void batch.review(
    batchAction.value,
    selection.selectedItems.value.map(({ id, revision }) => ({ id, revision })),
  )
}
watch(
  [() => currentUser.value?.id, contentContext],
  () => {
    clearSelection()
    list.reset()
    if (ready.value && currentUser.value) void load()
  },
  { flush: 'sync' },
)
watch(
  () => route.query,
  () => {
    query.sync()
    if (ready.value) void load()
  },
  { immediate: true },
)
onMounted(async () => {
  if (await restore()) {
    ready.value = true
    await Promise.all([loadFilters(), load(), batch.loadRecent()])
    if (typeof route.query.operation === 'string' && /^[a-f0-9-]{36}$/.test(route.query.operation))
      await batch.inspect(route.query.operation)
  } else await navigateTo({ path: '/admin/login', query: { next: route.fullPath } })
})
onBeforeUnmount(() => {
  list.cancel()
  picker.invalidate()
})
</script>
<style scoped lang="scss">
.admin-posts {
  min-width: 0;
  overflow-wrap: anywhere;
}
.admin-posts__body {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}
</style>
