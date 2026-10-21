<!--
  @file PostBatchHistory.vue
  @description 文章最近批量操作任务记录列表：展示最近任务摘要与状态，提供重试与详情检查。
-->
<template>
  <section class="admin-posts__history" :aria-label="$t('admin-content.postList.recentTitle')">
    <h2>{{ $t('admin-content.postList.recentTitle') }}</h2>
    <p>{{ $t('admin-content.postList.recentHint') }}</p>
    <p v-if="error" role="alert">
      {{ error }}
      <button type="button" @click="$emit('retry')">{{ $t('admin-content.postList.retryRecent') }}</button>
    </p>
    <p v-else-if="!items.length">{{ $t('admin-content.postList.recentEmpty') }}</p>
    <ul>
      <li v-for="item in items" :key="item.ticket">
        <button type="button" :disabled="pending" @click="$emit('inspect', item.ticket)">
          {{
            $t('admin-content.postList.recentItem', {
              action: $t(postBatchLabelKey(item.action)),
              count: item.count,
              time: formatDateTime(item.createdAt, { hour12: false }),
              state: item.completed
                ? $t('admin-content.postList.recentCompleted')
                : $t('admin-content.postList.recentPending'),
            })
          }}
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { postBatchLabelKey } from '~/features/post/batchTypes'
import type { PostBatchTaskSummary } from '~/features/post/batchTypes'

defineProps<{
  items: PostBatchTaskSummary[]
  error: string
  pending: boolean
}>()

defineEmits<{
  (e: 'inspect', ticket: string): void
  (e: 'retry'): void
}>()
</script>
