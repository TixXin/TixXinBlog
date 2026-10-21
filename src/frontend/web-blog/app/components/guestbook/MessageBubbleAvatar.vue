<!--
  @file MessageBubbleAvatar.vue
  @description 留言气泡头像与悬浮用户卡片子组件
  @author TixXin
  @since 2026-10-21
-->

<template>
  <div class="message-bubble__avatar-wrap" @mouseenter="showUserCard = true" @mouseleave="showUserCard = false">
    <img
      class="message-bubble__avatar"
      :src="message.avatar || '/avatar.svg'"
      :alt="$t('interaction.guestbook.avatarAlt', { name: message.author })"
      width="32"
      height="32"
    />
    <!-- 头像悬浮用户卡 -->
    <Transition name="user-card-fade">
      <div
        v-if="showUserCard"
        class="message-bubble__user-card"
        :class="{ 'message-bubble__user-card--right': message.isOwner }"
      >
        <img
          class="message-bubble__user-card-avatar"
          :src="message.avatar || '/avatar.svg'"
          :alt="message.author"
          width="40"
          height="40"
        />
        <div class="message-bubble__user-card-info">
          <span class="message-bubble__user-card-name">
            {{ message.author }}
            <span v-if="message.isOwner" class="message-bubble__owner-badge message-bubble__owner-badge--sm">{{
              $t('interaction.guestbook.owner')
            }}</span>
          </span>
          <span v-if="message.region" class="message-bubble__user-card-region">
            <Icon name="lucide:map-pin" size="11" />
            {{ message.region }}
          </span>
          <span v-if="message.browser" class="message-bubble__user-card-region">
            <Icon name="lucide:globe" size="11" />
            {{ message.browser }}
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { GuestMessage } from '~/features/guestbook/types'

defineProps<{
  message: GuestMessage
}>()

const showUserCard = ref(false)
</script>

<style lang="scss" scoped>
/* ---- 头像与悬浮卡 ---- */
.message-bubble__avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.message-bubble__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: $radius-full;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow:
    0 0 0 2px var(--surface-1),
    0 1px 2px rgba(0, 0, 0, 0.05);
  cursor: var(--interaction-cursor, pointer);
  transition: transform 0.15s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    transform: scale(1.08);
  }
}

/* 头像悬浮用户卡 */
.message-bubble__user-card {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem;
  min-width: 180px;
  border-radius: $radius-md;
  background: var(--surface-1);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card-hover, 0 8px 24px rgba(0, 0, 0, 0.12));
  pointer-events: none;

  &--right {
    left: auto;
    right: 0;
  }
}

.message-bubble__user-card-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: $radius-full;
  object-fit: cover;
  flex-shrink: 0;
}

.message-bubble__user-card-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.message-bubble__user-card-name {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.message-bubble__user-card-region {
  font-size: 0.625rem;
  color: var(--text-faint);
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
}

.message-bubble__owner-badge {
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  box-shadow: 0 1px 3px rgba(99, 102, 241, 0.3);

  &--sm {
    font-size: 0.5rem;
    padding: 0.0625rem 0.25rem;
  }
}

:root.dark .message-bubble__owner-badge {
  background: linear-gradient(135deg, #5b7cfa, #7b95ff);
}

.user-card-fade-enter-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.user-card-fade-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.user-card-fade-enter-from,
.user-card-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
