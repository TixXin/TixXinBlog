<!--
  @file AuthRegisterForm.vue
  @description 注册表单：昵称 + 邮箱 + 密码 + 确认密码 + 密码强度
  @author TixXin
  @since 2026-04-10
-->

<template>
  <form class="auth-register" @submit.prevent="onSubmit">
    <!-- 昵称 -->
    <div class="auth-field">
      <label class="auth-field__label" for="reg-nickname">昵称</label>
      <div class="auth-field__input-wrap">
        <Icon name="lucide:user" size="16" class="auth-field__icon" />
        <input
          id="reg-nickname"
          v-model="form.nickname"
          type="text"
          class="input-field auth-field__input"
          placeholder="你的昵称"
          autocomplete="username"
        >
      </div>
    </div>

    <!-- 邮箱 -->
    <div class="auth-field">
      <label class="auth-field__label" for="reg-email">邮箱</label>
      <div class="auth-field__input-wrap">
        <Icon name="lucide:mail" size="16" class="auth-field__icon" />
        <input
          id="reg-email"
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
      <label class="auth-field__label" for="reg-password">密码</label>
      <div class="auth-field__input-wrap">
        <Icon name="lucide:lock" size="16" class="auth-field__icon" />
        <input
          id="reg-password"
          v-model="form.password"
          :type="showPassword ? 'text' : 'password'"
          class="input-field auth-field__input"
          placeholder="至少 6 位字符"
          autocomplete="new-password"
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
      <!-- 密码强度指示器 -->
      <div v-if="form.password" class="auth-strength">
        <div class="auth-strength__bar">
          <div
            class="auth-strength__fill"
            :class="`auth-strength__fill--${strengthLevel}`"
            :style="{ width: `${strengthPercent}%` }"
          />
        </div>
        <span class="auth-strength__text" :class="`auth-strength__text--${strengthLevel}`">
          {{ strengthLabel }}
        </span>
      </div>
    </div>

    <!-- 确认密码 -->
    <div class="auth-field">
      <label class="auth-field__label" for="reg-confirm">确认密码</label>
      <div class="auth-field__input-wrap">
        <Icon name="lucide:lock" size="16" class="auth-field__icon" />
        <input
          id="reg-confirm"
          v-model="form.confirmPassword"
          :type="showPassword ? 'text' : 'password'"
          class="input-field auth-field__input"
          placeholder="再次输入密码"
          autocomplete="new-password"
        >
      </div>
    </div>

    <!-- 注册按钮 -->
    <button type="submit" class="btn-primary auth-submit" :disabled="submitting">
      <Icon v-if="submitting" name="lucide:loader-2" size="16" class="auth-submit__spinner" />
      <span>{{ submitting ? '注册中...' : '注册' }}</span>
    </button>

    <!-- 切换到登录 -->
    <p class="auth-switch">
      已有账号？
      <button type="button" class="auth-link" @click="emit('switchView', 'login')">
        返回登录
      </button>
    </p>
  </form>
</template>

<script setup lang="ts">
import type { AuthView, RegisterForm } from '~/features/auth/types'

const emit = defineEmits<{
  switchView: [view: AuthView]
}>()

const { success, warning } = useToast()

const form = reactive<RegisterForm>({
  nickname: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const showPassword = ref(false)
const submitting = ref(false)

/** 密码强度计算 */
const strengthScore = computed(() => {
  const p = form.password
  if (!p) return 0
  let score = 0
  if (p.length >= 6) score++
  if (p.length >= 10) score++
  if (/[A-Z]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  return score
})

const strengthLevel = computed(() => {
  if (strengthScore.value <= 1) return 'weak'
  if (strengthScore.value <= 3) return 'medium'
  return 'strong'
})

const strengthPercent = computed(() => Math.min(strengthScore.value * 20, 100))

const strengthLabel = computed(() => {
  const labels = { weak: '弱', medium: '中', strong: '强' }
  return labels[strengthLevel.value]
})

function validate(): boolean {
  if (!form.nickname.trim()) {
    warning('请输入昵称')
    return false
  }
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    warning('请输入有效的邮箱地址')
    return false
  }
  if (form.password.length < 6) {
    warning('密码至少需要 6 位字符')
    return false
  }
  if (form.password !== form.confirmPassword) {
    warning('两次输入的密码不一致')
    return false
  }
  return true
}

async function onSubmit() {
  if (!validate()) return
  submitting.value = true
  await new Promise((resolve) => setTimeout(resolve, 1200))
  submitting.value = false
  success('注册成功！请查收验证邮件')
}
</script>

<style lang="scss" scoped>
.auth-register {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 密码强度指示器 */
.auth-strength {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
}

.auth-strength__bar {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--surface-3);
  overflow: hidden;
}

.auth-strength__fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;

  &--weak {
    background: var(--danger);
  }

  &--medium {
    background: var(--presence-idle);
  }

  &--strong {
    background: var(--presence-online);
  }
}

.auth-strength__text {
  font-size: 0.6875rem;
  font-weight: 600;
  flex-shrink: 0;

  &--weak {
    color: var(--danger);
  }

  &--medium {
    color: var(--presence-idle);
  }

  &--strong {
    color: var(--presence-online);
  }
}
</style>
