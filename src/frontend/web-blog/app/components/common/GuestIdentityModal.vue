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
        <div class="guest-id-modal">
          <header class="guest-id-modal__header">
            <Icon name="lucide:user-round-pen" size="16" class="guest-id-modal__icon" />
            <h3 class="guest-id-modal__title">填写你的身份</h3>
            <button type="button" class="guest-id-modal__close" aria-label="关闭" @click="$emit('cancel')">
              <Icon name="lucide:x" size="16" />
            </button>
          </header>

          <div class="guest-id-modal__body">
            <!-- 说明文案 + 登录入口 -->
            <div class="guest-id-notice">
              <p class="guest-id-notice__text">
                评论前需要一个身份标识，方便其他读者认识你。信息仅存储在你的浏览器中，不会上传到服务器。
              </p>
              <button type="button" class="guest-id-notice__login" @click="onSwitchToLogin">
                <Icon name="lucide:log-in" size="12" />
                已有账号？点击登录
              </button>
            </div>

            <!-- 头像预览 -->
            <div class="guest-id-avatar-preview">
              <img
                v-if="avatarPreviewUrl"
                :src="avatarPreviewUrl"
                class="guest-id-avatar-preview__img"
                alt="头像预览"
                @error="avatarLoadError = true"
              >
              <span v-else class="guest-id-avatar-preview__letter" :style="{ background: avatarColor }">
                {{ avatarLetter }}
              </span>
              <span class="guest-id-avatar-preview__hint">{{ avatarHint }}</span>
            </div>

            <!-- 表单 -->
            <form class="guest-id-form" @submit.prevent="onSubmit">
              <!-- 昵称（必填） -->
              <div class="guest-id-field">
                <label class="guest-id-field__label" for="gid-nickname">
                  昵称 <span class="guest-id-field__required">*</span>
                </label>
                <div class="guest-id-field__input-wrap">
                  <Icon name="lucide:user" size="14" class="guest-id-field__icon" />
                  <input
                    id="gid-nickname"
                    v-model.trim="form.nickname"
                    type="text"
                    class="guest-id-field__input"
                    placeholder="你的昵称"
                    maxlength="20"
                    required
                  >
                </div>
              </div>

              <!-- 邮箱（可选） -->
              <div class="guest-id-field">
                <label class="guest-id-field__label" for="gid-email">
                  邮箱
                  <span class="guest-id-field__optional">可选 · QQ 邮箱自动获取头像</span>
                </label>
                <div class="guest-id-field__input-wrap">
                  <Icon name="lucide:mail" size="14" class="guest-id-field__icon" />
                  <input
                    id="gid-email"
                    v-model.trim="form.email"
                    type="email"
                    class="guest-id-field__input"
                    placeholder="your@email.com"
                  >
                </div>
              </div>

              <!-- 站点（可选） -->
              <div class="guest-id-field">
                <label class="guest-id-field__label" for="gid-website">
                  站点
                  <span class="guest-id-field__optional">可选</span>
                </label>
                <div class="guest-id-field__input-wrap">
                  <Icon name="lucide:globe" size="14" class="guest-id-field__icon" />
                  <input
                    id="gid-website"
                    v-model.trim="form.website"
                    type="url"
                    class="guest-id-field__input"
                    placeholder="https://your-site.com"
                  >
                </div>
              </div>

              <!-- 头像 URL（可选） -->
              <div class="guest-id-field">
                <label class="guest-id-field__label" for="gid-avatar">
                  头像 URL
                  <span class="guest-id-field__optional">可选 · 优先级高于邮箱头像</span>
                </label>
                <div class="guest-id-field__input-wrap">
                  <Icon name="lucide:image" size="14" class="guest-id-field__icon" />
                  <input
                    id="gid-avatar"
                    v-model.trim="form.avatarUrl"
                    type="url"
                    class="guest-id-field__input"
                    placeholder="https://example.com/avatar.png"
                  >
                </div>
              </div>

              <button type="submit" class="guest-id-submit" :disabled="!form.nickname">
                <Icon name="lucide:check" size="14" />
                <span>确认身份</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { resolveGuestAvatar, isQQEmail } from '~/composables/useGuestIdentity'
