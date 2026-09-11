<!-- @file notifications.vue @description 博主站内通知，已读与业务状态分别展示，状态来源于实时业务查询 -->
<template>
  <section class="notifications">
    <h1 ref="heading" tabindex="-1">互动通知</h1>
    <p>已读只表示你看过通知。审核和回复请进入对应内容处理。</p>
    <nav aria-label="通知筛选">
      <NuxtLink :to="{ query: { filter: 'all' } }">全部</NuxtLink
      ><NuxtLink :to="{ query: { filter: 'unread' } }">未读</NuxtLink
      ><NuxtLink to="/admin/operations">邮件与运行状态</NuxtLink>
    </nav>
    <CommonRequestFeedback
      v-if="pending || error"
      :pending="pending"
      :title="error || '正在读取通知'"
      :compact="!!data"
      @retry="refresh"
    />
    <p v-if="error && data">当前显示上次读取结果，请重试后判断业务状态。</p>
    <p v-if="actionError" role="alert">
      {{ actionError }} <button type="button" @click="refreshAll">核对当前状态</button>
    </p>
    <template v-if="notificationId">
      <p v-if="!validNotificationId" role="alert">指定通知编号无效，请从通知列表重新进入。</p>
      <CommonRequestFeedback
        v-else-if="focusedPending || focusedError"
        :pending="focusedPending"
        :title="focusedError || '正在读取指定通知'"
        :compact="!!focused"
        @retry="refreshFocused"
      />
      <p v-if="focusedError && focused">以下保留此前通知，请重试后判断业务状态。</p>
      <section
        v-if="focused"
        ref="focusedPanel"
        class="notifications__focused"
        aria-label="指定通知"
        :data-focused-notification-id="focused.id"
        tabindex="-1"
      >
        <h2>指定通知 · {{ kinds[focused.kind] }}<span v-if="!focused.readAt"> · 未读</span></h2>
        <p>{{ states[focused.state] }} · {{ new Date(focused.createdAt).toLocaleString('zh-CN') }}</p>
        <div class="notifications__actions">
          <NuxtLink v-if="focused.url" :to="focused.url">查看对应内容</NuxtLink
          ><span v-else>内容已删除或隐藏，当前无法打开。</span>
          <button v-if="!focused.readAt" type="button" :disabled="!!working" @click="markRead(focused.id)">
            标记已读
          </button>
        </div>
      </section>
    </template>
    <template v-if="data">
      <p>未读 {{ data.unread }} 条 · 当前筛选 {{ data.total }} 条</p>
      <p v-if="!data.items.length">当前筛选下没有通知。</p>
      <ol ref="list">
        <li v-for="item in data.items" :key="item.id" :data-notification-id="item.id" tabindex="-1">
          <h2>{{ kinds[item.kind] }}<span v-if="!item.readAt"> · 未读</span></h2>
          <p>{{ states[item.state] }} · {{ new Date(item.createdAt).toLocaleString('zh-CN') }}</p>
          <div>
            <NuxtLink v-if="item.url" :to="item.url">查看对应内容</NuxtLink
            ><span v-else>内容已删除或隐藏，当前无法打开。</span>
            <button v-if="!item.readAt" type="button" :disabled="!!working" @click="markRead(item.id)">标记已读</button>
          </div>
        </li>
      </ol>
      <nav aria-label="通知分页">
        <NuxtLink v-if="page > 1" :to="{ query: { filter, page: page - 1 } }">上一页</NuxtLink
        ><span>{{ page }} / {{ Math.max(1, Math.ceil(data.total / 20)) }}</span
        ><NuxtLink v-if="page * 20 < data.total" :to="{ query: { filter, page: page + 1 } }">下一页</NuxtLink>
      </nav>
    </template>
  </section>
</template>
<script setup lang="ts">
import type { NotificationList, OwnerNotification } from '~/features/notification/types'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '互动通知', robots: 'noindex, nofollow' })
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
  '通知读取失败，请重试',
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
  '指定通知不存在或暂时无法读取，请重试或查看通知列表',
)
const working = ref(''),
  actionError = ref('')
const list = ref<HTMLOListElement | null>(null),
  heading = ref<HTMLHeadingElement | null>(null),
  focusedPanel = ref<HTMLElement | null>(null)
const kinds = { comment: '文章评论', guestbook: '留言互动', 'moment-comment': '朋友圈评论', task: '运行异常' }
const states = {
  pending_review: '等待审核',
  awaiting_reply: '尚待博主回复',
  available: '可以查看',
  handled: '对应事项已处理',
  unavailable: '对应内容不可用',
  failed: '任务需要处理',
}
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
    if (owns()) actionError.value = '已读状态未确认，请刷新核对；这不会改变互动处理状态。'
  } finally {
    if (owns()) working.value = ''
  }
}
</script>
<style scoped lang="scss">
.notifications {
  overflow-wrap: anywhere;
}
h1 {
  font-size: 1.5rem;
}
h2 {
  font-size: 1rem;
  font-weight: 600;
}
p {
  color: var(--text-muted);
  margin-block: 0.75rem;
}
nav,
li div,
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
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  margin-block: 1rem;
}
a {
  color: var(--accent);
}
button {
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
</style>
