<!--
  @file PostBatch.vue
  @description 展示批量影响、不可执行原因和逐项结果；业务操作由页面传入。
-->
<template>
  <dialog
    ref="dialog"
    class="post-batch"
    aria-labelledby="post-batch-title"
    @cancel.prevent="close"
    @close="open = false"
  >
    <header>
      <h2 id="post-batch-title">批量操作确认</h2>
      <button type="button" :disabled="pending" @click="close">关闭</button>
    </header>
    <p v-if="pending" role="status">正在处理，请等待服务器结果…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-if="preview">
      <p>
        操作：{{ postBatchLabels[preview.action] }}。本次明确选择 {{ preview.items.length }} 篇，可执行
        {{ preview.allowedCount }} 篇。
      </p>
      <p v-if="preview.action === 'delete'">
        永久删除文章及其评论、修订、历史地址和互动记录，无法从回收站恢复。媒体文件保留；下表列出删除的引用记录数量。
      </p>
      <p v-else-if="preview.action === 'trash'">文章退出公开展示，正文、评论、修订和地址均保留，恢复后为草稿。</p>
      <p v-else-if="preview.action === 'archive'">文章退出公开展示并归档，内容与评论保留。</p>
      <p v-else>文章变为不公开的草稿，已有评论、修订和地址保留。</p>
      <p>
        预览创建后 5
        分钟内有效；执行时再次检查版本和影响范围，变化条目会跳过。已执行记录可在文章管理下方“最近批量操作”中重新打开。
      </p>
      <ul aria-label="批量影响范围">
        <li v-for="item in preview.items" :key="item.id">
          <strong>{{ item.title }}</strong
          ><span>文章 #{{ item.id }} · 版本 {{ item.revision }}</span>
          <p>{{ item.allowed ? '可执行' : item.reason }}</p>
          <p v-if="preview.action === 'delete'">
            {{ item.impact.comments }} 条评论 · {{ item.impact.revisions }} 个修订 · {{ item.impact.addresses }} 个地址
            · {{ item.impact.mediaReferences }} 条媒体引用 · {{ item.impact.likes }} 条文章点赞 ·
            {{ item.impact.commentLikes ?? 0 }} 条评论点赞 · {{ item.impact.views }} 条访问去重记录
          </p>
          <p v-if="outcome(item.id)" :role="outcome(item.id)?.success ? 'status' : undefined">
            {{ outcome(item.id)?.success ? '成功' : '未执行' }}：{{ outcome(item.id)?.message }}
          </p>
        </li>
      </ul>
      <p v-if="result" role="status">
        成功 {{ result.successCount }} 篇，失败 {{ result.failedCount }} 篇，待处理 {{ result.pendingCount }} 篇。{{
          result.completed ? '本批处理已结束。' : ''
        }}
      </p>
      <label v-if="preview.action === 'delete' && !result?.completed"
        >输入“永久删除”确认<input v-model="acknowledgement" :disabled="pending" autocomplete="off"
      /></label>
      <footer>
        <button
          v-if="!result?.completed"
          type="button"
          :disabled="
            pending ||
            !preview.allowedCount ||
            preview.expiresIn <= 0 ||
            (preview.action === 'delete' && acknowledgement !== '永久删除')
          "
          @click="$emit('execute')"
        >
          {{ attempted ? '继续执行未处理条目' : '确认执行' }}
        </button>
        <button v-if="attempted" type="button" :disabled="pending" @click="$emit('query')">查询执行结果</button>
        <button type="button" :disabled="pending" @click="close">
          {{ result?.completed ? '完成并关闭' : attempted ? '关闭，稍后查询' : '取消并关闭' }}
        </button>
      </footer>
    </template>
  </dialog>
</template>
<script setup lang="ts">
import { postBatchLabels } from '~/features/post/batchTypes'
import type { PostBatchPreview, PostBatchResult } from '~/features/post/batchTypes'
import { getModalFocusOrigin } from '~/utils/modalFocusOrigin'
const props = defineProps<{
  preview: PostBatchPreview | null
  result: PostBatchResult | null
  pending: boolean
  error: string
  attempted: boolean
}>()
defineEmits<{ execute: []; query: [] }>()
const open = defineModel<boolean>('open', { required: true })
const acknowledgement = defineModel<string>('acknowledgement', { required: true })
const dialog = ref<HTMLDialogElement | null>(null)
let focusOrigin: HTMLElement | null = null
function outcome(id: number) {
  return props.result?.results.find((item) => item.id === id)
}
function close() {
  if (!props.pending) open.value = false
}
watch(open, async (value) => {
  if (value && import.meta.client) focusOrigin = getModalFocusOrigin(document)
  await nextTick()
  if (value !== open.value) return
  if (value && !dialog.value?.open) dialog.value?.showModal()
  else if (!value) {
    dialog.value?.close()
    // 原生 dialog 完成焦点恢复后，再归还真实指针或键盘入口。
    if (
      focusOrigin?.isConnected &&
      !focusOrigin.matches(':disabled') &&
      !focusOrigin.closest('[inert]') &&
      focusOrigin.getClientRects().length
    )
      focusOrigin.focus({ preventScroll: true })
  }
})
</script>
<style scoped lang="scss">
.post-batch {
  width: min(48rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  margin: auto;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--surface-1);
  color: var(--text-main);
  overflow-y: auto;
  overflow-wrap: anywhere;
}
.post-batch::backdrop {
  background: rgb(0 0 0 / 65%);
}
header,
footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
}
h2 {
  font-size: 1.3rem;
}
p {
  margin: 0.75rem 0;
}
ul {
  padding: 0;
  list-style: none;
}
li {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
}
li span {
  display: block;
  color: var(--text-muted);
}
label {
  display: grid;
  gap: 0.5rem;
  margin-block: 1rem;
}
button,
input {
  padding: 0.65rem;
  background: var(--surface-2);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}
button:disabled {
  opacity: 0.5;
}
footer {
  margin-top: 1rem;
}
</style>