import type { GuestIdentity } from '~/composables/useGuestIdentity'

const emit = defineEmits<{
  confirm: [identity: GuestIdentity]
  cancel: []
  /** 用户选择「点击登录」→ 关闭身份面板，由父级打开登录抽屉 */
  login: []
}>()

const { guestIdentity, setIdentity } = useGuestIdentity()

const form = reactive({
  nickname: '',
  email: '',
  website: '',
  avatarUrl: '',
})

const avatarLoadError = ref(false)

// 头像颜色池（复用留言板配色）
const avatarColors = [
  '#5b7cfa', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
]

// 根据昵称哈希选色
const avatarColor = computed(() => {
  const name = form.nickname || ''
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]
})

const avatarLetter = computed(() => {
  const name = form.nickname
  return name ? name.charAt(0).toUpperCase() : '?'
})

// 输入变化时重置头像加载错误
watch([() => form.email, () => form.avatarUrl], () => {
  avatarLoadError.value = false
})

/** 实时预览头像 URL */
const avatarPreviewUrl = computed(() => {
  if (avatarLoadError.value) return ''
  const mock: GuestIdentity = {
    id: '',
    nickname: form.nickname,
    email: form.email,
    avatarUrl: form.avatarUrl,
  }
  return resolveGuestAvatar(mock)
})

const avatarHint = computed(() => {
  if (form.avatarUrl) return '自定义头像'
  if (form.email && isQQEmail(form.email)) return 'QQ 头像'
  if (form.nickname) return '首字母头像'
  return '填写昵称后生成'
})

// 弹窗打开时回填已有身份
const props = defineProps<{ visible: boolean }>()

watch(
  () => props.visible,
  (v) => {
    if (v && guestIdentity.value) {
      form.nickname = guestIdentity.value.nickname
      form.email = guestIdentity.value.email || ''
      form.website = guestIdentity.value.website || ''
      form.avatarUrl = guestIdentity.value.avatarUrl || ''
    }
  },
)

function onSwitchToLogin() {
  emit('login')
}

function onSubmit() {
  if (!form.nickname) return
  setIdentity({
    nickname: form.nickname,
    email: form.email || undefined,
    website: form.website || undefined,
    avatarUrl: form.avatarUrl || undefined,
  })
  emit('confirm', guestIdentity.value!)
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
  color: var(--accent);
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
  cursor: pointer;

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
  color: var(--accent);
  cursor: pointer;
  transition: opacity 0.18s;

  &:hover {
    opacity: 0.75;
  }
}

/* ---- 头像预览 ---- */
.guest-id-avatar-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
}

.guest-id-avatar-preview__img,
.guest-id-avatar-preview__letter {
  width: 56px;
  height: 56px;
  border-radius: $radius-full;
  object-fit: cover;
}

.guest-id-avatar-preview__letter {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
}

.guest-id-avatar-preview__hint {
  font-size: 0.6875rem;
  color: var(--text-faint);
}

/* ---- 表单 ---- */
.guest-id-form {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.guest-id-field__label {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
}

.guest-id-field__required {
  color: var(--danger);
  font-size: 0.75rem;
}

.guest-id-field__optional {
  font-size: 0.625rem;
  font-weight: 400;
  color: var(--text-faint);
}

.guest-id-field__input-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  transition: border-color 0.18s;

  &:focus-within {
    border-color: var(--accent);
  }
}

.guest-id-field__icon {
  flex-shrink: 0;
  color: var(--text-faint);
}

.guest-id-field__input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.8125rem;
  color: var(--text-main);

  &::placeholder {
    color: var(--text-faint);
  }
}

.guest-id-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  margin-top: 0.25rem;
  border: none;
  border-radius: $radius-md;
  background: var(--accent);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* ---- Transition ---- */
.guest-id-modal-enter-active,
.guest-id-modal-leave-active {
  transition: opacity 0.2s ease;
}

.guest-id-modal-enter-active .guest-id-modal,
.guest-id-modal-leave-active .guest-id-modal {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
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
