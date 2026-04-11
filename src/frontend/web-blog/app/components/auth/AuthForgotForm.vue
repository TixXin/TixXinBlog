<!--
  @file AuthForgotForm.vue
  @description 忘记密码表单：输入邮箱发送重置链接
  @author TixXin
  @since 2026-04-10
-->

<template>
  <form class="auth-forgot" @submit.prevent="onSubmit">
    <p class="auth-forgot__hint">
      输入你的注册邮箱，我们将发送密码重置链接
    </p>

    <!-- 邮箱 -->
    <div class="auth-field">
      <label class="auth-field__label" for="forgot-email">邮箱</label>
      <div class="auth-field__input-wrap">
        <Icon name="lucide:mail" size="16" class="auth-field__icon" />
        <input
          id="forgot-email"
          v-model="form.email"
          type="email"
          class="input-field auth-field__input"
          placeholder="your@email.com"
          autocomplete="email"
        >
      </div>
    </div>

    <!-- 发送按钮 -->
    <button type="submit" class="btn-primary auth-submit" :disabled="submitting">
      <Icon v-if="submitting" name="lucide:loader-2" size="16" class="auth-submit__spinner" />
      <span>{{ submitting ? '发送中...' : '发送重置链接' }}</span>
    </button>

    <!-- 返回登录 -->
    <p class="auth-switch">
      <button type="button" class="auth-link" @click="emit('switchView', 'login')">
        <Icon name="lucide:arrow-left" size="14" />
        返回登录
      </button>
    </p>
  </form>
</template>

<script setup lang="ts">
import type { AuthView, ForgotForm } from '~/features/auth/types'

const emit = defineEmits<{
  switchView: [view: AuthView]
}>()

const { success, warning } = useToast()

const form = reactive<ForgotForm>({
  email: '',
})

const submitting = ref(false)

async function onSubmit() {
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    warning('请输入有效的邮箱地址')
    return
  }
  submitting.value = true
  await new Promise((resolve) => setTimeout(resolve, 1200))
  submitting.value = false
  success('重置链接已发送，请查收邮件')
}
</script>

<style lang="scss" scoped>
.auth-forgot {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-forgot__hint {
  font-size: 0.8125rem;
  color: var(--text-soft);
  margin: 0;
  line-height: 1.5;
}
</style>
