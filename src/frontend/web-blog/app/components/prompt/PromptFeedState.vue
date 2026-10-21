<!-- @file PromptFeedState.vue @description 提示词列表请求状态反馈：加载指示器、元数据重试与草稿陈旧提示 -->
<template>
  <p v-if="draftView" class="prompts-result" role="status">
    <Icon name="lucide:lock-keyhole" size="13" />{{ $t('misc.prompt.page.draftHint') }}
  </p>
  <CommonRequestFeedback
    v-if="currentPending || pageOutOfRange || currentError"
    :pending="currentPending || pageOutOfRange"
    :compact="hasItems"
    :title="currentError || $t('misc.prompt.page.loading')"
    @retry="$emit('retry')"
  />
  <CommonRequestFeedback
    v-if="metadataError || metadataRetrying"
    compact
    :pending="metadataPending"
    :title="$t('misc.prompt.page.metadataFailed')"
    :description="$t('misc.prompt.page.metadataFailedHint')"
    @retry="$emit('retryMetadata')"
  />
  <p v-if="draftView ? draftStale : stale" class="prompts-result" role="status">
    {{
      $t(draftView ? 'misc.prompt.page.staleDrafts' : 'misc.prompt.page.stalePrompts', {
        status: $t(currentError ? 'misc.prompt.page.staleFailed' : 'misc.prompt.page.staleUpdating'),
      })
    }}
  </p>
</template>
<script setup lang="ts">
defineProps<{
  draftView: boolean
  currentPending: boolean
  pageOutOfRange: boolean
  currentError: string
  hasItems: boolean
  metadataError?: Error | null
  metadataRetrying: boolean
  metadataPending: boolean
  draftStale: boolean
  stale: boolean
}>()

defineEmits<{
  retry: []
  retryMetadata: []
}>()
</script>
<style scoped lang="scss">
.prompts-result {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-soft);
  margin-bottom: 1rem;
}
.prompts-result button {
  color: var(--accent-text);
}
</style>
