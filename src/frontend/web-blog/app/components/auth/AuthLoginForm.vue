<!--
  @file AuthLoginForm.vue
  @description 登录表单：邮箱密码 + 社交登录（GitHub / Google）
  @author TixXin
  @since 2026-04-10
-->

<template>
  <form class="auth-login" @submit.prevent="onSubmit">
    <!-- 邮箱 -->
    <div class="auth-field">
      <label class="auth-field__label" for="login-email">邮箱</label>
      <div class="auth-field__input-wrap">
        <Icon name="lucide:mail" size="16" class="auth-field__icon" />
        <input
          id="login-email"
          v-model="form.email"
          type="email"
          class="input-field auth-field__input"
          placeholder="your@email.com"
          autocomplete="email"
        >
      </div>
    </div>

    <!-- 密码 -->
    <div class="auth-field">
      <label class="auth-field__label" for="login-password">密码</label>
      <div class="auth-field__input-wrap">
        <Icon name="lucide:lock" size="16" class="auth-field__icon" />
        <input
          id="login-password"
          v-model="form.password"
          :type="showPassword ? 'text' : 'password'"
          class="input-field auth-field__input"
          placeholder="输入密码"
          autocomplete="current-password"
        >
        <button
          type="button"
          class="auth-field__toggle"
          :aria-label="showPassword ? '隐藏密码' : '显示密码'"
          @click="showPassword = !showPassword"
        >
          <Icon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" size="16" />
        </button>
      </div>
    </div>

    <!-- 忘记密码 -->
    <div class="auth-login__forgot">
      <button type="button" class="auth-link" @click="emit('switchView', 'forgot')">
        忘记密码？
      </button>
    </div>

    <!-- 登录按钮 -->
    <button type="submit" class="btn-primary auth-submit" :disabled="submitting">
      <Icon v-if="submitting" name="lucide:loader-2" size="16" class="auth-submit__spinner" />
      <span>{{ submitting ? '登录中...' : '登录' }}</span>
    </button>

    <!-- 分隔线 -->
    <div class="auth-divider">
      <span class="auth-divider__line" />
      <span class="auth-divider__text">或</span>
      <span class="auth-divider__line" />
    </div>

    <!-- 社交登录 -->
    <div class="auth-social">
      <button type="button" class="auth-social__btn" @click="onSocialLogin('github')">
        <Icon name="lucide:github" size="18" />
        <span>GitHub</span>
      </button>
      <button type="button" class="auth-social__btn" @click="onSocialLogin('google')">
        <Icon name="lucide:chrome" size="18" />
        <span>Google</span>
      </button>
    </div>

    <!-- 切换到注册 -->
    <p class="auth-switch">
      没有账号？
      <button type="button" class="auth-link" @click="emit('switchView', 'register')">
        立即注册
      </button>
    </p>
  </form>
</template>

<script setup lang="ts">
import type { AuthView, LoginForm } from '~/features/auth/types'

const emit = defineEmits<{
  switchView: [view: AuthView]
}>()

const { success, warning } = useToast()

const form = reactive<LoginForm>({
  email: '',
  password: '',
})

const showPassword = ref(false)
const submitting = ref(false)

function validate(): boolean {
  if (!form.email.trim()) {
    warning('请输入邮箱地址')
    return false
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    warning('请输入有效的邮箱地址')
    return false
  }
  if (!form.password) {
    warning('请输入密码')
    return false
  }
  return true
}

async function onSubmit() {
  if (!validate()) return
  submitting.value = true

  // Mock 登录延迟
  await new Promise((resolve) => setTimeout(resolve, 1200))
  submitting.value = false
  success('登录成功，欢迎回来！')
}

function onSocialLogin(provider: 'github' | 'google') {
  const name = provider === 'github' ? 'GitHub' : 'Google'
  success(`正在跳转到 ${name} 授权...`)
}
</script>

<style lang="scss" scoped>
.auth-login {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-login__forgot {
  display: flex;
  justify-content: flex-end;
  margin-top: -0.5rem;
}
</style>
