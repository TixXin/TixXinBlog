<!-- @file notifications.vue @description 博主站内通知，已读与业务状态分别展示，状态来源于实时业务查询；支持全部标记已读并同步导航未读徽章 -->
<template>
  <section class="notifications">
    <header class="admin-page-header">
      <div>
        <h1 ref="heading" tabindex="-1">{{ t('admin-system.notifications.title') }}</h1>
        <p>{{ t('admin-system.notifications.intro') }}</p>
      </div>
    </header>
    <AdminNotificationToolbar :filter="filter" />
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
      <AdminNotificationDetail
        v-if="focused"
        ref="focusedPanel"
        :notification="focused"
        :disabled="!!working"
        @read="markRead"
      />
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
        <AdminNotificationItem
          v-for="item in data.items"
          :key="item.id"
          :item="item"
          :disabled="!!working"
          @read="markRead"
        />
      </ol>
      <nav class="notifications__pagination" :aria-label="t('admin-system.notifications.pagination')">
        <NuxtLink v-if="page > 1" :to="{ query: { filter, page: page - 1 } }">{{
          t('admin-system.operations.prev')
        }}</NuxtLink>
        <span>{{ page }} / {{ Math.max(1, Math.ceil(data.total / 20)) }}</span>
        <NuxtLink v-if="page * 20 < data.total" :to="{ query: { filter, page: page + 1 } }">{{
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
  auth = useCurrentUser(),
  { success } = useToast()
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
const unreadBadge = useAdminNotificationUnread()
const list = ref<HTMLOListElement | null>(null),
  heading = ref<HTMLHeadingElement | null>(null),
  focusedPanel = ref<{ focus(): void } | null>(null)
watch(
  () => data.value?.unread,
  (v) => {
    if (typeof v === 'number') unreadBadge.set(v)
  },
)
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
  if (value && focused.value === value && owns()) focusedPanel.value?.focus()
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
    const res = await api<{ updated: number; unread: number }>('/admin/notifications/read-all', {
      method: 'POST',
      body: {},
    })
    if (!owns()) return
    unreadBadge.set(res.unread)
    statusMessage.value = res.updated
      ? t('admin-system.notifications.markedAll', { count: res.updated }, res.updated)
      : t('admin-system.notifications.nothingToMark')
    if (res.updated) success(statusMessage.value)
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
          (focused.value?.id === id && focusedPanel.value
            ? (focusedPanel.value as unknown as { panel: HTMLElement }).panel
            : null) ??
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
p {
  margin-block: 0.375rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}
.notifications__summary,
.notifications__pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
.notifications__summary {
  margin-block: 0.75rem;
}
.notifications__pagination {
  margin-block: 1rem;
  font-size: 0.875rem;
}
ol {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0;
  list-style: none;
}
.notifications__status {
  margin-block: 0;
}
@media (max-width: 640px) {
  .notifications__summary {
    align-items: flex-start;
    gap: 0.5rem;

    > p {
      flex: 1 1 100%;
    }
  }
}
</style>
