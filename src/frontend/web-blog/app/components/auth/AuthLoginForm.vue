<!--
  @file AuthLoginForm.vue
  @description 真实博主登录表单，认证成功后才更新界面状态
-->
<template>
  <form class="auth-login" @submit.prevent="onSubmit">
    <p class="auth-login__hint">博主管理登录。游客发表评论无需账号。</p>
    <div class="auth-field">
      <label class="auth-field__label" for="login-username">用户名</label>
      <input
        id="login-username"
        v-model.trim="username"
        class="input-field auth-field__input"
        autocomplete="username"
        maxlength="64"
        required
        :disabled="submitting || !hydrated"
      />
    </div>
    <div class="auth-field">
      <label class="auth-field__label" for="login-password">密码</label>
      <input
        id="login-password"
        v-model="password"
        type="password"
        class="input-field auth-field__input"
        autocomplete="current-password"
        maxlength="128"
        required
        :disabled="submitting || !hydrated"
      />
    </div>
    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
    <button type="submit" class="btn-primary auth-submit" :disabled="submitting || !hydrated">
      {{ submitting ? '登录中…' : '登录' }}
    </button>
    <button type="button" class="auth-link" @click="emit('switchView', 'forgot')">登录帮助</button>
  </form>
</template>
<script setup lang="ts">
import type { AuthView } from '~/features/auth/types'
const emit = defineEmits<{ switchView: [view: AuthView]; authenticated: [] }>()
const { login } = useCurrentUser()
const { close } = useLoginDrawer()
const { success } = useToast()
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
    success('登录成功')
    close()
    emit('authenticated')
  } catch (cause) {
    const message = (cause as { data?: { message?: unknown } }).data?.message
    errorMessage.value = typeof message === 'string' ? message : '暂时无法登录，请稍后重试'
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
