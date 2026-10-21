<!--
  @file FlashCommentItem.vue
  @description 闪念评论审核卡片：展示评论者、闪念关联、正文与单条审核/删除操作
  @author TixXin
  @since 2026-10-21
-->
<template>
  <AdminModerationItem
    :data-flash-comment-id="item.id"
    :selected="selected"
    selectable
    :select-disabled="disabled"
    :select-aria-label="
      t('admin-content.flashComments.select', { author: item.authorName, excerpt: item.content.slice(0, 40) })
    "
    select-class="flash-comments__select"
    actions-class="flash-comments__actions"
    @toggle-select="$emit('toggle-select', $event)"
  >
    <template #meta>
      <p>
        <strong>{{ item.authorName }}</strong> · {{ labels[item.moderationStatus] }} ·
        {{ item.createdAt.slice(0, 16).replace('T', ' ') }} UTC
      </p>
    </template>
    <template #content>
      <p>{{ item.content }}</p>
    </template>
    <template #extra>
      <blockquote>
        <NuxtLink :to="{ path: '/admin/flashes', query: { comments: item.flashId, commentId: item.id } }">{{
          item.flashContent
        }}</NuxtLink>
        · {{ flashLabels[item.flashStatus] }}
      </blockquote>
    </template>
    <template #actions>
      <button
        v-if="item.moderationStatus !== 'published'"
        type="button"
        :disabled="disabled"
        @click="$emit('change', item, 'published')"
      >
        {{ t('admin-content.flashComments.approve') }}
      </button>
      <button
        v-if="item.moderationStatus !== 'hidden'"
        type="button"
        :disabled="disabled"
        @click="$emit('change', item, 'hidden')"
      >
        {{ t('admin-content.flashComments.hide') }}
      </button>
      <button type="button" :disabled="disabled" @click="$emit('change', item, 'delete')">
        {{ t('admin-content.flashComments.remove') }}
      </button>
    </template>
  </AdminModerationItem>
</template>

<script setup lang="ts">
import type { ManagedFlashComment } from '~/features/flash/types'

defineProps<{
  item: ManagedFlashComment
  selected?: boolean
  disabled?: boolean
  labels: Record<string, string>
  flashLabels: Record<string, string>
}>()

defineEmits<{
  'toggle-select': [checked: boolean]
  change: [item: ManagedFlashComment, action: 'published' | 'hidden' | 'delete']
}>()

const { t } = useI18n()
</script>

<style scoped>
p,
blockquote {
  margin: 0.75rem 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
blockquote {
  color: var(--text-muted);
}
li {
  position: relative;
  padding: 1rem 1rem 1rem 3rem;
  margin: 1rem 0;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
li.is-selected {
  border-color: var(--accent);
}
:deep(.flash-comments__select) {
  position: absolute;
  top: 0.75rem;
  left: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}
:deep(.flash-comments__select input) {
  width: 1.1rem;
  height: 1.1rem;
}
a:not(.admin-btn) {
  color: var(--accent);
  overflow-wrap: anywhere;
}
:deep(.flash-comments__actions) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}
:deep(.flash-comments__actions button) {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
:disabled {
  opacity: 0.5;
}
</style>
