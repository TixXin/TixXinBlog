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
      <h2 id="post-batch-title">{{ $t('admin-content.postBatch.title') }}</h2>
      <button type="button" :disabled="pending" @click="close">{{ $t('admin-content.postBatch.close') }}</button>
    </header>
    <p v-if="pending" role="status">{{ $t('admin-content.postBatch.pending') }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="batchCount > 1" role="status">
      {{
        $t('admin-content.postBatch.queue', {
          total: totalCount,
          count: batchCount,
          index: batchIndex,
          limit: POST_BATCH_LIMIT,
        })
      }}
    </p>
    <p v-if="batchCount > 1 && (!result?.completed || batchIndex < batchCount)">
      {{ $t('admin-content.postBatch.closeHint') }}
    </p>
    <button v-if="!preview && canNext" type="button" :disabled="pending" @click="$emit('next')">
      {{ $t('admin-content.postBatch.retryPreview') }}
    </button>
    <template v-if="preview">
      <p>
        {{
          $t('admin-content.postBatch.summary', {
            action: $t(postBatchLabelKey(preview.action)),
            selected: preview.items.length,
            allowed: preview.allowedCount,
          })
        }}
      </p>
      <p v-if="preview.action === 'delete'">
        {{ $t('admin-content.postBatch.effect.delete') }}
      </p>
      <p v-else-if="preview.action === 'trash'">{{ $t('admin-content.postBatch.effect.trash') }}</p>
      <p v-else-if="preview.action === 'archive'">{{ $t('admin-content.postBatch.effect.archive') }}</p>
      <p v-else>{{ $t('admin-content.postBatch.effect.draft') }}</p>
      <p>
        {{ $t('admin-content.postBatch.ticketHint') }}
      </p>
      <p v-if="preview.expiresIn <= 0 && !result?.completed" role="status">
        {{ $t('admin-content.postBatch.expired') }}
      </p>
      <ul :aria-label="$t('admin-content.postBatch.impactLabel')">
        <li v-for="item in preview.items" :key="item.id">
          <strong>{{ item.title }}</strong
          ><span>{{ $t('admin-content.postBatch.itemMeta', { id: item.id, revision: item.revision }) }}</span>
          <p>{{ item.allowed ? $t('admin-content.postBatch.allowed') : item.reason }}</p>
          <p v-if="preview.action === 'delete'">
            {{ impactSummary(item.impact) }}
          </p>
          <p v-if="outcome(item.id)" :role="outcome(item.id)?.success ? 'status' : undefined">
            {{
              $t('admin-content.postBatch.outcome', {
                state: outcome(item.id)?.success
                  ? $t('admin-content.postBatch.succeeded')
                  : $t('admin-content.postBatch.skipped'),
                message: outcome(item.id)?.message,
              })
            }}
          </p>
        </li>
      </ul>
      <p v-if="result" role="status">
        {{
          $t('admin-content.postBatch.result', {
            success: result.successCount,
            failed: result.failedCount,
            pending: result.pendingCount,
          })
        }}{{ result.completed ? $t('admin-content.postBatch.resultDone') : '' }}
      </p>
      <label v-if="preview.action === 'delete' && !result?.completed"
        >{{ $t('admin-content.postBatch.acknowledge', { phrase: POST_DELETE_ACKNOWLEDGEMENT })
        }}<input v-model="acknowledgement" :disabled="pending" autocomplete="off"
      /></label>
      <footer>
        <button
          v-if="!result?.completed"
          :aria-busy="pending"
          type="button"
          :disabled="
            pending ||
            !preview.allowedCount ||
            preview.expiresIn <= 0 ||
            (preview.action === 'delete' && acknowledgement !== POST_DELETE_ACKNOWLEDGEMENT)
          "
          @click="$emit('execute')"
        >
          {{ attempted ? $t('admin-content.postBatch.continue') : $t('admin-content.postBatch.execute') }}
        </button>
        <button v-if="attempted" type="button" :disabled="pending" @click="$emit('query')">
          {{ $t('admin-content.postBatch.query') }}
        </button>
        <button v-if="canNext" type="button" :disabled="pending" @click="$emit('next')">
          {{ $t('admin-content.postBatch.next') }}
        </button>
        <button type="button" :disabled="pending" @click="close">
          {{
            result?.completed
              ? $t('admin-content.postBatch.done')
              : attempted
                ? $t('admin-content.postBatch.closeLater')
                : $t('admin-content.postBatch.cancel')
          }}
        </button>
      </footer>
    </template>
  </dialog>
</template>
<script setup lang="ts">
import { POST_BATCH_LIMIT, POST_DELETE_ACKNOWLEDGEMENT, postBatchLabelKey } from '~/features/post/batchTypes'
import type { PostBatchPreview, PostBatchResult } from '~/features/post/batchTypes'
import { getModalFocusOrigin } from '~/utils/modalFocusOrigin'
const props = withDefaults(
  defineProps<{
    preview: PostBatchPreview | null
    result: PostBatchResult | null
    pending: boolean
    error: string
    attempted: boolean
    batchIndex?: number
    batchCount?: number
    totalCount?: number
    canNext?: boolean
  }>(),
  { batchIndex: 1, batchCount: 1, totalCount: 0, canNext: false },
)
defineEmits<{ execute: []; query: []; next: [] }>()
const open = defineModel<boolean>('open', { required: true })
const acknowledgement = defineModel<string>('acknowledgement', { required: true })
const dialog = ref<HTMLDialogElement | null>(null)
let focusOrigin: HTMLElement | null = null
const { t } = useI18n()
const impactKinds = ['comments', 'revisions', 'addresses', 'mediaReferences', 'likes', 'commentLikes', 'views'] as const
/** 永久删除影响的各类记录数，逐项按数量选择单复数 */
function impactSummary(impact: PostBatchPreview['items'][number]['impact']) {
  return impactKinds
    .map((kind) => {
      const count = impact[kind] ?? 0
      return t(`admin-content.postBatch.impact.${kind}`, { count }, count)
    })
    .join(' · ')
}
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
