<!--
  @file PostListTable.vue
  @description 文章管理列表的表格：勾选、置顶标记、状态徽章、分类与标签、更新时间和编辑/归档/恢复入口；
               窄屏下每行改为带字段标签的卡片，只发出事件，提交由页面负责
-->
<template>
  <div
    class="admin-card admin-card--table admin-posts__table"
    role="region"
    :aria-label="$t('admin-content.postList.tableRegion')"
    tabindex="0"
  >
    <table class="admin-table">
      <thead>
        <tr>
          <th>{{ $t('admin-content.postList.colTitle') }}</th>
          <th>{{ $t('admin-content.postList.colStatus') }}</th>
          <th>{{ $t('admin-content.postList.colTaxonomy') }}</th>
          <th>{{ $t('admin-content.postList.colUpdatedAt') }}</th>
          <th>{{ $t('admin-content.postList.colActions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="post in items" :key="post.id">
          <td :data-label="$t('admin-content.postList.colTitle')">
            <input
              type="checkbox"
              :checked="isSelected(post.id)"
              :aria-label="$t('admin-content.postList.selectPost', { title: post.title })"
              :disabled="selectionDisabled"
              @change="emit('toggle', post.id, $event)"
            />
            <Icon v-if="post.pinned" name="lucide:pin" :aria-label="$t('admin-content.postList.pinned')" />{{
              post.title
            }}
          </td>
          <td :data-label="$t('admin-content.postList.colStatus')">
            <span class="admin-badge" :class="adminPostStatusTone(post)">{{
              $t(`admin-content.postStatus.${post.deleted ? 'trash' : post.status}`)
            }}</span>
          </td>
          <td :data-label="$t('admin-content.postList.colTaxonomy')">
            {{ $t(`admin-content.postCategory.${post.category === 'tech' ? 'tech' : 'life'}`) }} / {{ post.folder
            }}<small>{{ post.tags.join(' · ') || $t('admin-content.postList.noTags') }}</small>
          </td>
          <td :data-label="$t('admin-content.postList.colUpdatedAt')">
            {{ formatDateTime(post.updatedAt, { hour12: false }) }}
          </td>
          <td :data-label="$t('admin-content.postList.colActions')">
            <NuxtLink v-if="!post.deleted" class="admin-btn admin-btn--sm" :to="`/admin/posts/${post.id}`">{{
              $t('admin-content.postList.edit')
            }}</NuxtLink>
            <button
              v-if="post.status !== 'archived' && !post.deleted"
              type="button"
              class="admin-btn admin-btn--sm admin-btn--ghost"
              :disabled="navigationDisabled"
              @click="emit('archive', post)"
            >
              {{ $t('admin-content.postList.archive') }}
            </button>
            <button
              v-else
              type="button"
              class="admin-btn admin-btn--sm admin-btn--ghost"
              :disabled="navigationDisabled"
              @click="emit('restore', post)"
            >
              {{ $t('admin-content.postList.restore') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script setup lang="ts">
import { adminPostStatusTone } from '~/features/post/adminListQuery'
import type { AdminPostListRow } from '~/features/post/types'

defineProps<{
  items: AdminPostListRow[]
  isSelected: (id: number) => boolean
  selectionDisabled: boolean
  navigationDisabled: boolean
}>()
const emit = defineEmits<{
  toggle: [id: number, event: Event]
  archive: [post: AdminPostListRow]
  restore: [post: AdminPostListRow]
}>()
</script>
<style scoped lang="scss">
.admin-posts__table {
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  small {
    display: block;
    margin-top: 0.25rem;
    color: var(--text-soft);
    font-size: 0.75rem;
  }
  td:first-child {
    font-weight: 500;

    input[type='checkbox'] {
      margin-right: 0.5rem;
    }
    :deep(.iconify) {
      margin-right: 0.25rem;
      color: var(--warning-text);
      vertical-align: text-bottom;
    }
  }
  td:last-child {
    white-space: nowrap;
  }
  td:last-child > * + * {
    margin-left: 0.375rem;
  }
}
@media (max-width: 700px) {
  .admin-posts__table {
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none;
  }
  .admin-posts__table table,
  .admin-posts__table tbody,
  .admin-posts__table tr,
  .admin-posts__table td {
    display: block;
  }
  .admin-posts__table thead {
    display: none;
  }
  .admin-posts__table tr {
    margin: 0 0 0.75rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--admin-card-border);
    border-radius: var(--admin-radius-card);
    background: var(--admin-card-bg);
  }
  .admin-posts__table td {
    padding: 0.375rem 0;
    border: 0;
  }
  .admin-posts__table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 0.125rem;
    color: var(--text-soft);
    font-size: 0.75rem;
  }
  .admin-posts__table td:first-child {
    font-weight: 600;
  }
}
</style>
