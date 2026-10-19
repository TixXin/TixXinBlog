<!-- @file moment-comments.vue @description 跨动态审核评论，复用现有审核冲突保护和删除接口。 -->
<template>
  <section class="moment-comments">
    <h1>{{ t('admin-content.momentComments.title') }}</h1>
    <p>{{ t('admin-content.momentComments.intro') }}</p>
    <nav class="moment-comments__actions" :aria-label="t('admin-content.momentComments.filters')">
      <NuxtLink
        v-for="(label, value) in labels"
        :key="value"
        :to="{ path: '/admin/moment-comments', query: value === 'all' ? {} : { status: value } }"
        :aria-current="status === value ? 'page' : undefined"
        >{{ label }}</NuxtLink
      >
      <NuxtLink to="/admin/moments">{{ t('admin-content.momentComments.manageMoments') }}</NuxtLink>
    </nav>
    <CommonRequestFeedback
      v-if="pending || error"
      :pending="pending"
      :compact="!!data"
      :title="error || t('admin-content.momentComments.loading')"
      @retry="load"
    />
    <p v-if="stale && data" role="status">{{ t('admin-content.momentComments.stale') }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <template v-if="data">
      <p v-if="!pending && !error && !data.items.length">{{ t('admin-content.momentComments.empty') }}</p>
      <ul class="moment-comments__list">
        <li v-for="item in data.items" :key="item.id">
          <p>
            <strong>{{ item.author }}</strong
            >{{ item.isOwner ? ` · ${t('admin-content.momentComments.owner')}` : '' }} ·
            {{ labels[item.moderationStatus] }} · {{ item.time.slice(0, 16).replace('T', ' ') }} UTC
          </p>
          <p>{{ item.content }}</p>
          <blockquote>
            <NuxtLink :to="'/admin/moments/' + encodeURIComponent(item.momentId)">{{ item.momentContent }}</NuxtLink> ·
            {{ momentLabels[item.momentStatus] }}
          </blockquote>
          <div class="moment-comments__actions">
            <button
              v-if="item.moderationStatus !== 'published'"
              type="button"
              :disabled="pending || stale || busy"
              @click="change(item, 'published')"
            >
              {{ t('admin-content.momentComments.approve') }}
            </button>
            <button
              v-if="item.moderationStatus !== 'hidden'"
              type="button"
              :disabled="pending || stale || busy"
              @click="change(item, 'hidden')"
            >
              {{ t('admin-content.momentComments.hide') }}
            </button>
            <button type="button" :disabled="pending || stale || busy" @click="change(item, 'delete')">
              {{ t('admin-content.momentComments.remove') }}
            </button>
          </div>
        </li>
      </ul>
      <nav
        v-if="data.total > 20 || page > 1"
        class="moment-comments__actions"
        :aria-label="t('admin-content.momentComments.pagination')"
      >
        <button type="button" :disabled="pending || busy || page <= 1" @click="setPage(page - 1)">
          {{ t('admin-content.momentComments.previous') }}
        </button>
        <span>{{
          t('admin-content.momentComments.pageSummary', {
            page,
            pages: Math.max(1, Math.ceil(data.total / 20)),
            total: data.total,
          })
        }}</span>
        <button type="button" :disabled="pending || busy || page * 20 >= data.total" @click="setPage(page + 1)">
          {{ t('admin-content.momentComments.next') }}
        </button>
      </nav>
    </template>
  </section>
</template>
<script setup lang="ts">
import type { ManagedMomentComment } from '~/features/moment/types'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-content.momentComments.title'), robots: 'noindex, nofollow' })
const route = useRoute(),
  router = useRouter(),
  api = useAdminApi(),
  auth = useCurrentUser()
const STATUSES = ['all', 'pending', 'published', 'hidden'] as const
const labels = computed(() =>
  Object.fromEntries(STATUSES.map((value) => [value, t(`admin-content.momentComments.status.${value}`)])),
)
const momentLabels = computed(() => ({
  published: t('admin-content.momentComments.momentStatus.published'),
  draft: t('admin-content.momentComments.momentStatus.draft'),
  archived: t('admin-content.momentComments.momentStatus.archived'),
}))
const status = computed(() =>
  typeof route.query.status === 'string' && (STATUSES as readonly string[]).includes(route.query.status)
    ? route.query.status
    : 'all',
)
const page = computed(() => {
  const value = Number(route.query.page)
  return Number.isInteger(value) && value > 0 ? Math.min(value, 10000) : 1
})
const data = ref<{ items: ManagedMomentComment[]; total: number } | null>(null)
const pending = ref(false),
  busy = ref(false),
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
    const result = await api<{ items: ManagedMomentComment[]; total: number }>('/admin/moments/comments', {
      query: { status: status.value, page: page.value, pageSize: 20 },
    })
    if (!alive || current !== version || actor !== auth.currentUser.value?.id) return
    data.value = result
    loadedPath.value = path
    if (page.value > Math.max(1, Math.ceil(result.total / 20))) await setPage(Math.max(1, Math.ceil(result.total / 20)))
  } catch {
    if (alive && current === version) error.value = t('admin-content.momentComments.loadFailed')
  } finally {
    if (alive && current === version) pending.value = false
  }
}
function setPage(value: number) {
  return router.replace({
    path: '/admin/moment-comments',
    query: { ...route.query, page: value > 1 ? String(value) : undefined },
  })
}
async function change(item: ManagedMomentComment, action: 'published' | 'hidden' | 'delete') {
  if (busy.value || pending.value || stale.value) return
  if (action === 'delete' && !window.confirm(t('admin-content.momentComments.deleteConfirm'))) return
  busy.value = true
  error.value = ''
  notice.value = ''
  const actor = auth.currentUser.value?.id,
    path = route.fullPath
  try {
    await api(`/admin/moments/${encodeURIComponent(item.momentId)}/comments/${encodeURIComponent(item.id)}`, {
      method: action === 'delete' ? 'DELETE' : 'PATCH',
      ...(action === 'delete' ? {} : { body: { status: action, expectedStatus: item.moderationStatus } }),
    })
    if (!alive || actor !== auth.currentUser.value?.id) return
    if (path === route.fullPath)
      notice.value = t(
        action === 'delete' ? 'admin-content.momentComments.deleted' : 'admin-content.momentComments.updated',
      )
    await load()
  } catch (cause) {
    if (alive && actor === auth.currentUser.value?.id) {
      await load()
      error.value = apiErrorMessage(cause, 'admin-content.momentComments.changeFailed')
    }
  } finally {
    if (alive) busy.value = false
  }
}
watch(
  () => route.fullPath,
  () => {
    if (route.path === '/admin/moment-comments' && auth.isLoggedIn.value) void load()
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
.moment-comments {
  min-width: 0;
  overflow-wrap: anywhere;
}
h1 {
  font-size: 1.75rem;
  font-weight: 700;
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
  min-width: 0;
  padding: 1rem;
  margin: 1rem 0;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
a {
  color: var(--accent);
  overflow-wrap: anywhere;
}
.moment-comments__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}
.moment-comments__actions a,
button {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
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
@media (max-width: 640px) {
  .moment-comments__list > li {
    padding: 0.75rem;
  }
}
</style>
