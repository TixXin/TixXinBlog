<!--
  @file GuestIdentityModal.vue
  @description 游客身份填写弹窗：首次评论时弹出，填写昵称/邮箱/站点/头像，QQ 邮箱实时预览 QQ 头像
  @author TixXin
  @since 2026-04-12
-->

<template>
  <Teleport to="body">
    <Transition name="guest-id-modal">
      <div v-if="visible" class="guest-id-overlay" @click.self="$emit('cancel')">
        <div
          ref="dialogRef"
          class="guest-id-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="$t('layout.guestIdentity.dialogLabel')"
          tabindex="-1"
        >
          <header class="guest-id-modal__header">
            <Icon name="lucide:user-round-pen" size="16" class="guest-id-modal__icon" />
            <h3 class="guest-id-modal__title">{{ $t('layout.guestIdentity.title') }}</h3>
            <button
              type="button"
              class="guest-id-modal__close"
              :aria-label="$t('layout.guestIdentity.close')"
              @click="$emit('cancel')"
            >
              <Icon name="lucide:x" size="16" />
            </button>
          </header>

          <div class="guest-id-modal__body">
            <!-- 说明文案 + 登录入口 -->
            <div class="guest-id-notice">
              <p class="guest-id-notice__text">
                {{ $t('layout.guestIdentity.notice') }}
              </p>
              <button type="button" class="guest-id-notice__login" @click="onSwitchToLogin">
                <Icon name="lucide:log-in" size="12" />
                {{ $t('layout.guestIdentity.login') }}
              </button>
            </div>

            <!-- 头像预览与表单 -->
            <CommonGuestIdentityForm :initial="formInitial" @submit="onFormSubmit" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { GuestIdentity } from '~/composables/useGuestIdentity'

const emit = defineEmits<{
  confirm: [identity: GuestIdentity]
  cancel: []
  /** 用户选择「点击登录」→ 关闭身份面板，由父级打开登录抽屉 */
  login: []
}>()

const props = defineProps<{ visible: boolean }>()
const { guestIdentity, setIdentity } = useGuestIdentity()

const dialogRef = ref<HTMLElement | null>(null)
useModalFocus(() => props.visible, dialogRef, {
  close: () => emit('cancel'),
  initialFocus: () => dialogRef.value?.querySelector('input') ?? null,
})

const formInitial = computed(() => (props.visible ? guestIdentity.value : null))

function onSwitchToLogin() {
  emit('login')
}

function onFormSubmit(data: { nickname: string; email?: string; website?: string; avatarUrl?: string }) {
  setIdentity(data)
  if (guestIdentity.value) {
    emit('confirm', guestIdentity.value)
  }
}
</script>

<style lang="scss" scoped>
.guest-id-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: min(14vh, 7rem);
}

.guest-id-modal {
  width: min(440px, calc(100vw - 2rem));
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.guest-id-modal__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-soft);
}

.guest-id-modal__icon {
  color: var(--accent-text);
  flex-shrink: 0;
}

.guest-id-modal__title {
  flex: 1;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-main);
}

.guest-id-modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: transparent;
  border-radius: $radius-full;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}

.guest-id-modal__body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

/* ---- 说明文案 + 登录入口 ---- */
.guest-id-notice {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
}

.guest-id-notice__text {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--text-soft);
}

.guest-id-notice__login {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.25rem;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent-text);
  cursor: var(--interaction-cursor, pointer);
  transition: opacity 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    opacity: 0.75;
  }
}

/* ---- Transition ---- */
.guest-id-modal-enter-active,
.guest-id-modal-leave-active {
  transition: opacity 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.guest-id-modal-enter-active .guest-id-modal,
.guest-id-modal-leave-active .guest-id-modal {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.guest-id-modal-enter-from,
.guest-id-modal-leave-to {
  opacity: 0;
}

.guest-id-modal-enter-from .guest-id-modal,
.guest-id-modal-leave-to .guest-id-modal {
  transform: translateY(-10px) scale(0.98);
}
</style>
