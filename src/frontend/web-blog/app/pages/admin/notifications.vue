<!-- @file notifications.vue @description 博主站内通知，已读与业务状态分别展示，状态来源于实时业务查询；支持全部标记已读并同步导航未读徽章 -->
<template>
  <section class="notifications">
    <header class="admin-page-header">
      <div>
        <h1 ref="heading" tabindex="-1">{{ t('admin-system.notifications.title') }}</h1>
        <p>{{ t('admin-system.notifications.intro') }}</p>
      </div>
    </header>
    <nav class="notifications__filters" :aria-label="t('admin-system.notifications.filters')">
      <NuxtLink :to="{ query: { filter: 'all' } }">{{ t('admin-system.notifications.filterAll') }}</NuxtLink
      ><NuxtLink :to="{ query: { filter: 'unread' } }">{{ t('admin-system.notifications.filterUnread') }}</NuxtLink
      ><NuxtLink to="/admin/operations">{{ t('admin-system.notifications.operationsLink') }}</NuxtLink>
    </nav>
    <CommonRequestFeedback
      v-if="pending || error"
      :pending="pending"
      :title="error || t('admin-system.notifications.loading')"
      :compact="!!data"
      @retry="refresh"
    />
    <p v-if="error && data">{{ t('admin-system.notifications.stale') }}</p>
    <p v-if="actionError" role="alert">
      {{ actionError }} <button type="button" @click="refreshAll">{{ t('admin-system.notifications.recheck') }}</button>
    </p>
    <template v-if="notificationId">
      <p v-if="!validNotificationId" role="alert">{{ t('admin-system.notifications.invalidId') }}</p>
      <CommonRequestFeedback
        v-else-if="focusedPending || focusedError"
        :pending="focusedPending"
        :title="focusedError || t('admin-system.notifications.focusedLoading')"
        :compact="!!focused"
        @retry="refreshFocused"
      />
      <p v-if="focusedError && focused">{{ t('admin-system.notifications.focusedStale') }}</p>
      <section
        v-if="focused"
        ref="focusedPanel"
        class="notifications__focused"
        :aria-label="t('admin-system.notifications.focused')"
        :data-focused-notification-id="focused.id"
        tabindex="-1"
      >
        <h2>
          {{ t('admin-system.notifications.focused') }} · {{ t(`admin-system.notifications.kinds.${focused.kind}`)
          }}<span v-if="!focused.readAt"> · {{ t('admin-system.notifications.unread') }}</span>
        </h2>
        <p>{{ t(`admin-system.notifications.states.${focused.state}`) }} · {{ formatDateTime(focused.createdAt) }}</p>
        <div class="notifications__actions">
          <NuxtLink v-if="focused.url" :to="focused.url">{{ t('admin-system.notifications.viewContent') }}</NuxtLink
          ><span v-else>{{ t('admin-system.notifications.contentGone') }}</span>
          <button v-if="!focused.readAt" type="button" :disabled="!!working" @click="markRead(focused.id)">
            {{ t('admin-system.notifications.markRead') }}
          </button>
        </div>
      </section>
    </template>
    <template v-if="data">
      <div class="notifications__summary">
        <p>{{ t('admin-system.notifications.summary', { unread: data.unread, total: data.total }) }}</p>
        <button
          v-if="data.unread"
          type="button"
          :aria-busy="working === 'all'"
          :disabled="!!working"
          @click="markAllRead"
        >
          <Icon name="lucide:check-check" aria-hidden="true" />{{
            working === 'all' ? t('admin-system.notifications.markingAll') : t('admin-system.notifications.markAllRead')
          }}
        </button>
      </div>
      <p class="notifications__status" role="status">{{ statusMessage }}</p>
      <p v-if="!data.items.length">{{ t('admin-system.notifications.empty') }}</p>
      <ol ref="list" class="notifications__list">
        <li v-for="item in data.items" :key="item.id" :data-notification-id="item.id" tabindex="-1">
          <h2>
            {{ t(`admin-system.notifications.kinds.${item.kind}`)
            }}<span v-if="!item.readAt"> · {{ t('admin-system.notifications.unread') }}</span>
          </h2>
          <p>{{ t(`admin-system.notifications.states.${item.state}`) }} · {{ formatDateTime(item.createdAt) }}</p>
          <div class="notifications__actions">
            <NuxtLink v-if="item.url" :to="item.url">{{ t('admin-system.notifications.viewContent') }}</NuxtLink
            ><span v-else>{{ t('admin-system.notifications.contentGone') }}</span>
            <button v-if="!item.readAt" type="button" :disabled="!!working" @click="markRead(item.id)">
              {{ t('admin-system.notifications.markRead') }}
            </button>
          </div>
        </li>
      </ol>
      <nav class="notifications__pagination" :aria-label="t('admin-system.notifications.pagination')">
        <NuxtLink v-if="page > 1" :to="{ query: { filter, page: page - 1 } }">{{
          t('admin-system.operations.prev')
        }}</NuxtLink
        ><span>{{ page }} / {{ Math.max(1, Math.ceil(data.total / 20)) }}</span
        ><NuxtLink v-if="page * 20 < data.total" :to="{ query: { filter, page: page + 1 } }">{{
          t('admin-system.operations.next')
        }}</NuxtLink>
      </nav>
    </template>
  </section>
