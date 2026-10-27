<!--
  @file PostEditorReading.vue
  @description 文章编辑器的阅读统计：字数与估算分钟、套用到阅读时间，以及套用结果的读屏提示
-->
<template>
  <div class="post-editor__reading">
    <p :id="readingStatsId" data-post-reading-stats>
      {{
        $t('admin-content.postEditor.readingStats', {
          total: formatNumber(readingStats.wordCount),
          chinese: formatNumber(readingStats.chineseCharacters),
          words: formatNumber(readingStats.words),
          minutes: readingStats.minutes,
        })
      }}
    </p>
    <CommonTooltip :content="$t('admin-content.postEditor.readingTooltip')">
      <button
        type="button"
        data-post-apply-reading-time
        :aria-describedby="`${readingStatsId} ${readingHintId}`"
        :disabled="pending || !readingStats.wordCount"
        @click="emit('apply')"
      >
        {{ $t('admin-content.postEditor.applyReadingTime') }}
      </button>
    </CommonTooltip>
    <p :id="readingHintId" class="post-editor__hint">
      {{ $t('admin-content.postEditor.readingHint') }}
    </p>
    <p class="post-editor__hint" role="status" :aria-label="$t('admin-content.postEditor.readingStatusLabel')">
      {{ status }}
    </p>
  </div>
</template>
<script setup lang="ts">
import { formatNumber } from '~/utils/format'

defineProps<{
  readingStats: { wordCount: number; chineseCharacters: number; words: number; minutes: number }
  readingStatsId: string
  readingHintId: string
  status: string
  pending: boolean
}>()
const emit = defineEmits<{ apply: [] }>()
</script>
<style scoped lang="scss">
@use '~/assets/styles/post-editor' as post;

@include post.editor;
</style>
