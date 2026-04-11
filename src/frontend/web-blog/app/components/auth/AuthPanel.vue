<!--
  @file AuthPanel.vue
  @description 认证面板容器：根据 currentView 渲染登录/注册/忘记密码表单，带视图切换动画
  @author TixXin
  @since 2026-04-10
-->

<template>
  <div class="auth-panel" @click.stop>
    <!-- 头部 -->
    <div class="auth-panel__header">
      <h3 class="auth-panel__title">{{ viewTitle }}</h3>
      <button type="button" class="auth-panel__close" aria-label="关闭" @click="close">
        <Icon name="lucide:x" size="18" />
      </button>
    </div>

    <!-- 视图切换区域 -->
    <div class="auth-panel__body">
      <Transition :name="transitionName" mode="out-in">
        <AuthLoginForm v-if="currentView === 'login'" :key="'login'" @switch-view="switchView" />
        <AuthRegisterForm v-else-if="currentView === 'register'" :key="'register'" @switch-view="switchView" />
        <AuthForgotForm v-else :key="'forgot'" @switch-view="switchView" />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AuthView } from '~/features/auth/types'

const { currentView, close, switchView } = useLoginDrawer()

const viewTitle = computed(() => {
  const titles: Record<AuthView, string> = {
    login: '登录',
    register: '注册',
    forgot: '找回密码',
  }
  return titles[currentView.value]
})

/** 视图切换方向 */
const transitionName = ref('auth-slide-left')

const viewOrder: AuthView[] = ['login', 'register', 'forgot']

watch(currentView, (newView, oldView) => {
  const newIdx = viewOrder.indexOf(newView)
  const oldIdx = viewOrder.indexOf(oldView)
  transitionName.value = newIdx > oldIdx ? 'auth-slide-left' : 'auth-slide-right'
})
</script>

<style lang="scss" scoped>
.auth-panel {
  width: 100%;
  max-width: 380px;
  margin: 0 auto;
}

.auth-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.auth-panel__title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.auth-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: $radius-full;
  border: none;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }
}

.auth-panel__body {
  position: relative;
  overflow: hidden;
}

/* 视图切换动画：向左滑入 */
.auth-slide-left-enter-active,
.auth-slide-left-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.auth-slide-left-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.auth-slide-left-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

/* 视图切换动画：向右滑入 */
.auth-slide-right-enter-active,
.auth-slide-right-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.auth-slide-right-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}

.auth-slide-right-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
</style>

<!-- 共享表单样式（非 scoped，被子组件使用） -->
<style lang="scss">
/* 表单字段 */
.auth-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.auth-field__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-main);
}

.auth-field__input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.auth-field__icon {
  position: absolute;
  left: 0.875rem;
  color: var(--text-soft);
  pointer-events: none;
  z-index: 1;
}

.auth-field__input {
  padding-left: 2.5rem !important;
  padding-right: 2.5rem !important;
}

.auth-field__toggle {
  position: absolute;
  right: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: $radius-full;
  border: none;
  background: transparent;
  color: var(--text-soft);
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: var(--text-main);
  }
}

/* 提交按钮 */
.auth-submit {
  width: 100%;
  padding: 0.625rem 1rem !important;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.auth-submit__spinner {
  animation: auth-spin 1s linear infinite;
}

@keyframes auth-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 分隔线 */
.auth-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.auth-divider__line {
  flex: 1;
  height: 1px;
  background: var(--border-soft);
}

.auth-divider__text {
  font-size: 0.75rem;
  color: var(--text-faint);
  white-space: nowrap;
}

/* 社交登录 */
.auth-social {
  display: flex;
  gap: 0.75rem;
}

.auth-social__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: $radius-md;
  border: 1px solid var(--border-soft);
  background: var(--surface-2);
  color: var(--text-main);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-hover);
    background: var(--surface-3);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}

/* 切换链接 */
.auth-switch {
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-soft);
  margin: 0;
}

.auth-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
}
</style>