</template>
<script setup lang="ts">
import type { NotificationList, OwnerNotification } from '~/features/notification/types'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-system.notifications.title'), robots: 'noindex, nofollow' })
const route = useRoute(),
  api = useAdminApi(),
  auth = useCurrentUser()
const contentContext = useState<string>('page-content-context', () => '')
const page = computed(() => Math.max(1, Number.isSafeInteger(Number(route.query.page)) ? Number(route.query.page) : 1))
const filter = computed(() => (route.query.filter === 'unread' ? 'unread' : 'all'))
const notificationId = computed(() => (typeof route.query.notification === 'string' ? route.query.notification : ''))
const validNotificationId = computed(() =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(notificationId.value),
)
const { data, pending, error, refresh, captureOwnership } = useAdminReadResource(
  () => api<NotificationList>('/admin/notifications', { query: { page: page.value, filter: filter.value } }),
  () => t('admin-system.notifications.loadFailed'),
)
const {
  data: focused,
  pending: focusedPending,
  error: focusedError,
  refresh: refreshFocused,
} = useAdminReadResource(
  () =>
    validNotificationId.value
      ? api<OwnerNotification>(`/admin/notifications/${notificationId.value}`)
      : Promise.resolve(null),
  () => t('admin-system.notifications.focusedFailed'),
)
const working = ref(''),
  actionError = ref(''),
  statusMessage = ref('')
const { success } = useToast()
const unreadBadge = useAdminNotificationUnread()
// 列表响应自带服务器未读数，直接同步导航徽章。
watch(
  () => data.value?.unread,
  (value) => {
    if (typeof value === 'number') unreadBadge.set(value)
  },
)
const list = ref<HTMLOListElement | null>(null),
  heading = ref<HTMLHeadingElement | null>(null),
  focusedPanel = ref<HTMLElement | null>(null)
watch(
  () => route.fullPath,
  () => {
    void refresh()
    void refreshFocused()
  },
)
watch(
  [() => route.fullPath, () => auth.currentUser.value?.id, contentContext],
  () => {
    working.value = ''
    actionError.value = ''
    statusMessage.value = ''
    focused.value = null
  },
  { flush: 'sync' },
)
watch(focused, async (value) => {
  const owns = captureOwnership()
  await nextTick()
  if (value && focused.value === value && owns()) {
    focusedPanel.value?.focus()
    focusedPanel.value?.scrollIntoView({ block: 'nearest' })
  }
})
async function refreshAll() {
  await Promise.all([refresh(), refreshFocused()])
}
/** 全部已读只改变已读时间，不处理审核与回复；完成后刷新列表与导航徽章，焦点回到标题 */
async function markAllRead() {
  if (working.value) return
  const owns = captureOwnership()
  working.value = 'all'
  actionError.value = ''
  statusMessage.value = ''
  try {
    const result = await api<{ updated: number; unread: number }>('/admin/notifications/read-all', {
      method: 'POST',
      body: {},
    })
    if (!owns()) return
    unreadBadge.set(result.unread)
    statusMessage.value = result.updated
      ? t('admin-system.notifications.markedAll', { count: result.updated }, result.updated)
      : t('admin-system.notifications.nothingToMark')
    if (result.updated) success(statusMessage.value)
    await refreshAll()
    await nextTick()
    if (owns()) heading.value?.focus()
  } catch {
    if (owns()) actionError.value = t('admin-system.notifications.markAllFailed')
  } finally {
    if (owns()) working.value = ''
  }
}
async function markRead(id: string) {
  if (working.value) return
  const owns = captureOwnership()
  const previousIndex = data.value?.items.findIndex((item) => item.id === id) ?? -1
  working.value = id
  actionError.value = ''
  try {
    await api(`/admin/notifications/${id}/read`, { method: 'POST', body: {} })
    if (owns()) {
      await refreshAll()
      await nextTick()
      if (owns())
        (
          (focused.value?.id === id ? focusedPanel.value : null) ??
          list.value?.querySelector<HTMLElement>(`[data-notification-id="${id}"]`) ??
          (list.value?.children[Math.max(0, previousIndex)] as HTMLElement | undefined) ??
          heading.value
        )?.focus()
    }
  } catch {
    if (owns()) actionError.value = t('admin-system.notifications.markFailed')
  } finally {
    if (owns()) working.value = ''
  }
}
</script>
<style scoped lang="scss">
.notifications {
  min-width: 0;
  overflow-wrap: anywhere;
}
h2 {
  font-size: 1rem;
  font-weight: 600;
}
p {
  color: var(--text-muted);
  margin-block: 0.75rem;
}
.notifications__summary,
.notifications__filters,
.notifications__pagination,
.notifications__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-block: 1rem;
}
ol {
  padding: 0;
  list-style: none;
}
li,
.notifications__focused {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  margin-block: 1rem;
}
a:not(.admin-btn) {
  min-width: 0;
  max-width: 100%;
  color: var(--accent);
}
.notifications__status {
  margin-block: 0;
}

.notifications__filters a,
.notifications__pagination a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}
@media (max-width: 640px) {
  .notifications__summary {
    align-items: flex-start;
    gap: 0.5rem;
  }
  .notifications__summary > p,
  .notifications__actions > span {
    flex: 1 1 100%;
  }
}
</style>
