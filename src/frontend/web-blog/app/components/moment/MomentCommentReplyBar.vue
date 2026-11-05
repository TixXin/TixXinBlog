<!--
  @file MomentCommentReplyBar.vue
  @description 朋友圈评论输入框上方的回复对象提示，可取消回复改为直接评论
  @author TixXin
  @since 2026-11-06
-->

<template>
  <div class="moment-reply-bar" role="status">
    <span>{{ $t('flash-moment.momentComments.replyingTo', { author }) }}</span>
    <button
      type="button"
      class="moment-reply-bar__cancel"
      :aria-label="$t('flash-moment.momentComments.cancelReply')"
      @click="$emit('cancel')"
    >
      <Icon name="lucide:x" size="12" />
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ author: string }>()
defineEmits<{ cancel: [] }>()
</script>

<style lang="scss" scoped>
.moment-reply-bar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.375rem;
  color: var(--text-soft);
  font-size: 0.75rem;
}

.moment-reply-bar__cancel {
  display: inline-flex;
  padding: 0.125rem;
  border: 0;
  border-radius: $radius-sm;
  background: transparent;
  color: inherit;
  cursor: var(--interaction-cursor, pointer);

  &:focus-visible {
    outline: 2px solid var(--accent);
  }
}
</style>
