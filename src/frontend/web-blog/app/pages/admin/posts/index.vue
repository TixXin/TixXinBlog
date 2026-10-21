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
        <form class="admin-card admin-toolbar admin-posts__filters" @submit.prevent="resetPage">
          <input
            v-model="search"
            class="admin-posts__search"
            :placeholder="$t('admin-content.postList.searchPlaceholder')"
            :aria-label="$t('admin-content.postList.searchPlaceholder')"
          />
          <select v-model="status" :aria-label="$t('admin-content.postList.statusFilter')" @change="resetPage">
            <option value="">{{ $t('admin-content.postList.allStatuses') }}</option>
            <option value="draft">{{ $t('admin-content.postStatus.draft') }}</option>
            <option value="published">{{ $t('admin-content.postStatus.published') }}</option>
            <option value="archived">{{ $t('admin-content.postStatus.archived') }}</option>
            <option value="trash">{{ $t('admin-content.postStatus.trash') }}</option>
          </select>
          <select v-model="category" :aria-label="$t('admin-content.postList.categoryFilter')" @change="resetPage">
            <option value="">{{ $t('admin-content.postList.allCategories') }}</option>
            <option value="tech">{{ $t('admin-content.postCategory.tech') }}</option>
            <option value="life">{{ $t('admin-content.postCategory.life') }}</option>
          </select>
          <select v-model="folder" :aria-label="$t('admin-content.postList.folderFilter')" @change="resetPage">
            <option value="">{{ $t('admin-content.postList.allFolders') }}</option>
            <option v-for="value in filters.folders" :key="value" :value="value">{{ value }}</option>
          </select>
          <select v-model="tag" :aria-label="$t('admin-content.postList.tagFilter')" @change="resetPage">
            <option value="">{{ $t('admin-content.postList.allTags') }}</option>
            <option v-for="value in filters.tags" :key="value" :value="value">{{ value }}</option>
          </select>
          <select
            v-model="sort"
            :aria-label="$t('admin-content.postList.sortField')"
            @change="applyOrdering('sort', $event)"
          >
            <option value="updatedAt">{{ $t('admin-content.postList.sortUpdatedAt') }}</option>
            <option value="publishedAt">{{ $t('admin-content.postList.sortPublishedAt') }}</option>
            <option value="title">{{ $t('admin-content.postList.sortTitle') }}</option>
          </select>
          <select
            v-model="order"
            :aria-label="$t('admin-content.postList.sortOrder')"
            @change="applyOrdering('order', $event)"
          >
            <option value="desc">{{ $t('admin-content.postList.desc') }}</option>
            <option value="asc">{{ $t('admin-content.postList.asc') }}</option>
          </select>
          <button :aria-busy="pending" type="submit" :disabled="pending">
            {{ $t('admin-content.postList.search') }}
          </button>
          <button type="button" class="admin-btn admin-btn--ghost" :disabled="pending" @click="clearFilters">
            {{ $t('admin-content.postList.clearFilters') }}
          </button>
        </form>
        <p v-if="filterError" role="alert">
          {{ $t('admin-content.postList.filtersFailed') }}
          <button type="button" @click="loadFilters">{{ $t('admin-content.postList.retryFilters') }}</button>
        </p>
        <p v-if="error" role="alert">
          {{ error }} <button type="button" @click="load">{{ $t('admin-content.postList.retry') }}</button>
        </p>
        <p v-if="pending" role="status">{{ $t('admin-content.postList.loading') }}</p>
        <div
          class="admin-toolbar admin-posts__batch"
          role="group"
          :aria-label="$t('admin-content.postList.batchGroup')"
        >
          <label
            ><input
              ref="pageToggle"
              type="checkbox"
              :checked="allSelected"
              :disabled="selectionDisabled || !items.length"
              @change="togglePage($event)"
            />{{ $t('admin-content.postList.selectPage') }}</label
          >
          <span role="status" aria-live="polite" aria-atomic="true">{{
            $t('admin-content.postList.selectedCount', { count: selectedCount })
          }}</span>
          <button
            type="button"
            :disabled="batch.pending.value || (!selectedCount && !selectingAll)"
            @click="clearSelection"
          >
            {{
              selectingAll ? $t('admin-content.postList.cancelSelectAll') : $t('admin-content.postList.clearSelection')
            }}
          </button>
          <CommonTooltip :content="$t('admin-content.postList.selectAllHint', { limit: POST_SELECTION_LIMIT })">
            <button
              type="button"
              :aria-busy="selectingAll"
              :disabled="selectionDisabled || !total || total > POST_SELECTION_LIMIT"
              aria-describedby="post-selection-help"
              @click="selectAllFiltered"
            >
              {{ selectingAll ? $t('admin-content.postList.selectingAll') : $t('admin-content.postList.selectAll') }}
            </button>
          </CommonTooltip>
          <select
            v-model="batchAction"
            :aria-label="$t('admin-content.postList.batchAction')"
            :disabled="selectionDisabled"
          >
            <option v-for="action in postBatchActions" :key="action" :value="action">
              {{ $t(postBatchLabelKey(action)) }}
            </option>
          </select>
          <button type="button" :disabled="selectionDisabled || !selectedCount" @click="reviewBatch">
            {{ $t('admin-content.postList.reviewBatch') }}
          </button>
        </div>
        <p id="post-selection-help" class="admin-posts__help">
          {{ $t('admin-content.postList.selectionHelp', { selection: POST_SELECTION_LIMIT, batch: POST_BATCH_LIMIT })
          }}{{ total > POST_SELECTION_LIMIT ? $t('admin-content.postList.selectionOverLimit') : '' }}
        </p>
        <p v-if="selectionError" role="alert">{{ selectionError }}</p>
        <div
          class="admin-card admin-card--table admin-posts__table"
          role="region"
          :aria-label="$t('admin-content.postList.tableRegion')"
          tabindex="0"
        >
          <table class="admin-table">
            <thead>
              <tr>
                <th>{{ $t('admin-content.postList.colTitle') }}</th>
                <th>{{ $t('admin-content.postList.colStatus') }}</th>
                <th>{{ $t('admin-content.postList.colTaxonomy') }}</th>
                <th>{{ $t('admin-content.postList.colUpdatedAt') }}</th>
                <th>{{ $t('admin-content.postList.colActions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="post in items" :key="post.id">
                <td :data-label="$t('admin-content.postList.colTitle')">
                  <input
                    type="checkbox"
                    :checked="selection.isSelected(post.id)"
                    :aria-label="$t('admin-content.postList.selectPost', { title: post.title })"
                    :disabled="selectionDisabled"
                    @change="togglePost(post.id, $event)"
                  />
                  <Icon v-if="post.pinned" name="lucide:pin" :aria-label="$t('admin-content.postList.pinned')" />{{
                    post.title
                  }}
                </td>
                <td :data-label="$t('admin-content.postList.colStatus')">
                  <span class="admin-badge" :class="statusTone(post)">{{
                    $t(`admin-content.postStatus.${post.deleted ? 'trash' : post.status}`)
                  }}</span>
                </td>
                <td :data-label="$t('admin-content.postList.colTaxonomy')">
                  {{ $t(`admin-content.postCategory.${post.category === 'tech' ? 'tech' : 'life'}`) }} / {{ post.folder
                  }}<small>{{ post.tags.join(' · ') || $t('admin-content.postList.noTags') }}</small>
                </td>
                <td :data-label="$t('admin-content.postList.colUpdatedAt')">
                  {{ formatDateTime(post.updatedAt, { hour12: false }) }}
                </td>
                <td :data-label="$t('admin-content.postList.colActions')">
                  <NuxtLink v-if="!post.deleted" class="admin-btn admin-btn--sm" :to="`/admin/posts/${post.id}`">{{
                    $t('admin-content.postList.edit')
                  }}</NuxtLink>
                  <button
                    v-if="post.status !== 'archived' && !post.deleted"
                    type="button"
                    class="admin-btn admin-btn--sm admin-btn--ghost"
                    :disabled="navigationDisabled"
                    @click="archive(post)"
                  >
                    {{ $t('admin-content.postList.archive') }}
                  </button>
                  <button
                    v-else
                    type="button"
                    class="admin-btn admin-btn--sm admin-btn--ghost"
                    :disabled="navigationDisabled"
                    @click="restorePost(post)"
                  >
                    {{ $t('admin-content.postList.restore') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
import { POST_BATCH_LIMIT, POST_SELECTION_LIMIT, postBatchActions, postBatchLabelKey } from '~/features/post/batchTypes'
import type { PostBatchAction } from '~/features/post/batchTypes'
import type { AdminPostListRow as Row } from '~/features/post/types'
definePageMeta({ layout: 'admin', key: '/admin/posts' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-content.postList.title'), robots: 'noindex, nofollow' })
const { isLoggedIn, currentUser, restore } = useCurrentUser()
const contentContext = useState<string>('page-content-context', () => '')
const { success } = useToast()
const api = useAdminApi()
const route = useRoute()
const router = useRouter()
const items = ref<Row[]>([])
// 状态徽章的辅助色：已发布绿、草稿橙、回收站红，归档保持中性
function statusTone(post: Row) {
  if (post.deleted) return 'is-danger'
  return post.status === 'published' ? 'is-success' : post.status === 'draft' ? 'is-warning' : ''
}
const total = ref(0)
const page = ref(1)
const pageSize = 20
// 与管理列表 DTO 的 pageSize 上限一致，全选时按此分页读取。
const filterPageSize = 100
/** 全选过程中检测到筛选结果变化：提示文案可直接展示，与读取失败区分 */
class FilterChangedError extends Error {}
const pageToggle = ref<HTMLInputElement | null>(null)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const search = ref(''),
  status = ref(''),
  category = ref(''),
  folder = ref('')
const tag = ref(''),
  sort = ref('updatedAt'),
  order = ref('desc')
const filters = ref<{ folders: string[]; tags: string[] }>({ folders: [], tags: [] })
const filterError = ref(false),
  pending = ref(false),
  working = ref(false),
  ready = ref(false),
  error = ref('')
const selection = useAdminBatchSelection(items, { preserveAcrossPages: true, limit: POST_SELECTION_LIMIT })
const { count: selectedCount, allSelected, partiallySelected } = selection
// indeterminate 只能写 DOM 属性，辅助技术才会读到“部分选中”。
watchEffect(() => {
  if (pageToggle.value) pageToggle.value.indeterminate = partiallySelected.value
})
const selectingAll = ref(false),
  selectionError = ref('')
let selectionVersion = 0,
  appliedQuery: Record<string, string | undefined> = {},
  filterKey = ''
const batchAction = ref<PostBatchAction>('archive')
const batch = usePostBatch(async (result) => {
  const revisions = new Map(result.preview.items.map(({ id, revision }) => [id, revision]))
  const succeeded = new Set(result.results.filter((item) => item.success).map((item) => item.id))
  selection.remove(
    selection.selectedItems.value
      .filter((item) => succeeded.has(item.id) && revisions.get(item.id) === item.revision)
      .map((item) => item.id),
  )
  await load()
})
const navigationDisabled = computed(() => pending.value || working.value || batch.pending.value || selectingAll.value)
const selectionDisabled = computed(() => navigationDisabled.value || !!error.value)
function clearSelection() {
  selectionVersion++
  selectingAll.value = false
  selectionError.value = ''
  selection.clear()
}
function togglePost(id: number, event: Event) {
  if (selectionDisabled.value) return
  const input = event.target as HTMLInputElement
  selectionError.value = selection.toggle(id, input.checked)
    ? ''
    : t('admin-content.postList.selectionLimit', { limit: POST_SELECTION_LIMIT })
  input.checked = selection.isSelected(id)
}
function togglePage(event: Event) {
  if (selectionDisabled.value) return
  const input = event.target as HTMLInputElement
  selectionError.value = selection.toggleAll(input.checked)
    ? ''
    : t('admin-content.postList.pageSelectionLimit', { limit: POST_SELECTION_LIMIT })
  input.checked = allSelected.value
  input.indeterminate = partiallySelected.value
}
function reviewBatch() {
  if (selectionDisabled.value) return
  void batch.review(
    batchAction.value,
    selection.selectedItems.value.map(({ id, revision }) => ({ id, revision })),
  )
}
async function selectAllFiltered() {
  if (selectionDisabled.value || !total.value || total.value > POST_SELECTION_LIMIT) return
  const version = ++selectionVersion
  const query = { ...appliedQuery }
  const expectedTotal = total.value
  selectingAll.value = true
  selectionError.value = ''
  // 全部读取成功后一次替换；失败、取消或筛选变化时不留下半份全选结果。
  const rows = new Map<number, Row>()
  const maxReads = Math.ceil(expectedTotal / filterPageSize)
  try {
    for (let readPage = 1; readPage <= maxReads && rows.size < expectedTotal; readPage++) {
      const result = await api<{ items: Row[]; total: number }>('/admin/posts', {
        query: { ...query, page: readPage, pageSize: filterPageSize },
      })
      if (version !== selectionVersion) return
      if (result.total !== expectedTotal || result.items.length !== Math.min(filterPageSize, expectedTotal - rows.size))
        throw new FilterChangedError(t('admin-content.postList.filterChanged'))
      for (const row of result.items) {
        if (rows.has(row.id)) throw new FilterChangedError(t('admin-content.postList.filterReordered'))
        rows.set(row.id, row)
      }
    }
    if (version !== selectionVersion) return
    if (rows.size !== expectedTotal) throw new FilterChangedError(t('admin-content.postList.filterChanged'))
    selection.replaceSelection([...rows.values()])
  } catch (cause) {
    if (version === selectionVersion)
      selectionError.value =
        cause instanceof FilterChangedError ? cause.message : t('admin-content.postList.selectAllFailed')
  } finally {
    if (version === selectionVersion) selectingAll.value = false
  }
}
let requestVersion = 0
function syncQuery() {
  const text = (key: string) => (typeof route.query[key] === 'string' ? (route.query[key] as string) : '')
  const nextStatus = ['draft', 'published', 'archived', 'trash'].includes(text('status')) ? text('status') : ''
  const nextCategory = ['tech', 'life'].includes(text('category')) ? text('category') : ''
  const nextSort = ['updatedAt', 'publishedAt', 'title'].includes(text('sort')) ? text('sort') : 'updatedAt'
  const nextOrder = text('order') === 'asc' ? 'asc' : 'desc'
  const criteria = {
    search: text('search').trim() || undefined,
    status: nextStatus || undefined,
    category: nextCategory || undefined,
    folder: text('folder') || undefined,
    tag: text('tag') || undefined,
  }
  const nextKey = JSON.stringify(criteria)
  // 只翻页或改排序时保留搜索框草稿；筛选条件本身变化才回填表单并清空选择。
  if (nextKey !== filterKey) {
    search.value = text('search')
    status.value = nextStatus
    category.value = nextCategory
    folder.value = text('folder')
    tag.value = text('tag')
    clearSelection()
  } else {
    selectionVersion++
    selectingAll.value = false
  }
  sort.value = nextSort
  order.value = nextOrder
  const value = Number(text('page'))
  page.value = Number.isSafeInteger(value) && value > 0 ? value : 1
  filterKey = nextKey
  appliedQuery = { ...criteria, sort: nextSort, order: nextOrder }
}
async function navigate(pageNumber: number) {
  const query: Record<string, string> = { sort: sort.value, order: order.value }
  for (const [key, value] of Object.entries({
    search: search.value.trim(),
    status: status.value,
    category: category.value,
    folder: folder.value,
    tag: tag.value,
  })) {
    if (value) query[key] = value
  }
  if (pageNumber > 1) query.page = String(pageNumber)
  const target = router.resolve({ path: '/admin/posts', query }).fullPath
  if (target === route.fullPath) await load()
  else await router.push({ path: '/admin/posts', query })
}
function resetPage() {
  void navigate(1)
}
function goToPage(value: number) {
  if (navigationDisabled.value || !Number.isSafeInteger(value) || value < 1 || value > totalPages.value) return
  // 翻页只改变已应用查询的页码，搜索框中的未提交输入不隐式变成筛选。
  if (value !== page.value) void router.push({ path: '/admin/posts', query: pageQuery(value) })
}
function applyOrdering(kind: 'sort' | 'order', event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (kind === 'sort') sort.value = ['updatedAt', 'publishedAt', 'title'].includes(value) ? value : 'updatedAt'
  else order.value = value === 'asc' ? 'asc' : 'desc'
  // 排序回到第一页，但仍使用已应用的筛选，不把搜索框草稿提交出去。
  const query = pageQuery(1)
  query.sort = sort.value
  query.order = order.value
  const target = router.resolve({ path: '/admin/posts', query }).fullPath
  if (target !== route.fullPath) void router.push({ path: '/admin/posts', query })
}
function pageQuery(value: number) {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(appliedQuery)) if (value) query[key] = value
  if (value > 1) query.page = String(value)
  return query
}
function clearFilters() {
  search.value = status.value = category.value = folder.value = tag.value = ''
  sort.value = 'updatedAt'
  order.value = 'desc'
  resetPage()
}
async function loadFilters() {
  filterError.value = false
  try {
    filters.value = await api('/admin/posts/filters')
  } catch {
    filterError.value = true
  }
}
async function load() {
  const version = ++requestVersion
  pending.value = true
  error.value = ''
  try {
    const result = await api<{ items: Row[]; total: number }>('/admin/posts', {
      query: {
        page: page.value,
        pageSize,
        ...appliedQuery,
      },
    })
    if (version !== requestVersion) return
    items.value = result.items
    total.value = result.total
    const lastPage = Math.max(1, Math.ceil(result.total / pageSize))
    if (page.value > lastPage) await router.replace({ path: '/admin/posts', query: pageQuery(lastPage) })
  } catch {
    if (version === requestVersion) {
      items.value = []
      error.value = t('admin-content.postList.loadFailed')
    }
  } finally {
    if (version === requestVersion) pending.value = false
  }
}
async function changeStatus(post: Row, restoreArchived: boolean) {
  if (navigationDisabled.value) return
  if (
    !window.confirm(
      restoreArchived
        ? t('admin-content.postList.restoreConfirm', { title: post.title })
        : t('admin-content.postList.archiveConfirm', { title: post.title }),
    )
  )
    return
  working.value = true
  error.value = ''
  try {
    await api(`/admin/posts/${post.id}${restoreArchived ? '/restore' : ''}`, {
      method: restoreArchived ? 'POST' : 'DELETE',
      query: { revision: post.revision },
    })
    clearNuxtData((key) => key.startsWith('article-') || key.startsWith('post-'))
    success(restoreArchived ? t('admin-content.postList.restored') : t('admin-content.postList.archived'))
    selection.remove([post.id])
    await load()
  } catch {
    error.value = restoreArchived
      ? t('admin-content.postList.restoreFailed')
      : t('admin-content.postList.archiveFailed')
  } finally {
    working.value = false
  }
}
function archive(post: Row) {
  void changeStatus(post, false)
}
function restorePost(post: Row) {
  void changeStatus(post, true)
}
watch(
  [() => currentUser.value?.id, contentContext],
  () => {
    clearSelection()
    requestVersion++
    items.value = []
    total.value = 0
    pending.value = false
    if (ready.value && currentUser.value) void load()
  },
  { flush: 'sync' },
)
watch(
  () => route.query,
  () => {
    syncQuery()
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
  requestVersion += 1
  selectionVersion += 1
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
.admin-posts__filters {
  padding: 0.75rem;
}
.admin-posts__search {
  flex: 1 1 14rem;
}
.admin-posts__batch {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-soft);
  border-radius: 0.5rem;
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 0.875rem;

  label {
    display: inline-flex;
    align-items: center;
    font-weight: 500;
  }
}
.admin-posts__help {
  margin: -0.25rem 0 0;
  padding: 0 0.25rem;
  color: var(--text-soft);
  font-size: 0.75rem;
}
.admin-posts small {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-soft);
  font-size: 0.75rem;
}
.admin-posts__table {
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  td:first-child {
    font-weight: 500;

    input[type='checkbox'] {
      margin-right: 0.5rem;
    }
    :deep(.iconify) {
      margin-right: 0.25rem;
      color: var(--warning-text);
      vertical-align: text-bottom;
    }
  }
  td:last-child {
    white-space: nowrap;
  }
  td:last-child > * + * {
    margin-left: 0.375rem;
  }
}
@media (max-width: 700px) {
  .admin-posts__filters > *,
  .admin-posts__batch select,
  .admin-posts__batch button {
    width: 100%;
  }
  .admin-posts__table {
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none;
  }
  .admin-posts table,
  .admin-posts tbody,
  .admin-posts tr,
  .admin-posts td {
    display: block;
  }
  .admin-posts thead {
    display: none;
  }
  .admin-posts tr {
    margin: 0 0 0.75rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--admin-card-border);
    border-radius: var(--admin-radius-card);
    background: var(--admin-card-bg);
  }
  .admin-posts td {
    padding: 0.375rem 0;
    border: 0;
  }
  .admin-posts td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 0.125rem;
    color: var(--text-soft);
    font-size: 0.75rem;
  }
  .admin-posts td:first-child {
    font-weight: 600;
  }
}
</style>
