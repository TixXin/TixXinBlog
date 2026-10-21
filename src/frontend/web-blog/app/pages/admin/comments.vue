<!--
  @file comments.vue
  @description 评论管理页面：检索、博主回复、明确确认后的删除，以及当前页多选的批量审核与删除
  @author TixXin
  @since 2026-10-21
-->
<template>
  <section class="admin-comments">
    <header class="admin-page-header">
      <h1>{{ t('admin-content.comments.title') }}</h1>
    </header>
    <ClientOnly>
      <AdminCommentPolicy
        v-model:require-approval="requireApproval"
        :policy="policy"
        :pending="policyPending"
        :error="policyError"
        @save="savePolicy"
        @reload="loadPolicy"
      />
      <AdminCommentFilters
        v-model:post-id="c.postId.value"
        v-model:unanswered="c.unanswered.value"
        v-model:status="c.status.value"
        v-model:from="c.from.value"
        v-model:to="c.to.value"
        v-model:search="c.search.value"
        :articles="c.articles.value"
        :status-labels="c.statusLabels.value"
        :working="c.working.value"
        :pending="c.pending.value"
        @submit="c.resetPage"
      />
      <p v-if="c.error.value" role="alert">
        {{ c.error.value }}
        <button type="button" :disabled="c.pending.value || c.working.value" @click="c.load">
          {{ t('admin-content.comments.reload') }}
        </button>
      </p>
      <p v-if="c.articleError.value" role="alert">
        {{ t('admin-content.comments.articlesFailed') }}
        <button type="button" @click="c.loadArticles">{{ t('admin-content.comments.retryArticles') }}</button>
      </p>
      <p v-if="c.pending.value" role="status">{{ t('admin-content.comments.processing') }}</p>
      <AdminCommentReplyForm
        v-if="c.replyTarget.value"
        ref="replyForm"
        v-model="c.replyText.value"
        :target="c.replyTarget.value"
        :working="c.working.value"
        :submitting="c.replySubmitting.value"
        @submit="c.sendReply"
        @cancel="c.cancelReply"
      />
      <AdminCommentContext
        v-if="c.context.value || c.contextPending.value || c.contextError.value"
        ref="contextPanel"
        :context="c.context.value"
        :pending="c.contextPending.value"
        :error="c.contextError.value"
        :status-labels="c.statusLabels.value"
        @close="c.closeContext"
        @select="handleShowContext"
        @navigate="handleShowContext"
      />
      <AdminBatchBar
        v-if="c.items.value.length"
        :noun="(count: number) => t('admin-content.comments.batch.noun', count)"
        :count="c.selection.count.value"
        :page-count="c.items.value.length"
        :all-selected="c.selection.allSelected.value"
        :partially-selected="c.selection.partiallySelected.value"
        :actions="c.batchActions.value"
        :disabled="c.pending.value || c.working.value"
        :busy="c.batchBusy.value"
        @toggle-all="c.selection.toggleAll"
        @action="c.runBatch"
        @clear="c.selection.clear"
      />
      <ul class="admin-comments__list">
        <AdminCommentItem
          v-for="comment in c.items.value"
          :key="comment.id"
          :comment="comment"
          :selected="c.selection.isSelected(comment.id)"
          :status-labels="c.statusLabels.value"
          :pending="c.pending.value"
          :working="c.working.value"
          @toggle-select="c.selection.toggle(comment.id, $event)"
          @view-context="handleShowContext"
          @reply="handleStartReply"
          @remove="c.remove"
          @moderate="c.moderate"
        />
      </ul>
      <p v-if="!c.pending.value && !c.error.value && !c.items.value.length">{{ t('admin-content.comments.empty') }}</p>
      <AdminModerationPagination
        class="admin-comments__pagination"
        :aria-label="t('admin-content.comments.pagination')"
        :page="c.page.value"
        :total="c.total.value"
        :page-size="20"
        :disabled="c.pending.value"
        :prev-label="t('admin-content.comments.previous')"
        :next-label="t('admin-content.comments.next')"
        :summary="
          t('admin-content.comments.pageSummary', {
            page: c.page.value,
            pages: Math.max(1, Math.ceil(c.total.value / 20)),
            total: c.total.value,
          })
        "
        @prev="c.previousPage"
        @next="c.nextPage"
      />
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import { useAdminComments } from '~/features/article/useAdminComments'
import type { AdminCommentRow } from '~/features/article/useAdminComments'
import { useCommentPolicy } from '~/features/article/useCommentPolicy'

definePageMeta({ layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-content.comments.title'), robots: 'noindex, nofollow' })

const {
  policy,
  requireApproval,
  pending: policyPending,
  error: policyError,
  dirty: policyDirty,
  load: loadPolicy,
  save: savePolicy,
} = useCommentPolicy()

const c = useAdminComments()
const { restore } = useCurrentUser()
const route = useRoute()
const replyForm = ref<{ focus(): void } | null>(null)
const contextPanel = ref<{ focus(): void } | null>(null)
const ready = ref(false)

function handleStartReply(comment: AdminCommentRow) {
  if (c.startReply(comment)) {
    void nextTick(() => replyForm.value?.focus())
  }
}

async function handleShowContext(id: number, p = 1) {
  const res = await c.showContext(id, p)
  if (res) {
    await nextTick()
    contextPanel.value?.focus()
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (c.replyDirty.value || policyDirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}

onBeforeRouteLeave(
  () =>
    !c.working.value &&
    !policyPending.value &&
    c.allowDiscard() &&
    (!policyDirty.value || window.confirm(t('admin-content.comments.policy.leaveConfirm'))),
)

watch(
  () => route.query,
  () => {
    c.syncQuery()
    if (ready.value) void c.load()
  },
  { immediate: true },
)

onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  if (await restore()) {
    ready.value = true
    await Promise.all([c.loadArticles(), c.load(), loadPolicy()])
    if (typeof route.query.commentId === 'string' && /^[1-9]\d*$/.test(route.query.commentId))
      await handleShowContext(Number(route.query.commentId))
  } else await navigateTo({ path: '/admin/login', query: { next: route.fullPath } })
})

onBeforeUnmount(() => {
  c.cleanup()
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>
<style scoped>
.admin-comments {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  min-width: 0;
  overflow-wrap: anywhere;
}
.admin-comments ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.admin-comments__list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}
.admin-comments :deep(.admin-comments__pagination) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}
</style>
