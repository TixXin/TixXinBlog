<!--
  @file TabGuestNotice.vue
  @description 标签页未登录访客模式右下角只读提示浮窗
  @author TixXin
  @since 2026-04-11
-->

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition name="tabs-guest-toast">
        <div v-if="isReadOnly && !guestToastDismissed" class="tabs-guest-toast">
          <Icon name="lucide:info" size="14" class="tabs-guest-toast__icon" />
          <span class="tabs-guest-toast__text">{{ $t('misc.tab.page.guestBrowsing') }}</span>
          <button type="button" class="tabs-guest-toast__login" @click="$emit('login')">
            {{ $t('misc.tab.page.login') }}
            <Icon name="lucide:log-in" size="11" />
          </button>
          <button
            type="button"
            class="tabs-guest-toast__close"
            :aria-label="$t('misc.tab.page.close')"
            @click="guestToastDismissed = true"
          >
            <Icon name="lucide:x" size="12" />
          </button>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  isReadOnly?: boolean
}

withDefaults(defineProps<Props>(), {
  isReadOnly: false,
})

defineEmits<{
  login: []
}>()

const guestToastDismissed = ref(false)
</script>

<style lang="scss" scoped>
/* ---- 右下角游客提示浮窗 ---- */
.tabs-guest-toast {
  position: fixed;
  bottom: calc(5rem + env(safe-area-inset-bottom));
  right: 1.5rem;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  font-size: 0.75rem;
  max-width: calc(100vw - 2rem);
  @media (min-width: $breakpoint-lg) {
    bottom: 0.75rem;
  }
}

// Nexus 底栏（72px 高、距底 16px）在常见桌面宽度下铺满右侧，提示改到底栏上方，避免压住导航项
// 提示经 Teleport 挂到 body，主题标记取 html 上的 data-theme
:root[data-theme='nexus'] .tabs-guest-toast {
  @media (min-width: $breakpoint-lg) {
    bottom: calc(72px + 16px + 0.75rem);
  }
}

.tabs-guest-toast__icon {
  flex-shrink: 0;
  color: var(--accent-text);
}

.tabs-guest-toast__text {
  color: var(--text-soft);
  overflow-wrap: anywhere;
}

.tabs-guest-toast__login {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: $radius-sm;
  background: var(--accent-action);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);
  white-space: nowrap;
  transition: opacity 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    opacity: 0.85;
  }
}

.tabs-guest-toast__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  margin-left: 0.125rem;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-faint);
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    color: var(--text-soft);
    background: var(--surface-2);
  }
}

.tabs-guest-toast-enter-active,
.tabs-guest-toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.tabs-guest-toast-enter-from,
.tabs-guest-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
