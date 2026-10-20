<!--
  @file PostHistory.vue
  @description 修订历史分页、差异比较与显式恢复入口，实际恢复由编辑工作区处理。
-->
<template>
  <section class="post-history" :aria-label="$t('admin-content.postHistory.region')">
    <button type="button" @click="open = !open">
      {{ open ? $t('admin-content.postHistory.collapse') : $t('admin-content.postHistory.expand') }}
    </button>
    <template v-if="open">
      <p v-if="pending" role="status">{{ $t('admin-content.postHistory.loading') }}</p>
      <p v-if="error" role="alert">
        {{ error }} <button type="button" @click="load">{{ $t('admin-content.postHistory.retry') }}</button>
      </p>
      <p v-if="!pending && !error && !items.length">{{ $t('admin-content.postHistory.empty') }}</p>
      <ul>
        <li v-for="item in items" :key="item.revision">
          <span>{{
            $t('admin-content.postHistory.item', {
              revision: item.revision,
              reason: item.reason,
              time: formatDateTime(item.createdAt, { hour12: false }),
            })
          }}</span
          ><button type="button" :disabled="pending || busy" @click="inspect(item.revision)">
            {{ $t('admin-content.postHistory.compare', { revision: item.revision }) }}
          </button>
        </li>
      </ul>
      <button type="button" :disabled="pending || page <= 1" @click="previousPage">
        {{ $t('admin-content.postHistory.prev') }}</button
      ><span>{{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }}</span
      ><button type="button" :disabled="pending || page * 20 >= total" @click="nextPage">
        {{ $t('admin-content.postHistory.next') }}
      </button>
      <AdminPostConflict
        v-if="selected"
        :local="selected.snapshot"
        :server="current"
        :title="$t('admin-content.postHistory.compareTitle')"
        :description="$t('admin-content.postHistory.compareDescription')"
        :local-label="$t('admin-content.postHistory.compareLocal')"
        :server-label="$t('admin-content.postHistory.compareServer')"
        :use-server-label="$t('admin-content.postHistory.compareClose')"
        :keep-local-label="$t('admin-content.postHistory.compareLoad')"
        @use-server="selected = null"
        @keep-local="$emit('loadSnapshot', selected.snapshot)"
      />
      <button v-if="selected" type="button" :disabled="busy" @click="$emit('restoreRevision', selected.revision)">
        {{ $t('admin-content.postHistory.restore', { revision: selected.revision }) }}
      </button>
    </template>
  </section>
</template>
<script setup lang="ts">
import type { AdminPostDraft } from '~/features/post/adminTypes'
const props = defineProps<{ postId: number; current: AdminPostDraft; busy: boolean }>()
defineEmits<{ loadSnapshot: [draft: AdminPostDraft]; restoreRevision: [revision: number] }>()
const api = useAdminApi()
const { t } = useI18n()
const open = ref(false)
const page = ref(1)
const total = ref(0)
const pending = ref(false)
const error = ref('')
const items = ref<{ revision: number; reason: string; createdAt: string }[]>([])
const selected = ref<{ revision: number; snapshot: AdminPostDraft } | null>(null)
async function load() {
  if (pending.value) return
  pending.value = true
  error.value = ''
  try {
    const result = await api<{ items: typeof items.value; total: number }>(`/admin/posts/${props.postId}/revisions`, {
      query: { page: page.value },
    })
    items.value = result.items
    total.value = result.total
  } catch {
    error.value = t('admin-content.postHistory.loadFailed')
  } finally {
    pending.value = false
  }
}
async function inspect(revision: number) {
  pending.value = true
  error.value = ''
  try {
    const result = await api<{ revision: number; snapshot: AdminPostDraft }>(
      `/admin/posts/${props.postId}/revisions/${revision}`,
    )
    selected.value = { ...result, snapshot: { ...result.snapshot, revision } }
  } catch {
    error.value = t('admin-content.postHistory.inspectFailed')
  } finally {
    pending.value = false
  }
}
function previousPage() {
  page.value -= 1
  void load()
}
function nextPage() {
  page.value += 1
  void load()
}
watch([open, () => props.current.revision], () => {
  if (open.value) void load()
})
</script>
<style scoped lang="scss">
.post-history {
  padding: 1rem;
  margin: 1rem 0;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface-2);
}
ul {
  list-style: none;
  padding: 0;
}
li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin: 0.75rem 0;
}
button {
  margin: 0.3rem;
}
</style>
