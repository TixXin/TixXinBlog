<!--
  @file AuthLoginForm.vue
  @description 真实博主登录表单，认证成功后才更新界面状态；登录失败原因通过 aria-describedby 关联到字段
-->
<template>
  <form class="auth-login" @submit.prevent="onSubmit">
    <p class="auth-login__hint">{{ $t('interaction.auth.loginHint') }}</p>
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
      <input
        id="login-password"
        v-model="password"
        type="password"
        class="input-field auth-field__input"
        autocomplete="current-password"
        maxlength="128"
        required
        :aria-invalid="!!errorMessage || undefined"
        :aria-describedby="errorMessage ? 'login-error' : undefined"
        :disabled="submitting || !hydrated"
      />
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
const { login } = useCurrentUser()
const { close } = useLoginDrawer()
const { success } = useToast()
const { t } = useI18n()
const username = ref('')
const password = ref('')
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
.auth-login {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.auth-login__hint {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin: 0;
}
</style>
