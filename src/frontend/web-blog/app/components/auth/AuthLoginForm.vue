<!--
  @file AuthLoginForm.vue
  @description 真实博主登录表单，认证成功后才更新界面状态；登录失败原因通过 aria-describedby 关联到字段
-->
<template>
  <form class="auth-login" @submit.prevent="onSubmit">
    <p v-if="!hideHint" class="auth-login__hint">{{ $t('interaction.auth.loginHint') }}</p>
    <div class="auth-field">
      <label class="auth-field__label" for="login-username">{{ $t('interaction.auth.username') }}</label>
      <input
        id="login-username"
        v-model.trim="username"
        class="input-field auth-field__input"
        autocomplete="username"
        maxlength="64"
        required
        :aria-invalid="!!errorMessage || undefined"
        :aria-describedby="errorMessage ? 'login-error' : undefined"
        :disabled="submitting || !hydrated"
      />
    </div>
    <div class="auth-field">
      <label class="auth-field__label" for="login-password">{{ $t('interaction.auth.password') }}</label>
      <div class="auth-field__password-wrapper">
        <input
          id="login-password"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          class="input-field auth-field__input"
          autocomplete="current-password"
          maxlength="128"
          required
          :aria-invalid="!!errorMessage || undefined"
          :aria-describedby="errorMessage ? 'login-error' : undefined"
          :disabled="submitting || !hydrated"
        />
        <button
          type="button"
          class="auth-field__password-toggle"
          :aria-label="showPassword ? t('interaction.auth.hidePassword') : t('interaction.auth.showPassword')"
          :aria-pressed="showPassword"
          aria-controls="login-password"
          tabindex="-1"
          @click="showPassword = !showPassword"
        >
          <Icon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" aria-hidden="true" />
        </button>
      </div>
    </div>
    <!-- 凭据错误同时关联到两个输入框，读屏聚焦字段时可听到原因 -->
    <p v-if="errorMessage" id="login-error" role="alert">{{ errorMessage }}</p>
    <button :aria-busy="submitting" type="submit" class="btn-primary auth-submit" :disabled="submitting || !hydrated">
      {{ submitting ? $t('interaction.auth.submitting') : $t('interaction.auth.submit') }}
    </button>
    <button type="button" class="auth-link" @click="emit('switchView', 'forgot')">
      {{ $t('interaction.auth.help') }}
    </button>
  </form>
</template>
<script setup lang="ts">
import type { AuthView } from '~/features/auth/types'
const emit = defineEmits<{ switchView: [view: AuthView]; authenticated: [] }>()
const props = defineProps<{ hideHint?: boolean }>()
const { hideHint } = toRefs(props)
const { login } = useCurrentUser()
const { close } = useLoginDrawer()
const { success } = useToast()
const { t } = useI18n()
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})
const errorMessage = ref('')
async function onSubmit() {
  if (submitting.value || !hydrated.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await login(username.value, password.value)
    password.value = ''
    success(t('interaction.auth.success'))
    close()
    emit('authenticated')
  } catch (cause) {
    errorMessage.value = apiErrorMessage(cause, 'interaction.auth.failed')
  } finally {
    submitting.value = false
  }
}
</script>
<style scoped lang="scss">
@use 'tokens' as *;

.auth-login {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}
.auth-login__hint {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.55;
  transition: color 0.3s ease;
}
.auth-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.auth-field__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-soft);
  transition: color 0.3s ease;
}
.auth-field__password-wrapper {
  position: relative;
}
.auth-field__input {
  min-height: 2.75rem;
  border-radius: $radius-md;
  padding: 0.5rem 0.875rem;
  transition:
    $transition-colors,
    box-shadow var(--motion-fast, 0.16s) ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.auth-field__password-wrapper .auth-field__input {
  padding-right: 2.75rem;
}
.auth-field__password-toggle {
  position: absolute;
  top: 0;
  right: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 0;
  border-radius: $radius-md;
  background: none;
  color: var(--text-soft);
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: var(--text-main);
  }
}
.auth-submit {
  min-height: 2.75rem;
  width: 100%;
  border-radius: $radius-md;
  transition:
    $transition-colors,
    box-shadow var(--motion-fast, 0.16s) ease,
    opacity var(--motion-fast, 0.16s) ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.auth-link {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--accent-text);
  cursor: pointer;
  transition:
    color 0.3s ease,
    opacity var(--motion-fast, 0.16s) ease;

  &:hover {
    text-decoration: underline;
  }
}
</style>
