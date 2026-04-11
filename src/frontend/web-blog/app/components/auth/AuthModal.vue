<!--
  @file AuthModal.vue
  @description 居中弹窗包装器（Aurora/通用主题），Teleport 到 body + 遮罩层
  @author TixXin
  @since 2026-04-10
-->

<template>
  <Teleport to="body">
    <Transition name="auth-modal">
      <div v-if="isOpen" class="auth-modal-overlay" @click.self="close">
        <div class="auth-modal">
          <AuthPanel />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { isOpen, close } = useLoginDrawer()

/** ESC 关闭 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
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

  .auth-modal {
    transition: opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

.auth-modal-leave-active {
  transition: opacity 0.15s ease-in;

  .auth-modal {
    transition: opacity 0.15s ease-in, transform 0.15s ease-in;
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
