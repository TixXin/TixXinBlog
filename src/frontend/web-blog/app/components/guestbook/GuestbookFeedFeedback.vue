<!--
  @file GuestbookFeedFeedback.vue
  @description 留言列表全局错误与重试反馈提示区
  @author TixXin
  @since 2026-10-21
-->

<template>
  <div v-if="pending || error" class="guestbook-feedback">
    <CommonRequestFeedback
      :compact="hasItems"
      :pending="pending"
      :title="error || $t('interaction.guestbook.loading')"
      :description="hasItems ? $t('interaction.guestbook.staleDescription') : undefined"
      @retry="$emit('retry')"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  pending: boolean
  error?: string | null
  hasItems: boolean
}>()

defineEmits<{
  retry: []
}>()
</script>

<style scoped lang="scss">
.guestbook-feedback {
  flex-shrink: 0;
  max-height: 40%;
  overflow: auto;
}
</style>
