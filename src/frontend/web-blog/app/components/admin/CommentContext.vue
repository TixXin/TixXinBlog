<!--
  @file CommentContext.vue
  @description 文章评论上下文面板：祖先评论链、当前评论详情、直接回复树及分页浏览
  @author TixXin
  @since 2026-10-21
-->
<template>
  <section
    ref="contextPanel"
    tabindex="-1"
    class="admin-comments__context"
    :aria-label="t('admin-content.comments.context.title')"
  >
    <h2>{{ t('admin-content.comments.context.title') }}</h2>
    <button type="button" @click="$emit('close')">{{ t('admin-content.comments.context.close') }}</button>
    <p v-if="pending" role="status">{{ t('admin-content.comments.context.pending') }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-if="context">
      <p>
        {{
          t('admin-content.comments.context.deleteImpact', {
            title: context.post.title,
            count: context.deleteTotal,
          })
        }}
      </p>
      <p>
        {{
          t('admin-content.comments.context.visibility', {
            visible: context.visibleTotal,
            approved: context.approvedVisibleTotal,
          })
        }}
      </p>
      <ol>
        <li v-for="ancestor in context.ancestors" :key="ancestor.id">
          <strong>{{ ancestor.author }} · {{ statusLabels[ancestor.status] }}</strong>
          <p>{{ ancestor.content }}</p>
          <button type="button" @click="$emit('select', ancestor.id)">
            {{ t('admin-content.comments.context.viewAncestor') }}
          </button>
        </li>
      </ol>
      <blockquote>
        <strong>{{
          t('admin-content.comments.context.current', {
            author: context.target.author,
            status: statusLabels[context.target.status],
          })
        }}</strong>
        <p>{{ context.target.content }}</p>
      </blockquote>
      <h3>{{ t('admin-content.comments.context.directReplies', { count: context.total }) }}</h3>
      <p v-if="!context.total">{{ t('admin-content.comments.context.noReplies') }}</p>
      <ul>
        <li v-for="reply in context.replies" :key="reply.id">
          <strong>
            {{ reply.author }}{{ reply.isOwner ? ` · ${t('admin-content.comments.owner')}` : '' }} ·
            {{ statusLabels[reply.status] }}
          </strong>
          <p>{{ reply.content }}</p>
          <button type="button" @click="$emit('select', reply.id)">
            {{ t('admin-content.comments.context.viewReply') }}
          </button>
        </li>
      </ul>
      <AdminModerationPagination
        class="admin-comments__pagination"
        :aria-label="t('admin-content.comments.context.pagination')"
        :page="context.page"
        :total="context.total"
        :page-size="20"
        :disabled="pending"
        :prev-label="t('admin-content.comments.context.previous')"
        :next-label="t('admin-content.comments.context.next')"
        :summary="`${context.page} / ${Math.max(1, Math.ceil(context.total / 20))}`"
        @prev="$emit('navigate', context.target.id, context.page - 1)"
        @next="$emit('navigate', context.target.id, context.page + 1)"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import type { AdminCommentContextData, CommentStatus } from '~/features/article/types'

withDefaults(
  defineProps<{
    context: AdminCommentContextData | null
    pending?: boolean
    error?: string
    statusLabels: Record<CommentStatus, string>
  }>(),
  {
    pending: false,
    error: '',
  },
)

defineEmits<{
  close: []
  select: [id: number]
  navigate: [id: number, page: number]
}>()

const { t } = useI18n()
const contextPanel = ref<HTMLElement | null>(null)

function focus() {
  contextPanel.value?.focus()
}

defineExpose({
  focus,
})
</script>

<style scoped>
.admin-comments__context {
  min-width: 0;
  padding: 1rem 1.125rem;
  border: 1px solid var(--admin-card-border);
  border-radius: var(--admin-radius-card);
  background: var(--admin-card-bg);
  box-shadow: var(--admin-card-shadow);
  overflow-wrap: anywhere;
}
.admin-comments__context li {
  box-shadow: none;
}
.admin-comments__context ol {
  padding-left: 1.25rem;
}
:deep(.admin-comments__pagination) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}
@media (max-width: 640px) {
  .admin-comments__context ol {
    padding-left: 1rem;
  }
}
</style>
