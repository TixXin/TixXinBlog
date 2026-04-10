<!--
  @file EmptyState.vue
  @description 留言板空消息状态引导
  @author TixXin
  @since 2026-04-10
-->

<template>
  <div class="guestbook-empty">
    <div class="guestbook-empty__illustration">
      <div class="guestbook-empty__circle guestbook-empty__circle--outer" />
      <div class="guestbook-empty__circle guestbook-empty__circle--inner" />
      <Icon name="lucide:message-circle" size="40" class="guestbook-empty__icon" />
    </div>
    <h3 class="guestbook-empty__title">还没有留言</h3>
    <p class="guestbook-empty__desc">成为第一个留言的人吧，和大家分享你的想法</p>
    <button type="button" class="guestbook-empty__cta" @click="$emit('compose')">
      <Icon name="lucide:pen-line" size="14" />
      写下第一条留言
    </button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  compose: []
}>()
</script>

<style lang="scss" scoped>
.guestbook-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
  gap: 0.75rem;
}

.guestbook-empty__illustration {
  position: relative;
  width: 6rem;
  height: 6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.guestbook-empty__circle {
  position: absolute;
  border-radius: $radius-full;

  &--outer {
    inset: 0;
    background: color-mix(in srgb, var(--accent, #5b7cfa) 6%, transparent);
    animation: guestbook-empty-pulse 3s ease-in-out infinite;
  }

  &--inner {
    inset: 0.75rem;
    background: color-mix(in srgb, var(--accent, #5b7cfa) 10%, transparent);
  }
}

.guestbook-empty__icon {
  position: relative;
  color: var(--accent, #5b7cfa);
  opacity: 0.7;
}

.guestbook-empty__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
}

.guestbook-empty__desc {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-muted);
  max-width: 280px;
  line-height: 1.5;
}

.guestbook-empty__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: $radius-full;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, var(--accent, #5b7cfa), #6366f1);
  box-shadow: 0 2px 8px rgba(91, 124, 250, 0.3);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(91, 124, 250, 0.4);
  }

  &:active {
    transform: scale(0.97);
  }
}

@keyframes guestbook-empty-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.08);
    opacity: 0.7;
  }
}
</style>
