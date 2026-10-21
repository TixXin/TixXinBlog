<!--
  @file GuestIdentityForm.vue
  @description 游客身份表单与头像预览区块：昵称/邮箱/站点/头像填写与实时头像计算
  @author TixXin
  @since 2026-10-21
-->

<template>
  <div class="guest-id-avatar-preview">
    <img
      v-if="avatarPreviewUrl"
      :src="avatarPreviewUrl"
      class="guest-id-avatar-preview__img"
      :alt="$t('layout.guestIdentity.avatarPreview')"
      @error="avatarLoadError = true"
    />
    <span v-else class="guest-id-avatar-preview__letter" :style="{ background: avatarColor }">
      {{ avatarLetter }}
    </span>
    <span class="guest-id-avatar-preview__hint">{{ avatarHint }}</span>
  </div>

  <form class="guest-id-form" @submit.prevent="onSubmit">
    <!-- 昵称（必填） -->
    <div class="guest-id-field">
      <label class="guest-id-field__label" for="gid-nickname">
        {{ $t('layout.guestIdentity.nickname') }} <span class="guest-id-field__required">*</span>
      </label>
      <div class="guest-id-field__input-wrap">
        <Icon name="lucide:user" size="14" class="guest-id-field__icon" />
        <input
          id="gid-nickname"
          v-model.trim="form.nickname"
          type="text"
          class="guest-id-field__input"
          :placeholder="$t('layout.guestIdentity.nicknamePlaceholder')"
          maxlength="20"
          required
        />
      </div>
    </div>

    <!-- 邮箱（可选） -->
    <div class="guest-id-field">
      <label class="guest-id-field__label" for="gid-email">
        {{ $t('layout.guestIdentity.email') }}
        <span class="guest-id-field__optional">{{ $t('layout.guestIdentity.emailHint') }}</span>
      </label>
      <div class="guest-id-field__input-wrap">
        <Icon name="lucide:mail" size="14" class="guest-id-field__icon" />
        <input
          id="gid-email"
          v-model.trim="form.email"
          type="email"
          class="guest-id-field__input"
          placeholder="your@email.com"
        />
      </div>
    </div>

    <!-- 站点（可选） -->
    <div class="guest-id-field">
      <label class="guest-id-field__label" for="gid-website">
        {{ $t('layout.guestIdentity.website') }}
        <span class="guest-id-field__optional">{{ $t('layout.guestIdentity.optional') }}</span>
      </label>
      <div class="guest-id-field__input-wrap">
        <Icon name="lucide:globe" size="14" class="guest-id-field__icon" />
        <input
          id="gid-website"
          v-model.trim="form.website"
          type="url"
          class="guest-id-field__input"
          placeholder="https://your-site.com"
        />
      </div>
    </div>

    <!-- 头像 URL（可选） -->
    <div class="guest-id-field">
      <label class="guest-id-field__label" for="gid-avatar">
        {{ $t('layout.guestIdentity.avatarUrl') }}
        <span class="guest-id-field__optional">{{ $t('layout.guestIdentity.avatarUrlHint') }}</span>
      </label>
      <div class="guest-id-field__input-wrap">
        <Icon name="lucide:image" size="14" class="guest-id-field__icon" />
        <input
          id="gid-avatar"
          v-model.trim="form.avatarUrl"
          type="url"
          class="guest-id-field__input"
          placeholder="https://example.com/avatar.png"
        />
      </div>
    </div>

    <button type="submit" class="guest-id-submit" :disabled="!form.nickname">
      <Icon name="lucide:check" size="14" />
      <span>{{ $t('layout.guestIdentity.submit') }}</span>
    </button>
  </form>
</template>

<script setup lang="ts">
import { resolveGuestAvatar, isQQEmail, useQQAvatarEnabled } from '~/composables/useGuestIdentity'
import type { GuestIdentity } from '~/composables/useGuestIdentity'

const props = defineProps<{
  initial?: GuestIdentity | null
}>()

const emit = defineEmits<{
  submit: [data: { nickname: string; email?: string; website?: string; avatarUrl?: string }]
}>()

const qqAvatarEnabled = useQQAvatarEnabled()
const { t } = useI18n()

const form = reactive({
  nickname: '',
  email: '',
  website: '',
  avatarUrl: '',
})

const avatarLoadError = ref(false)

const avatarColors = ['#5b7cfa', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

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

watch([() => form.email, () => form.avatarUrl], () => {
  avatarLoadError.value = false
})

const avatarPreviewUrl = computed(() => {
  if (avatarLoadError.value) return ''
  const mock: GuestIdentity = {
    id: '',
    nickname: form.nickname,
    email: form.email,
    avatarUrl: form.avatarUrl,
  }
  return resolveGuestAvatar(mock, qqAvatarEnabled)
})

const avatarHint = computed(() => {
  if (form.avatarUrl) return t('layout.guestIdentity.hintCustom')
  if (qqAvatarEnabled && form.email && isQQEmail(form.email)) return t('layout.guestIdentity.hintQQ')
  if (form.nickname) return t('layout.guestIdentity.hintLetter')
  return t('layout.guestIdentity.hintEmpty')
})

function populate(identity?: GuestIdentity | null) {
  if (identity) {
    form.nickname = identity.nickname
    form.email = identity.email || ''
    form.website = identity.website || ''
    form.avatarUrl = identity.avatarUrl || ''
  }
}

watch(() => props.initial, populate, { immediate: true })

function onSubmit() {
  if (!form.nickname) return
  emit('submit', {
    nickname: form.nickname,
    email: form.email || undefined,
    website: form.website || undefined,
    avatarUrl: form.avatarUrl || undefined,
  })
}
</script>

<style lang="scss" scoped>
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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

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
  background: var(--accent-action);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: var(--interaction-cursor, pointer);
  transition: opacity 0.2s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.4;
    cursor: var(--interaction-cursor, not-allowed);
  }
}
</style>
