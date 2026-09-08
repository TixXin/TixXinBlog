<!--
  @file PostHistory.vue
  @description 修订历史分页、差异比较与显式恢复入口，实际恢复由编辑工作区处理。
-->
<template>
  <section class="post-history" aria-label="文章修订历史">
    <button type="button" @click="open = !open">{{ open ? '收起修订历史' : '查看修订历史' }}</button>
    <template v-if="open">
      <p v-if="pending" role="status">正在读取修订历史…</p>
      <p v-if="error" role="alert">{{ error }} <button type="button" @click="load">重试历史</button></p>
      <p v-if="!pending && !error && !items.length">暂无修订记录</p>
      <ul>
        <li v-for="item in items" :key="item.revision">
          <span
            >版本 {{ item.revision }} · {{ item.reason }} ·
            {{ new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false }) }}</span
          ><button type="button" :disabled="pending || busy" @click="inspect(item.revision)">
            比较版本 {{ item.revision }}
          </button>
        </li>
      </ul>
      <button type="button" :disabled="pending || page <= 1" @click="previousPage">上一页修订</button
      ><span>{{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }}</span
      ><button type="button" :disabled="pending || page * 20 >= total" @click="nextPage">下一页修订</button>
      <AdminPostConflict
        v-if="selected"
        :local="selected.snapshot"
        :server="current"
        title="历史修订与当前编辑内容比较"
        description="可先载入编辑器合并，也可明确恢复为新的服务器草稿；修订恢复不会回滚互动计数。"
        local-label="历史修订"
        server-label="当前编辑"
        use-server-label="关闭版本比较"
        keep-local-label="载入此修订继续编辑"
        @use-server="selected = null"
        @keep-local="$emit('loadSnapshot', selected.snapshot)"
      />
      <button v-if="selected" type="button" :disabled="busy" @click="$emit('restoreRevision', selected.revision)">
        恢复版本 {{ selected.revision }} 为服务器草稿
      </button>
    </template>
  </section>
</template>
<script setup lang="ts">
import type { AdminPostDraft } from '~/features/post/adminTypes'
const props = defineProps<{ postId: number; current: AdminPostDraft; busy: boolean }>()
defineEmits<{ loadSnapshot: [draft: AdminPostDraft]; restoreRevision: [revision: number] }>()
const api = useAdminApi()
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
    error.value = '修订历史读取失败，请重试'
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
    error.value = '修订内容读取失败，请重试'
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
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-1);
  margin: 0.3rem;
}
</style>
