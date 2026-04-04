<!--
  @file ToastContainer.vue
  @description 全局 Toast 容器
  @author TixXin
  @since 2026-04-04
-->

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast-list">
        <div v-for="toast in toasts" :key="toast.id" class="toast-item" :class="`toast-item--${toast.type}`">
          <Icon :name="getIcon(toast.type)" size="16" class="toast-item__icon" />
          <span class="toast-item__message">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const { toasts } = useToast()

function getIcon(type: string) {
  switch (type) {
    case 'success':
      return 'lucide:check-circle'
    case 'warning':
      return 'lucide:alert-triangle'
    case 'error':
      return 'lucide:x-circle'
    case 'info':
    default:
      return 'lucide:info'
  }
}
</script>

<style lang="scss" scoped>
.toast-container {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--surface-1);
  color: var(--text-main);
  border-radius: $radius-md;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border);
  font-size: 0.875rem;
  pointer-events: auto;
  backdrop-filter: blur(8px);

  &--success .toast-item__icon {
    color: #10b981;
  }
  &--warning .toast-item__icon {
    color: #f59e0b;
  }
  &--error .toast-item__icon {
    color: var(--danger);
  }
  &--info .toast-item__icon {
    color: var(--accent);
  }
}

.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-list-enter-from {
  opacity: 0;
  transform: translateY(-1rem) scale(0.9);
}

.toast-list-leave-to {
  opacity: 0;
  transform: translateY(-1rem) scale(0.9);
}
</style>
