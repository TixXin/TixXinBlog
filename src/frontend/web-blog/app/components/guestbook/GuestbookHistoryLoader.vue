<!--
  @file GuestbookHistoryLoader.vue
  @description 留言板历史消息加载入口与错误重试反馈
  @author TixXin
  @since 2026-10-21
-->

<template>
  <CommonRequestFeedback
    v-if="error || retrying"
    compact
    :pending="pending || morePending || retrying || !personalized"
    :title="$t('interaction.guestbook.historyFailed')"
    :description="error || undefined"
    @retry="$emit('retry')"
  />
  <button
    v-else
    :aria-busy="morePending"
    type="button"
    :disabled="pending || morePending || !personalized"
    @click="$emit('loadMore')"
  >
    {{
      morePending
        ? isChatMode
          ? $t('interaction.guestbook.loadingHistory')
          : $t('interaction.guestbook.loadingMore')
        : isChatMode
          ? $t('interaction.guestbook.loadHistory')
          : $t('interaction.guestbook.loadMore')
    }}
  </button>
</template>

<script setup lang="ts">
defineProps<{
  isChatMode: boolean
  error?: string | null
  retrying: boolean
  pending: boolean
  morePending: boolean
  personalized: boolean
}>()

defineEmits<{
  retry: []
  loadMore: []
}>()
</script>

<style scoped lang="scss">
button {
  color: var(--accent-text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  min-height: 44px;
}
</style>
