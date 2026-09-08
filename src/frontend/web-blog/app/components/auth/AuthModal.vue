<!--
  @file AuthModal.vue
  @description 居中弹窗包装器（Aurora/通用主题），Teleport 到 body + 遮罩层
  @author TixXin
  @since 2026-04-10
-->

<template>
  <Teleport to="body">
    <Transition name="auth-modal">
      <div v-if="visible" class="auth-modal-overlay" @click.self="close">
        <div ref="dialogRef" class="auth-modal" role="dialog" aria-modal="true" aria-label="博主登录" tabindex="-1">
          <AuthPanel />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { isOpen, preferModal, close } = useLoginDrawer()

/** 仅在 preferModal 模式下显示居中弹窗；底部栏内嵌面板由 StatusFooter 自行处理 */
const visible = computed(() => isOpen.value && preferModal.value)
const dialogRef = ref<HTMLElement | null>(null)
useModalFocus(visible, dialogRef, { close, initialFocus: () => dialogRef.value?.querySelector('input') ?? null })
</script>

<style lang="scss" scoped>
.auth-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 84;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
}

.auth-modal {
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
  position: relative;
  z-index: 85;
  width: 90%;
  max-width: 420px;
  padding: 2rem 1.75rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
}

/* 弹窗进出动画 */
.auth-modal-enter-active {
  transition: opacity 0.2s ease-out;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .auth-modal {
    transition:
      opacity 0.2s ease-out,
      transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
}

.auth-modal-leave-active {
  transition: opacity 0.15s ease-in;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .auth-modal {
    transition:
      opacity 0.15s ease-in,
      transform 0.15s ease-in;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
}

.auth-modal-enter-from {
  opacity: 0;

  .auth-modal {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
}

.auth-modal-leave-to {
  opacity: 0;

  .auth-modal {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}
</style>
