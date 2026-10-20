<!-- @file flash-comments.vue @description 跨闪念审核评论：按状态筛选、单条通过/隐藏/删除与当前页批量操作，以提交时状态做冲突保护 -->
<template>
  <section class="flash-comments">
    <header class="admin-page-header">
      <div>
        <h1>{{ t('admin-content.flashComments.title') }}</h1>
        <p>{{ t('admin-content.flashComments.intro') }}</p>
      </div>
    </header>
    <nav class="flash-comments__actions" :aria-label="t('admin-content.flashComments.filters')">
      <NuxtLink
        v-for="(label, value) in labels"
        :key="value"
        :to="{ path: '/admin/flash-comments', query: value === 'all' ? {} : { status: value } }"
        :aria-current="status === value && !commentId ? 'page' : undefined"
        >{{ label }}</NuxtLink
      >
      <NuxtLink to="/admin/flashes">{{ t('admin-content.flashComments.manageFlashes') }}</NuxtLink>
      <NuxtLink to="/admin/comments">{{ t('admin-content.flashComments.policyLink') }}</NuxtLink>
    </nav>
    <p v-if="commentId" role="status">
      {{ t('admin-content.flashComments.singleNotice')
      }}<NuxtLink to="/admin/flash-comments">{{ t('admin-content.flashComments.viewAll') }}</NuxtLink>
    </p>
    <CommonRequestFeedback
      v-if="pending || error"
      :pending="pending"
      :compact="!!data"
      :title="error || t('admin-content.flashComments.loading')"
      @retry="load"
    />
    <p v-if="stale && data" role="status">{{ t('admin-content.flashComments.stale') }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <template v-if="data">
      <p v-if="!pending && !error && !data.items.length">{{ t('admin-content.flashComments.empty') }}</p>
      <AdminBatchBar
        v-if="data.items.length"
        :noun="(count: number) => t('admin-content.flashComments.batch.noun', count)"
        :count="selection.count.value"
        :page-count="data.items.length"
        :all-selected="selection.allSelected.value"
        :partially-selected="selection.partiallySelected.value"
        :actions="batchActions"
        :disabled="pending || stale || busy"
        :busy="batchBusy"
        @toggle-all="selection.toggleAll"
        @action="(key) => batch(key as 'published' | 'hidden' | 'delete')"
        @clear="selection.clear"
      />
      <ul>
        <li
          v-for="item in data.items"
          :key="item.id"
          :data-flash-comment-id="item.id"
          :class="{ 'is-selected': selection.isSelected(item.id) }"
        >
          <label class="flash-comments__select"
            ><input
              type="checkbox"
              :checked="selection.isSelected(item.id)"
              :disabled="pending || stale || busy"
              :aria-label="
                t('admin-content.flashComments.select', { author: item.authorName, excerpt: item.content.slice(0, 40) })
              "
              @change="selection.toggle(item.id, ($event.target as HTMLInputElement).checked)"
          /></label>
          <p>
            <strong>{{ item.authorName }}</strong> · {{ labels[item.moderationStatus] }} ·
            {{ item.createdAt.slice(0, 16).replace('T', ' ') }} UTC
          </p>
          <p>{{ item.content }}</p>
          <blockquote>
            <NuxtLink :to="{ path: '/admin/flashes', query: { comments: item.flashId, commentId: item.id } }">{{
              item.flashContent
            }}</NuxtLink>
            · {{ flashLabels[item.flashStatus] }}
          </blockquote>
          <div class="flash-comments__actions">
            <button
              v-if="item.moderationStatus !== 'published'"
              type="button"
              :disabled="pending || stale || busy"
              @click="change(item, 'published')"
            >
              {{ t('admin-content.flashComments.approve') }}
            </button>
            <button
              v-if="item.moderationStatus !== 'hidden'"
              type="button"
              :disabled="pending || stale || busy"
              @click="change(item, 'hidden')"
            >
              {{ t('admin-content.flashComments.hide') }}
            </button>
            <button type="button" :disabled="pending || stale || busy" @click="change(item, 'delete')">
              {{ t('admin-content.flashComments.remove') }}
            </button>
          </div>
        </li>
      </ul>
      <nav
        v-if="data.total > PAGE_SIZE || page > 1"
        class="flash-comments__actions"
        :aria-label="t('admin-content.flashComments.pagination')"
      >
        <button type="button" :disabled="pending || busy || page <= 1" @click="setPage(page - 1)">
          {{ t('admin-content.flashComments.previous') }}
        </button>
        <span>{{
          t('admin-content.flashComments.pageSummary', {
            page,
            pages: Math.max(1, Math.ceil(data.total / PAGE_SIZE)),
            total: data.total,
          })
        }}</span>
        <button type="button" :disabled="pending || busy || page * PAGE_SIZE >= data.total" @click="setPage(page + 1)">
          {{ t('admin-content.flashComments.next') }}
        </button>
      </nav>
    </template>
  </section>
</template>
<script setup lang="ts">
import type { ManagedFlashComment } from '~/features/flash/types'
import type { AdminBatchAction, AdminBatchResult } from '~/composables/useAdminBatchSelection'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-content.flashComments.title'), robots: 'noindex, nofollow' })
const PAGE_SIZE = 20
const route = useRoute(),
  router = useRouter(),
  api = useAdminApi(),
  auth = useCurrentUser(),
  toast = useToast()
const STATUSES = ['all', 'pending', 'published', 'hidden'] as const
const labels = computed(() =>
  Object.fromEntries(STATUSES.map((value) => [value, t(`admin-content.flashComments.status.${value}`)])),
)
const flashLabels = computed(() => ({
  published: t('admin-content.flashComments.flashStatus.published'),
  draft: t('admin-content.flashComments.flashStatus.draft'),
  archived: t('admin-content.flashComments.flashStatus.archived'),
}))
const batchActions = computed<AdminBatchAction[]>(() => [
  { key: 'published', label: t('admin-content.flashComments.batch.approve'), icon: 'lucide:check' },
  { key: 'hidden', label: t('admin-content.flashComments.batch.hide'), icon: 'lucide:eye-off' },
  { key: 'delete', label: t('admin-content.flashComments.batch.delete'), icon: 'lucide:trash-2', danger: true },
])
const status = computed(() =>
  typeof route.query.status === 'string' && (STATUSES as readonly string[]).includes(route.query.status)
    ? route.query.status
    : 'all',
)
const commentId = computed(() =>
  typeof route.query.commentId === 'string' && /^[\w-]{1,64}$/.test(route.query.commentId) ? route.query.commentId : '',
)
const page = computed(() => {
  const value = Number(route.query.page)
  return Number.isInteger(value) && value > 0 ? Math.min(value, 10000) : 1
})
const data = ref<{ items: ManagedFlashComment[]; total: number } | null>(null)
const items = computed(() => data.value?.items ?? [])
const selection = useAdminBatchSelection(items)
const pending = ref(false),
  busy = ref(false),
  batchBusy = ref(''),
  error = ref(''),
  notice = ref(''),
  loadedPath = ref('')
const stale = computed(() => loadedPath.value !== route.fullPath)
let version = 0,
  alive = true
async function load() {
  const current = ++version,
    path = route.fullPath,
    actor = auth.currentUser.value?.id
  pending.value = true
  error.value = ''
  try {
    const result = await api<{ items: ManagedFlashComment[]; total: number }>('/admin/flashes/comments', {
      query: {
        status: status.value,
        page: page.value,
        pageSize: PAGE_SIZE,
        ...(commentId.value ? { commentId: commentId.value } : {}),
      },
    })
    if (!alive || current !== version || actor !== auth.currentUser.value?.id) return
    data.value = result
    loadedPath.value = path
    const last = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    if (page.value > last) await setPage(last)
  } catch {
    if (alive && current === version) error.value = t('admin-content.flashComments.loadFailed')
  } finally {
    if (alive && current === version) pending.value = false
  }
}
function setPage(value: number) {
  return router.replace({
    path: '/admin/flash-comments',
    query: { ...route.query, page: value > 1 ? String(value) : undefined },
  })
}
async function change(item: ManagedFlashComment, action: 'published' | 'hidden' | 'delete') {
  if (busy.value || pending.value || stale.value) return
  if (action === 'delete' && !window.confirm(t('admin-content.flashComments.deleteConfirm'))) return
  busy.value = true
  error.value = ''
  notice.value = ''
  const actor = auth.currentUser.value?.id,
    path = route.fullPath
  try {
    await api(`/admin/flashes/${encodeURIComponent(item.flashId)}/comments/${encodeURIComponent(item.id)}`, {
      method: action === 'delete' ? 'DELETE' : 'PATCH',
      ...(action === 'delete' ? {} : { body: { status: action, expectedStatus: item.moderationStatus } }),
    })
    if (!alive || actor !== auth.currentUser.value?.id) return
    if (path === route.fullPath)
      notice.value = t(
        action === 'delete' ? 'admin-content.flashComments.deleted' : 'admin-content.flashComments.updated',
      )
    await load()
  } catch (cause) {
    if (alive && actor === auth.currentUser.value?.id) {
      await load()
      error.value = apiErrorMessage(cause, 'admin-content.flashComments.changeFailed')
    }
  } finally {
    if (alive) busy.value = false
  }
}
/** 批量通过、隐藏或删除当前页选中的评论；以选中时看到的状态校验，跳过已变化或已删除的项并提示刷新核对 */
async function batch(action: 'published' | 'hidden' | 'delete') {
  const selected = selection.selectedItems.value
  if (!selected.length || busy.value || pending.value || stale.value) return
  const remove = action === 'delete'
  if (remove && !window.confirm(t('admin-content.flashComments.batch.deleteConfirm', { count: selected.length })))
    return
  busy.value = true
  batchBusy.value = action
  error.value = ''
  notice.value = ''
  const actor = auth.currentUser.value?.id
  try {
    const body = { items: selected.map((item) => ({ id: item.id, expectedStatus: item.moderationStatus })) }
    const result = await api<AdminBatchResult>(
      remove ? '/admin/flashes/comments/batch/delete' : '/admin/flashes/comments/batch/moderation',
      { method: 'POST', body: remove ? body : { ...body, status: action } },
    )
    if (!alive || actor !== auth.currentUser.value?.id) return
    selection.clear()
    await load()
    const message = describeBatchResult(
      result,
      t(
        remove
          ? 'admin-content.flashComments.batch.deleted'
          : action === 'published'
            ? 'admin-content.flashComments.batch.approved'
            : 'admin-content.flashComments.batch.hidden',
      ),
      (count: number) => t('admin-content.flashComments.batch.noun', count),
      // 在 await 之后调用，显式传入翻译函数，不依赖当时的组件上下文
      t,
    )
    // 列表重新读取会清空错误提示，因此在刷新之后再展示跳过项。
    if (result.failedCount) error.value = message
    else toast.success(message)
  } catch (cause) {
    if (alive && actor === auth.currentUser.value?.id) {
      await load()
      error.value = apiErrorMessage(cause, 'admin-content.flashComments.batch.failed')
    }
  } finally {
    if (alive) {
      busy.value = false
      batchBusy.value = ''
    }
  }
}
watch(
  () => route.fullPath,
  () => {
    if (route.path === '/admin/flash-comments' && auth.isLoggedIn.value) void load()
  },
)
watch(
  () => auth.currentUser.value?.id,
  () => {
    data.value = null
    version++
  },
)
onMounted(async () => {
  if (await auth.restore()) await load()
  else await navigateTo({ path: '/admin/login', query: { next: route.fullPath } })
})
onBeforeUnmount(() => {
  alive = false
  version++
})
</script>
<style scoped lang="scss">
.flash-comments {
  min-width: 0;
}
p,
blockquote {
  margin: 0.75rem 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
blockquote {
  color: var(--text-muted);
}
ul {
  list-style: none;
  padding: 0;
}
li {
  position: relative;
  padding: 1rem 1rem 1rem 3rem;
  margin: 1rem 0;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
li.is-selected {
  border-color: var(--accent);
}
.flash-comments__select {
  position: absolute;
  top: 0.75rem;
  left: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}
.flash-comments__select input {
  width: 1.1rem;
  height: 1.1rem;
}
a:not(.admin-btn) {
  color: var(--accent);
  overflow-wrap: anywhere;
}
.flash-comments__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}
.flash-comments__actions a,
.flash-comments__actions button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
[aria-current='page'] {
  border-color: var(--accent);
  color: var(--accent);
}
:disabled {
  opacity: 0.5;
}
</style>
