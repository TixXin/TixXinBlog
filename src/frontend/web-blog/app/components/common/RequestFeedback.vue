<!--
  @file RequestFeedback.vue
  @description 内容请求的加载与失败反馈；只接收展示状态和重试事件
-->
<template>
  <div class="request-feedback" :class="{ 'request-feedback--compact': compact }" :aria-busy="pending">
    <div class="request-feedback__message" :role="pending ? 'status' : 'alert'">
      <Icon :name="pending ? 'lucide:loader-circle' : 'lucide:cloud-off'" size="24" aria-hidden="true" />
      <div>
        <p class="request-feedback__title">{{ pending ? '正在加载…' : title }}</p>
        <p v-if="description && !pending" class="request-feedback__description">{{ description }}</p>
      </div>
    </div>
    <button type="button" :aria-disabled="pending" @click="!pending && $emit('retry')">
      <Icon name="lucide:refresh-cw" size="14" aria-hidden="true" />
      {{ pending ? '加载中…' : '重试' }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; description?: string; pending?: boolean; compact?: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<style scoped lang="scss">
.request-feedback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 15rem;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-soft);
  overflow-wrap: anywhere;

  &__message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }
  &__title {
    margin: 0;
    font-weight: 600;
    color: var(--text-main);
  }
  &__description {
    margin: 0.5rem 0 0;
    font-size: 0.875rem;
    line-height: 1.6;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: $radius-md;
    background: var(--surface-3);
    color: var(--accent-text);
    cursor: pointer;

    &[aria-disabled='true'] {
      cursor: wait;
      color: var(--text-soft);
    }
  }
  &--compact {
    min-height: 0;
    padding: 1rem;
    font-size: 0.875rem;
  }
}
</style>
