<!--
  @file MessageInputFooter.vue
  @description 留言输入框底部栏：身份提示、字数统计与发送按钮
  @author TixXin
  @since 2026-10-21
-->

<template>
  <div class="message-input__footer">
    <span class="message-input__hint"
      >{{ identityLabel }} <span aria-hidden="true">·</span> {{ $t('interaction.guestbookInput.sendHint') }}</span
    >
    <small class="message-input__count" :class="{ 'message-input__count--full': draftLength >= 500 }"
      >{{ draftLength }} / 500</small
    >
    <button
      type="button"
      class="message-input__send"
      :aria-busy="submitting"
      :disabled="disabled"
      @click="$emit('submit')"
    >
      <Icon name="lucide:send" size="14" />
      <span>{{ submitting ? $t('interaction.guestbookInput.sending') : $t('interaction.guestbookInput.send') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  identityLabel: string
  draftLength: number
  submitting: boolean
  disabled: boolean
}>()

defineEmits<{
  submit: []
}>()
</script>

<style lang="scss" scoped>
/* ---- 底部工具栏 ---- */
.message-input__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.125rem 0.5rem 0.5rem 0.75rem;
}

.message-input__hint {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 0.6875rem;
  color: var(--text-faint);
  white-space: nowrap;
  text-overflow: ellipsis;

  // 触屏通常没有快捷键，窄屏只保留字数与发送
  @media (max-width: #{$breakpoint-sm - 1px}) {
    visibility: hidden;
  }
}

.message-input__count {
  flex-shrink: 0;
  font-size: 0.6875rem;
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;

  &--full {
    color: var(--danger);
  }
}

.message-input__send {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: $radius-sm;
  color: #fff;
  background: var(--accent, #5b7cfa);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);
  transition:
    opacity 0.2s,
    transform 0.15s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &:disabled {
    opacity: 0.4;
    cursor: var(--interaction-cursor, not-allowed);
  }
}
</style>
